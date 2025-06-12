// backend/src/api/compilationRoutes.js
const express = require('express');
const router = express.Router();
const videoService = require('../services/videoService');
const twitchService = require('../services/twitchService');
const Bull = require('bull');
const path = require('path');
const { exec } = require('child_process');

// Test all dependencies
router.get('/test-dependencies', async (req, res) => {
  const { exec } = require('child_process');
  const ytdlpDownloader = require('../services/ytdlpDownloader');
  
  const results = {
    ffmpeg: false,
    ytdlp: false,
    redis: false
  };
  
  // Test FFmpeg
  await new Promise(resolve => {
    exec('ffmpeg -version', (error, stdout) => {
      results.ffmpeg = !error && stdout.includes('ffmpeg version');
      resolve();
    });
  });
  
  // Test yt-dlp
  results.ytdlp = await ytdlpDownloader.checkInstallation();
  
  // Test Redis
  try {
    await videoQueue.client.ping();
    results.redis = true;
  } catch (error) {
    results.redis = false;
  }
  
  const allGood = Object.values(results).every(v => v);
  
  res.json({
    success: allGood,
    dependencies: results,
    message: allGood ? 'All dependencies are installed' : 'Some dependencies are missing',
    instructions: {
      ffmpeg: !results.ffmpeg ? 'Install FFmpeg from https://ffmpeg.org/download.html' : 'OK',
      ytdlp: !results.ytdlp ? 'Install yt-dlp: pip install yt-dlp' : 'OK',
      redis: !results.redis ? 'Start Redis: docker run -d -p 6379:6379 redis' : 'OK'
    }
  });
});

// Create a queue for video processing jobs
const videoQueue = new Bull('video-processing', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Test Redis connection
videoQueue.client.ping((err) => {
  if (err) {
    console.error('Redis connection failed:', err);
    console.error('Make sure Redis is running on port 6379');
  } else {
    console.log('Redis connected successfully');
  }
});

// Process video compilation jobs
videoQueue.process(async (job) => {
  const { clips, options, metadata } = job.data;
  
  try {
    console.log(`Starting job ${job.id} with ${clips.length} clips`);
    console.log(`Title: ${metadata?.title || 'Untitled'}`);
    
    // Update job progress
    await job.progress(10);
    
    // Get full clip data with download URLs
    const clipsWithUrls = [];
    for (const clip of clips) {
      try {
        console.log(`Processing clip: ${clip.id}`);
        
        // For Twitch clips, we need to use the embed URL to get the actual video
        // The video URL is embedded in the clip's metadata
        
        // Option 1: Try using the clip URL directly
        let videoUrl = clip.url || `https://clips.twitch.tv/${clip.id}`;
        
        // Option 2: Use the thumbnail URL pattern
        // Modern Twitch clips use a different CDN
        if (clip.thumbnail_url) {
          // Extract the clip slug from thumbnail URL
          const thumbnailMatch = clip.thumbnail_url.match(/([A-Za-z0-9_-]+)-preview/);
          if (thumbnailMatch) {
            const clipSlug = thumbnailMatch[1];
            // Try different CDN patterns
            videoUrl = `https://production.assets.clips.twitchcdn.net/${clipSlug}.mp4`;
            
            // Alternative CDN
            // videoUrl = `https://clips-media-assets2.twitch.tv/${clipSlug}.mp4`;
          }
        }
        
        console.log(`Clip ${clip.id} thumbnail: ${clip.thumbnail_url}`);
        console.log(`Attempting video URL: ${videoUrl}`);
        
        clipsWithUrls.push({
          ...clip,
          url: videoUrl,
          fallbackUrl: clip.thumbnail_url?.replace('-preview-480x272.jpg', '.mp4')
        });
      } catch (error) {
        console.error(`Error processing clip ${clip.id}:`, error.message);
      }
    }
    
    if (clipsWithUrls.length === 0) {
      throw new Error('No valid clips found to process');
    }
    
    console.log(`Attempting to download ${clipsWithUrls.length} clips`);
    await job.progress(30);
    
    // Create the compilation with fallback handling
    const result = await videoService.createCompilation(clipsWithUrls, options);
    
    // Add metadata to result
    result.title = metadata?.title || 'Untitled Compilation';
    result.metadata = metadata;
    
    await job.progress(100);
    
    return result;
  } catch (error) {
    console.error('Video processing error:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
});

// Create a new compilation
router.post('/create', async (req, res) => {
  try {
    const { clips, options = {} } = req.body;
    
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No clips provided'
      });
    }
    
    // Add job to queue with metadata
    const job = await videoQueue.add({
      clips,
      options: {
        convertToVertical: options.convertToVertical !== false, // Default to true
        cameraPosition: options.cameraPosition || 'bottom',
        addOutro: options.addOutro !== false, // Default to true
        outroPath: options.outroPath // Will be implemented later
      },
      metadata: {
        title: options.title || 'Untitled Compilation',
        createdAt: new Date()
      }
    });
    
    res.json({
      success: true,
      jobId: job.id,
      message: 'Compilation job created. Check status for progress.'
    });
  } catch (error) {
    console.error('Error creating compilation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await videoQueue.getJob(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    const state = await job.getState();
    const progress = job.progress();
    
    let response = {
      success: true,
      jobId: job.id,
      state,
      progress
    };
    
    if (state === 'completed') {
      response.result = job.returnvalue;
    } else if (state === 'failed') {
      response.error = job.failedReason;
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all compilations (TODO: Add database storage)
router.get('/list', async (req, res) => {
  try {
    // For now, return active jobs
    const jobs = await videoQueue.getJobs(['completed', 'active', 'waiting', 'failed']);
    
    const compilations = await Promise.all(jobs.map(async (job) => {
      const state = await job.getState();
      return {
        id: job.id,
        state,
        progress: job.progress(),
        createdAt: new Date(job.timestamp),
        result: state === 'completed' ? job.returnvalue : null
      };
    }));
    
    res.json({
      success: true,
      data: compilations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download compilation
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../uploads/compilations', filename);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    res.download(filepath);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Preview compilation (stream video)
router.get('/preview/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../uploads/compilations', filename);
    
    const fs = require('fs');
    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filepath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(filepath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
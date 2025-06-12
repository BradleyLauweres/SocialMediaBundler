// backend/src/api/editorRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const videoService = require('../services/videoService');
const Bull = require('bull');
const { exec } = require('child_process');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/editor');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'camera', maxCount: 1 }
]);

// Create a queue for editor processing
const editorQueue = new Bull('video-editor', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Test Redis connection
editorQueue.client.ping((err) => {
  if (err) {
    console.error('Redis connection failed:', err);
    console.error('Make sure Redis is running on port 6379');
  } else {
    console.log('Redis connected successfully');
  }
});

// Process editor jobs
editorQueue.process(async (job) => {
  const { videoPath, template, cameraPosition, camRegion } = job.data;
  
  try {
    await job.progress(10);
    
    // Process the video based on template settings
    const outputFilename = `edited_${Date.now()}.mp4`;
    let processedPath = videoPath;
    
    // Convert to vertical if needed with camera extraction
    if (template.aspectRatio === '9:16' && camRegion) {
      await job.progress(30);
      const verticalFilename = `vertical_${Date.now()}.mp4`;
      
      // Use the new method that extracts camera region
      processedPath = await videoService.convertToVerticalWithExtractedCamera(
        videoPath,
        camRegion,
        verticalFilename,
        { cameraPosition }
      );
    } else if (template.aspectRatio === '9:16') {
      // Fallback to simple vertical conversion
      await job.progress(30);
      const verticalFilename = `vertical_${Date.now()}.mp4`;
      processedPath = await videoService.convertToVertical(
        videoPath,
        verticalFilename,
        { cameraPosition }
      );
    }
    
    // Add intro if requested
    if (template.hasIntro) {
      await job.progress(50);
      // TODO: Implement intro addition
    }
    
    // Add outro if requested
    if (template.hasOutro) {
      await job.progress(70);
      // Check if outro exists
      const outroDir = path.join(__dirname, '../../outros');
      
      try {
        await fs.mkdir(outroDir, { recursive: true });
        const outroFiles = await fs.readdir(outroDir);
        
        // Filter for video files only
        const videoOutros = outroFiles.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
        });
        
        if (videoOutros.length > 0) {
          const outroPath = path.join(outroDir, videoOutros[0]);
          const withOutroFilename = `with_outro_${Date.now()}.mp4`;
          
          try {
            processedPath = await videoService.addOutro(
              processedPath,
              outroPath,
              withOutroFilename
            );
          } catch (outroError) {
            console.error('Failed to add outro:', outroError);
            // Continue without outro instead of failing completely
          }
        } else {
          console.log('No outro files found, skipping outro addition');
        }
      } catch (error) {
        console.error('Error accessing outro directory:', error);
      }
    }
    
    await job.progress(90);
    
    // Generate thumbnail
    const thumbnailFilename = `thumb_${Date.now()}.jpg`;
    const thumbnailPath = await videoService.generateThumbnail(
      processedPath,
      thumbnailFilename
    );
    
    await job.progress(100);
    
    return {
      success: true,
      videoPath: processedPath,
      thumbnailPath,
      filename: path.basename(processedPath)
    };
    
  } catch (error) {
    console.error('Editor processing error:', error);
    throw error;
  }
});

// Test all dependencies
router.get('/test-dependencies', async (req, res) => {
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
    await editorQueue.client.ping();
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

// Test FFmpeg with a simple operation
router.get('/test-ffmpeg', async (req, res) => {
  const testVideoPath = path.join(__dirname, '../../temp/test.mp4');
  
  // First check if ffmpeg exists
  exec('ffmpeg -version', async (error, stdout, stderr) => {
    if (error) {
      return res.json({
        success: false,
        error: 'FFmpeg not found',
        details: error.message
      });
    }
    
    // Try to create a simple test video
    const command = `ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=30 -pix_fmt yuv420p "${testVideoPath}" -y`;
    
    exec(command, async (error, stdout, stderr) => {
      if (error) {
        return res.json({
          success: false,
          error: 'FFmpeg test failed',
          details: stderr
        });
      }
      
      // Clean up test file
      try {
        await fs.unlink(testVideoPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      res.json({
        success: true,
        message: 'FFmpeg is working correctly',
        version: stdout.split('\n')[0]
      });
    });
  });
});

// Upload and process video
router.post('/process', upload, async (req, res) => {
  try {
    if (!req.files || !req.files.video || !req.files.video[0]) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }
    
    const videoFile = req.files.video[0];
    const template = JSON.parse(req.body.template || '{}');
    const cameraPosition = req.body.cameraPosition || 'bottom';
    const camRegion = req.body.camRegion ? JSON.parse(req.body.camRegion) : null;
    
    // Add job to queue
    const job = await editorQueue.add({
      videoPath: videoFile.path,
      template,
      cameraPosition,
      camRegion
    });
    
    res.json({
      success: true,
      jobId: job.id,
      message: 'Video processing started'
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get processing status
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await editorQueue.getJob(req.params.jobId);
    
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

// Get available outros
router.get('/outros', async (req, res) => {
  try {
    const outroDir = path.join(__dirname, '../../outros');
    await fs.mkdir(outroDir, { recursive: true });
    
    const files = await fs.readdir(outroDir);
    const outros = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.mov', '.avi'].includes(ext);
    });
    
    res.json({
      success: true,
      outros: outros.map(filename => ({
        filename,
        name: path.basename(filename, path.extname(filename))
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload outro
router.post('/outros/upload', multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for outros
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
}).single('outro'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No outro file uploaded'
      });
    }
    
    // Move file to outros directory
    const outroDir = path.join(__dirname, '../../outros');
    await fs.mkdir(outroDir, { recursive: true });
    
    const newPath = path.join(outroDir, req.file.originalname);
    await fs.rename(req.file.path, newPath);
    
    res.json({
      success: true,
      filename: req.file.originalname
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete outro
router.delete('/outros/:filename', async (req, res) => {
  try {
    const outroPath = path.join(__dirname, '../../outros', req.params.filename);
    await fs.unlink(outroPath);
    
    res.json({
      success: true,
      message: 'Outro deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
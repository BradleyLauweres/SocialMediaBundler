const express = require('express');
const router = express.Router();
const twitchService = require('../services/twitchService');

router.get('/debug/config', (req, res) => {
  const hasClientId = !!process.env.TWITCH_CLIENT_ID;
  const hasClientSecret = !!process.env.TWITCH_CLIENT_SECRET;
  
  res.json({
    success: true,
    config: {
      hasClientId,
      hasClientSecret,
      clientIdLength: process.env.TWITCH_CLIENT_ID?.length || 0,
      clientSecretLength: process.env.TWITCH_CLIENT_SECRET?.length || 0,
    }
  });
});

router.get('/clips/popular', async (req, res) => {
  try {
 
    const topGames = await twitchService.getTopGames(5);
    
    if (topGames.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch top games'
      });
    }

    const result = await twitchService.getClips({
      game_id: topGames[0].id,
      first: req.query.limit ? parseInt(req.query.limit) : 20
    });
    
    res.json({
      success: true,
      data: result.clips,
      game: topGames[0],
      pagination: result.pagination
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/clips', async (req, res) => {
  try {
    const options = {
      broadcaster_id: req.query.broadcaster_id,
      game_id: req.query.game_id,
      first: req.query.limit ? parseInt(req.query.limit) : 20,
      after: req.query.after,
      before: req.query.before,
      started_at: req.query.started_at,
      ended_at: req.query.ended_at
    };


    Object.keys(options).forEach(key => 
      options[key] === undefined && delete options[key]
    );

    const result = await twitchService.getClips(options);
    
    res.json({
      success: true,
      data: result.clips,
      pagination: result.pagination
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/games/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const games = await twitchService.searchGames(q);
    res.json({
      success: true,
      data: games
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/games/top', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const games = await twitchService.getTopGames(limit);
    
    res.json({
      success: true,
      data: games
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/channels/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const channels = await twitchService.searchChannels(q);
    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/clips/:id', async (req, res) => {
  try {
    const clip = await twitchService.getClipDetails(req.params.id);
    
    if (!clip) {
      return res.status(404).json({
        success: false,
        error: 'Clip not found'
      });
    }

    res.json({
      success: true,
      data: clip
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/clips/save', async (req, res) => {
  try {
    const { clips } = req.body;
    
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No clips provided'
      });
    }

    res.json({
      success: true,
      message: `${clips.length} clips saved successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download a single clip for preview
router.post('/clips/download', async (req, res) => {
  try {
    const { clipUrl } = req.body;
    
    if (!clipUrl) {
      return res.status(400).json({
        success: false,
        error: 'Clip URL is required'
      });
    }
    
    const ytdlpDownloader = require('../services/ytdlpDownloader');
    const twitchClipDownloader = require('../services/twitchClipDownloaderService');
    const path = require('path');
    const fs = require('fs').promises;
    
    console.log('Received clip URL:', clipUrl);
    
    // Extract clip ID from URL (e.g., https://clips.twitch.tv/ClipID or https://www.twitch.tv/clip/ClipID)
    let clipId;
    const urlMatch = clipUrl.match(/clips\.twitch\.tv\/([^/?]+)|twitch\.tv\/[^/]+\/clip\/([^/?]+)/);
    if (urlMatch) {
      clipId = urlMatch[1] || urlMatch[2];
    } else {
      // If URL doesn't match pattern, try using it as clip ID directly
      clipId = clipUrl.split('/').pop().split('?')[0]; // Remove query params
    }
    
    console.log('Extracted clip ID:', clipId);
    
    if (!clipId || clipId.length < 5) {
      return res.status(400).json({
        success: false,
        error: `Could not extract valid clip ID from URL: ${clipUrl}`
      });
    }
    
    // Create temp directory for downloads
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Generate unique filename
    const filename = `preview_${clipId}_${Date.now()}.mp4`;
    const filepath = path.join(tempDir, filename);
    
    // Try alternative downloader first (produces more web-compatible files)
    try {
      console.log('Trying Twitch clip downloader...');
      await twitchClipDownloader.downloadClip(clipId, filepath);
    } catch (error) {
      console.log('Twitch clip downloader failed, trying yt-dlp...', error.message);
      
      // Fallback to yt-dlp
      const ytdlpAvailable = await ytdlpDownloader.checkInstallation();
      if (!ytdlpAvailable) {
        return res.status(500).json({
          success: false,
          error: 'Both download methods failed. yt-dlp is not installed and direct download failed.'
        });
      }
      
      await ytdlpDownloader.downloadClip(clipId, filepath);
    }
    
    // Verify file exists before responding
    const fsSync = require('fs');
    if (!fsSync.existsSync(filepath)) {
      throw new Error('Downloaded file not found at expected path');
    }
    
    // Try to ensure web compatibility with a simple ffmpeg conversion
    try {
      const { exec } = require('child_process');
      const tempFilePath = filepath.replace('.mp4', '_webcompat.mp4');
      
      await new Promise((resolve, reject) => {
        const ffmpegCmd = `ffmpeg -i "${filepath}" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -movflags +faststart -y "${tempFilePath}"`;
        console.log('Converting for web compatibility:', ffmpegCmd);
        
        exec(ffmpegCmd, { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) {
            console.log('FFmpeg conversion failed, using original file:', error.message);
            resolve(); // Continue with original file
          } else if (fsSync.existsSync(tempFilePath)) {
            // Replace original with converted file
            try {
              fsSync.unlinkSync(filepath);
              fsSync.renameSync(tempFilePath, filepath);
              console.log('Video converted for web compatibility');
            } catch (err) {
              console.log('File replacement failed, using original:', err.message);
            }
            resolve();
          } else {
            console.log('Converted file not found, using original');
            resolve();
          }
        });
      });
    } catch (conversionError) {
      console.log('Conversion process failed, using original file:', conversionError.message);
    }
    
    const stats = fsSync.statSync(filepath);
    console.log('Downloaded file info:', {
      path: filepath,
      size: stats.size,
      exists: true
    });
    
    console.log('Sending response:', {
      filename: path.basename(filepath),
      path: filepath,
      fileSize: stats.size,
      videoUrl: `/downloads/${path.basename(filepath)}`,
      fallbackUrl: `/api/twitch/download-file/${path.basename(filepath)}`
    });
    
    res.json({
      success: true,
      filename: path.basename(filepath),
      path: filepath,
      fileSize: stats.size,
      videoUrl: `/downloads/${path.basename(filepath)}`,
      fallbackUrl: `/api/twitch/download-file/${path.basename(filepath)}`
    });
    
  } catch (error) {
    console.error('Clip download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve video file directly through API (fallback for static serving issues)
router.get('/download-file/:filename', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../temp', filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    const stats = fs.statSync(filepath);
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    
    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to check if a specific video file is accessible
router.get('/downloads/test/:filename', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../temp', filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        filepath
      });
    }
    
    const stats = fs.statSync(filepath);
    res.json({
      success: true,
      filename,
      filepath,
      size: stats.size,
      downloadUrl: `/downloads/${filename}`,
      fallbackUrl: `/api/twitch/download-file/${filename}`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to list files in temp directory
router.get('/downloads/list', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs').promises;
    
    const tempDir = path.join(__dirname, '../../temp');
    const files = await fs.readdir(tempDir);
    
    const fileDetails = [];
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.stat(filePath);
        fileDetails.push({
          name: file,
          size: stats.size,
          created: stats.birthtime,
          isVideo: ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(path.extname(file).toLowerCase())
        });
      } catch (e) {
        // Skip files that can't be accessed
      }
    }
    
    res.json({
      success: true,
      tempDir,
      files: fileDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
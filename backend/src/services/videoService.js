// backend/src/services/videoService.js
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ytdlpDownloader = require('./ytdlpDownloader');

class VideoService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    this.outputDir = path.join(__dirname, '../../uploads/compilations');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  // Download a clip from URL
  async downloadClip(clipUrl, filename) {
    const filepath = path.join(this.tempDir, filename);
    
    try {
      console.log(`Downloading clip from URL: ${clipUrl}`);
      console.log(`Saving to: ${filepath}`);
      
      const response = await axios({
        method: 'GET',
        url: clipUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const writer = require('fs').createWriteStream(filepath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Downloaded successfully: ${filename}`);
          resolve(filepath);
        });
        writer.on('error', (error) => {
          console.error(`Write error for ${filename}:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`Error downloading clip ${filename}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      throw error;
    }
  }

  // Get video metadata
  async getVideoMetadata(filepath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  // Merge multiple clips into one video
  async mergeClips(clipPaths, outputFilename, options = {}) {
    const outputPath = path.join(this.outputDir, outputFilename);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Add all input files
      clipPaths.forEach(clipPath => {
        command.input(clipPath);
      });

      // Create filter for concatenation
      const filterComplex = clipPaths.map((_, index) => `[${index}:v][${index}:a]`).join('') + 
                           `concat=n=${clipPaths.length}:v=1:a=1[outv][outa]`;

      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-crf', '23'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('Merging completed');
          resolve(outputPath);
        })
        .save(outputPath);
    });
  }

  // Convert video to vertical format (9:16) for TikTok/Shorts
  async convertToVertical(inputPath, outputFilename, options = {}) {
    const outputPath = path.join(this.outputDir, outputFilename);
    const { cameraPosition = 'bottom' } = options;

    return new Promise((resolve, reject) => {
      // Get input video metadata first
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const inputWidth = videoStream.width;
        const inputHeight = videoStream.height;

        // Target dimensions for vertical video (9:16)
        const targetWidth = 1080;
        const targetHeight = 1920;

        // Calculate scaling to fit the gameplay
        const gameplayHeight = Math.floor(targetHeight * 0.5); // 50% of screen for gameplay
        const gameplayWidth = Math.floor(gameplayHeight * (inputWidth / inputHeight));

        // Position calculations
        let gameplayX = Math.floor((targetWidth - gameplayWidth) / 2); // Center horizontally
        let gameplayY;
        let overlayY;

        switch (cameraPosition) {
          case 'top':
            gameplayY = targetHeight - gameplayHeight;
            overlayY = 0;
            break;
          case 'bottom':
          default:
            gameplayY = 0;
            overlayY = gameplayHeight;
            break;
        }

        const filterComplex = [
          // Create black background
          `color=c=black:s=${targetWidth}x${targetHeight}[bg]`,
          // Scale the input video
          `[0:v]scale=${gameplayWidth}:${gameplayHeight}:force_original_aspect_ratio=decrease[scaled]`,
          // Overlay the scaled video on the background
          `[bg][scaled]overlay=${gameplayX}:${gameplayY}:shortest=1[final]`
        ].join(';');

        ffmpeg(inputPath)
          .complexFilter(filterComplex)
          .outputOptions([
            '-map', '[final]',
            '-map', '0:a',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'fast',
            '-crf', '23',
            '-r', '30' // 30 fps for social media
          ])
          .on('start', (commandLine) => {
            console.log('FFmpeg vertical conversion command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Converting to vertical: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('error', (err) => {
            console.error('FFmpeg conversion error:', err);
            reject(err);
          })
          .on('end', () => {
            console.log('Vertical conversion completed');
            resolve(outputPath);
          })
          .save(outputPath);
      });
    });
  }

  // Convert video to vertical format with extracted camera region
  async convertToVerticalWithExtractedCamera(videoPath, camRegion, outputFilename, options = {}) {
    const outputPath = path.join(this.outputDir, outputFilename);
    const { cameraPosition = 'bottom' } = options;

    return new Promise((resolve, reject) => {
      // Get video metadata
      this.getVideoMetadata(videoPath).then((metadata) => {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');

        // Target dimensions for vertical video (9:16)
        const targetWidth = 1080;
        const targetHeight = 1920;

        // For full width positions, camera takes 30% of height
        const fullCameraHeight = Math.floor(targetHeight * 0.3);
        const fullGameplayHeight = targetHeight - fullCameraHeight;

        let filterComplex;

        if (cameraPosition === 'bottom full') {
          // Stack layout: gameplay on top (70%), camera on bottom (30%)
          filterComplex = [
            // Extract and scale camera region to full width, cropping to fill entire space
            `[0:v]crop=${camRegion.width}:${camRegion.height}:${camRegion.x}:${camRegion.y},scale=${targetWidth}:${fullCameraHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${fullCameraHeight}[cam]`,
            
            // Crop main video to 9:16 aspect ratio without scaling, then resize to 70% height
            `[0:v]crop='min(iw,ih*9/16):ih',scale=${targetWidth}:${fullGameplayHeight}[gameplay]`,
            
            // Stack them vertically
            `[gameplay][cam]vstack=inputs=2[final]`
          ].join(';');
        } else if (cameraPosition === 'top full') {
          // Stack layout: camera on top (30%), gameplay on bottom (70%)
          filterComplex = [
            // Extract and scale camera region to full width, cropping to fill entire space
            `[0:v]crop=${camRegion.width}:${camRegion.height}:${camRegion.x}:${camRegion.y},scale=${targetWidth}:${fullCameraHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${fullCameraHeight}[cam]`,
            
            // Crop main video to 9:16 aspect ratio without scaling, then resize to 70% height
            `[0:v]crop='min(iw,ih*9/16):ih',scale=${targetWidth}:${fullGameplayHeight}[gameplay]`,
            
            // Stack them vertically (camera first, then gameplay)
            `[cam][gameplay]vstack=inputs=2[final]`
          ].join(';');
        } else {
          // Original overlay method for corner/center positions
          const cameraWidth = Math.floor(targetWidth * 0.3);
          const cameraHeight = Math.floor(targetHeight * 0.3);

          // Calculate camera position
          let cameraX, cameraY;

          switch (cameraPosition) {
            case 'top':
              cameraX = (targetWidth - cameraWidth) / 2;
              cameraY = 0;
              break;
            case 'bottom':
              cameraX = (targetWidth - cameraWidth) / 2;
              cameraY = targetHeight - cameraHeight;
              break;
            case 'left':
              cameraX = 0;
              cameraY = (targetHeight - cameraHeight) / 2;
              break;
            case 'right':
              cameraX = targetWidth - cameraWidth;
              cameraY = (targetHeight - cameraHeight) / 2;
              break;
            case 'center':
              cameraX = (targetWidth - cameraWidth) / 2;
              cameraY = (targetHeight - cameraHeight) / 2;
              break;
            case 'top left':
              cameraX = 0;
              cameraY = 0;
              break;
            case 'top right':
              cameraX = targetWidth - cameraWidth;
              cameraY = 0;
              break;
            case 'bottom left':
              cameraX = 0;
              cameraY = targetHeight - cameraHeight;
              break;
            case 'bottom right':
              cameraX = targetWidth - cameraWidth;
              cameraY = targetHeight - cameraHeight;
              break;
            default:
              cameraX = 0;
              cameraY = targetHeight - cameraHeight;
          }

          filterComplex = [
            // Crop main video to 9:16 aspect ratio (center crop, no scaling)
            `[0:v]crop='min(iw,ih*9/16):ih',scale=${targetWidth}:${targetHeight}[main]`,
            
            // Extract and scale the camera region, cropping to fill space without black bars
            `[0:v]crop=${camRegion.width}:${camRegion.height}:${camRegion.x}:${camRegion.y},scale=${cameraWidth}:${cameraHeight}:force_original_aspect_ratio=increase,crop=${cameraWidth}:${cameraHeight}[cam]`,
            
            // Add border to camera
            `[cam]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.8:t=2[cam_bordered]`,
            
            // Overlay camera on main video
            `[main][cam_bordered]overlay=${cameraX}:${cameraY}[final]`
          ].join(';');
        }

        ffmpeg(videoPath)
          .complexFilter(filterComplex)
          .outputOptions([
            '-map', '[final]',
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'fast',
            '-crf', '23',
            '-r', '30'
          ])
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg error:', err);
            console.error('FFmpeg stderr:', stderr);
            reject(err);
          })
          .on('end', () => {
            console.log('Video processing completed');
            resolve(outputPath);
          })
          .save(outputPath);
      }).catch(reject);
    });
  }

  // Convert video to vertical format (9:16) with camera overlay
  async convertToVerticalWithCamera(gameplayPath, cameraPath, outputFilename, options = {}) {
    const outputPath = path.join(this.outputDir, outputFilename);
    const { cameraPosition = 'bottom' } = options;

    return new Promise((resolve, reject) => {
      // Get metadata for both videos
      Promise.all([
        this.getVideoMetadata(gameplayPath),
        this.getVideoMetadata(cameraPath)
      ]).then(([gameplayMeta, cameraMeta]) => {
        const gameplayVideo = gameplayMeta.streams.find(s => s.codec_type === 'video');
        const cameraVideo = cameraMeta.streams.find(s => s.codec_type === 'video');

        // Target dimensions for vertical video (9:16)
        const targetWidth = 1080;
        const targetHeight = 1920;

        // Calculate camera overlay size (30% of screen)
        const cameraWidth = Math.floor(targetWidth * 0.3);
        const cameraHeight = Math.floor(targetHeight * 0.3);

        // Calculate camera position
        let cameraX, cameraY;
        const padding = 20; // Padding from edges

        switch (cameraPosition) {
          case 'top':
            cameraX = (targetWidth - cameraWidth) / 2;
            cameraY = padding;
            break;
          case 'bottom':
            cameraX = (targetWidth - cameraWidth) / 2;
            cameraY = targetHeight - cameraHeight - padding;
            break;
          case 'left':
            cameraX = padding;
            cameraY = (targetHeight - cameraHeight) / 2;
            break;
          case 'right':
            cameraX = targetWidth - cameraWidth - padding;
            cameraY = (targetHeight - cameraHeight) / 2;
            break;
          case 'center':
            cameraX = (targetWidth - cameraWidth) / 2;
            cameraY = (targetHeight - cameraHeight) / 2;
            break;
          case 'top left':
            cameraX = padding;
            cameraY = padding;
            break;
          case 'top right':
            cameraX = targetWidth - cameraWidth - padding;
            cameraY = padding;
            break;
          case 'bottom left':
            cameraX = padding;
            cameraY = targetHeight - cameraHeight - padding;
            break;
          case 'bottom right':
            cameraX = targetWidth - cameraWidth - padding;
            cameraY = targetHeight - cameraHeight - padding;
            break;
          default:
            cameraX = padding;
            cameraY = targetHeight - cameraHeight - padding;
        }

        const filterComplex = [
          // Scale gameplay to fill vertical format (70% focus on gameplay)
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}[gameplay]`,
          // Scale camera to 30% size with rounded corners
          `[1:v]scale=${cameraWidth}:${cameraHeight}[camera_scaled]`,
          // Add rounded corners to camera (optional - requires drawbox filter)
          `[camera_scaled]format=yuva444p,geq=lum='lum(X,Y)':a='if(lt(abs(W/2-X),W/2-10)*lt(abs(H/2-Y),H/2-10),255,0)'[camera_rounded]`,
          // Overlay camera on gameplay
          `[gameplay][camera_rounded]overlay=${cameraX}:${cameraY}[final]`
        ].join(';');

        ffmpeg()
          .input(gameplayPath)
          .input(cameraPath)
          .complexFilter(filterComplex)
          .outputOptions([
            '-map', '[final]',
            '-map', '0:a?', // Include audio from gameplay if exists
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'fast',
            '-crf', '23',
            '-r', '30'
          ])
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg error:', err);
            console.error('FFmpeg stderr:', stderr);
            reject(err);
          })
          .on('end', () => {
            console.log('Video processing completed');
            resolve(outputPath);
          })
          .save(outputPath);
      }).catch(reject);
    });
  }

  // Add outro to video
  async addOutro(videoPath, outroPath, outputFilename) {
    const outputPath = path.join(this.outputDir, outputFilename);

    return new Promise((resolve, reject) => {
      // First, get metadata for both videos
      Promise.all([
        this.getVideoMetadata(videoPath),
        this.getVideoMetadata(outroPath)
      ]).then(([mainMeta, outroMeta]) => {
        const mainVideo = mainMeta.streams.find(s => s.codec_type === 'video');
        const outroVideo = outroMeta.streams.find(s => s.codec_type === 'video');
        const mainAudio = mainMeta.streams.find(s => s.codec_type === 'audio');
        const outroAudio = outroMeta.streams.find(s => s.codec_type === 'audio');

        // Determine target dimensions (use main video's dimensions)
        const width = mainVideo.width;
        const height = mainVideo.height;
        const fps = eval(mainVideo.r_frame_rate); // Convert "30/1" to 30

        const command = ffmpeg()
          .input(videoPath)
          .input(outroPath);

        // Build filter complex to ensure both videos have same properties
        let filterComplex = [];
        
        // Scale and pad videos to same size
        filterComplex.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v0]`);
        filterComplex.push(`[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v1]`);
        
        // Handle audio - ensure both have audio tracks
        if (mainAudio && outroAudio) {
          // Both have audio
          filterComplex.push('[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]');
        } else if (mainAudio && !outroAudio) {
          // Only main has audio - add silent audio to outro
          filterComplex.push(`aevalsrc=0:d=${outroVideo.duration}[silentaudio]`);
          filterComplex.push('[v0][0:a][v1][silentaudio]concat=n=2:v=1:a=1[outv][outa]');
        } else if (!mainAudio && outroAudio) {
          // Only outro has audio - add silent audio to main
          filterComplex.push(`aevalsrc=0:d=${mainVideo.duration}[silentaudio]`);
          filterComplex.push('[v0][silentaudio][v1][1:a]concat=n=2:v=1:a=1[outv][outa]');
        } else {
          // Neither has audio - video only
          filterComplex.push('[v0][v1]concat=n=2:v=1:a=0[outv]');
        }

        command.complexFilter(filterComplex.join(';'));

        // Output options
        const outputOptions = [
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23'
        ];

        if (mainAudio || outroAudio) {
          outputOptions.push('-map', '[outv]', '-map', '[outa]', '-c:a', 'aac');
        } else {
          outputOptions.push('-map', '[outv]');
        }

        command
          .outputOptions(outputOptions)
          .on('start', (commandLine) => {
            console.log('FFmpeg outro command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Adding outro: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg outro error:', err);
            console.error('FFmpeg stderr:', stderr);
            reject(err);
          })
          .on('end', () => {
            console.log('Outro added successfully');
            resolve(outputPath);
          })
          .save(outputPath);
      }).catch(reject);
    });
  }

  // Generate thumbnail from video
  async generateThumbnail(videoPath, outputFilename, timestamp = '00:00:01') {
    const outputPath = path.join(this.outputDir, outputFilename);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: outputFilename,
          folder: this.outputDir,
          size: '1280x720'
        })
        .on('error', (err) => {
          console.error('Thumbnail generation error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('Thumbnail generated');
          resolve(outputPath);
        });
    });
  }

  // Clean up temporary files
  async cleanup(filePaths) {
    for (const filepath of filePaths) {
      try {
        await fs.unlink(filepath);
        console.log(`Cleaned up: ${filepath}`);
      } catch (error) {
        console.error(`Error cleaning up ${filepath}:`, error.message);
      }
    }
  }

  // Main compilation process
  async createCompilation(clips, options = {}) {
    const compilationId = uuidv4();
    const tempFiles = [];
    
    try {
      // Check if yt-dlp is available
      const ytdlpAvailable = await ytdlpDownloader.checkInstallation();
      if (!ytdlpAvailable) {
        throw new Error('yt-dlp is not installed. Please install it to download Twitch clips.');
      }
      
      // 1. Download all clips
      console.log('Starting clip downloads...');
      const downloadPromises = clips.map(async (clip, index) => {
        const filename = `${compilationId}_clip_${index}.mp4`;
        const filepath = path.join(this.tempDir, filename);
        
        try {
          // Use yt-dlp to download the clip
          await ytdlpDownloader.downloadClip(clip.id, filepath);
          return filepath;
        } catch (error) {
          console.error(`Failed to download clip ${clip.id}:`, error.message);
          throw error;
        }
      });
      
      const downloadResults = await Promise.allSettled(downloadPromises);
      const downloadedPaths = downloadResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      
      if (downloadedPaths.length === 0) {
        throw new Error('Failed to download any clips');
      }
      
      console.log(`Successfully downloaded ${downloadedPaths.length} out of ${clips.length} clips`);
      tempFiles.push(...downloadedPaths);
      
      // 2. Merge clips
      console.log('Merging clips...');
      const mergedFilename = `${compilationId}_merged.mp4`;
      const mergedPath = await this.mergeClips(downloadedPaths, mergedFilename);
      
      // 3. Convert to vertical format if requested
      let finalPath = mergedPath;
      if (options.convertToVertical) {
        console.log('Converting to vertical format...');
        const verticalFilename = `${compilationId}_vertical.mp4`;
        finalPath = await this.convertToVertical(
          mergedPath, 
          verticalFilename, 
          { cameraPosition: options.cameraPosition }
        );
      }
      
      // 4. Add outro if provided
      if (options.outroPath) {
        console.log('Adding outro...');
        const withOutroFilename = `${compilationId}_final.mp4`;
        finalPath = await this.addOutro(finalPath, options.outroPath, withOutroFilename);
      }
      
      // 5. Generate thumbnail
      console.log('Generating thumbnail...');
      const thumbnailFilename = `${compilationId}_thumb.jpg`;
      const thumbnailPath = await this.generateThumbnail(finalPath, thumbnailFilename);
      
      // 6. Clean up temporary files
      await this.cleanup(tempFiles);
      
      return {
        success: true,
        compilationId,
        videoPath: finalPath,
        thumbnailPath,
        filename: path.basename(finalPath)
      };
      
    } catch (error) {
      // Clean up on error
      await this.cleanup(tempFiles);
      throw error;
    }
  }
}

module.exports = new VideoService();
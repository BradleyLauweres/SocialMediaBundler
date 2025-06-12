const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class YtdlpDownloader {
  async downloadClip(clipId, outputPath) {
    return new Promise((resolve, reject) => {
      const clipUrl = `https://clips.twitch.tv/${clipId}`;
      
      // Use a web-compatible format with simple re-encoding
      const command = `yt-dlp -f "best[ext=mp4]/best" --recode-video mp4 -o "${outputPath}" "${clipUrl}"`;
      
      console.log(`Executing: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        console.log('yt-dlp stdout:', stdout);
        console.log('yt-dlp stderr:', stderr);
        
        if (error) {
          console.error('yt-dlp execution error:', error);
          console.error('yt-dlp stderr:', stderr);
          
          // Provide more specific error messages
          if (stderr.includes('Unable to download')) {
            reject(new Error(`Unable to download clip. The clip may be unavailable or private.`));
          } else if (stderr.includes('HTTP Error 404')) {
            reject(new Error(`Clip not found. Please check the clip URL.`));
          } else if (stderr.includes('403')) {
            reject(new Error(`Access forbidden. The clip may be private or geo-restricted.`));
          } else {
            reject(new Error(`Failed to download clip: ${stderr || error.message}`));
          }
          return;
        }
        
        if (fs.existsSync(outputPath)) {
          console.log(`Successfully downloaded clip to: ${outputPath}`);
          
          // Post-process the video to ensure web compatibility
          this.ensureWebCompatible(outputPath)
            .then(() => resolve(outputPath))
            .catch((err) => {
              console.warn('Post-processing failed, using original file:', err.message);
              resolve(outputPath); // Still return the original file even if post-processing fails
            });
        } else {
          console.error('Download completed but file not found at:', outputPath);
          reject(new Error('Download completed but file not found. Check yt-dlp output above.'));
        }
      });
    });
  }
  
  async ensureWebCompatible(filePath) {
    return new Promise((resolve, reject) => {
      const tempPath = filePath.replace('.mp4', '_temp.mp4');
      
      // Use ffmpeg to ensure web compatibility
      const command = `ffmpeg -i "${filePath}" -movflags +faststart -pix_fmt yuv420p -c:v libx264 -preset fast -crf 23 -c:a aac -y "${tempPath}"`;
      
      console.log(`Post-processing for web compatibility: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg post-processing failed:', error);
          reject(error);
          return;
        }
        
        // Replace original file with processed one
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(filePath); // Remove original
            fs.renameSync(tempPath, filePath); // Replace with processed
            console.log('Video post-processed for web compatibility');
            resolve();
          } else {
            reject(new Error('Post-processed file not found'));
          }
        } catch (err) {
          console.error('File replacement failed:', err);
          reject(err);
        }
      });
    });
  }
  
  async checkInstallation() {
    return new Promise((resolve) => {
      exec('yt-dlp --version', (error, stdout, stderr) => {
        if (error) {
          console.error('yt-dlp is not installed or not in PATH');
          resolve(false);
        } else {
          console.log('yt-dlp version:', stdout.trim());
          resolve(true);
        }
      });
    });
  }
}

module.exports = new YtdlpDownloader();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TwitchClipDownloader {
  async getClipVideoUrl(clipId) {
    try {
      const gqlResponse = await axios.post('https://gql.twitch.tv/gql', {
        query: `
          query {
            clip(slug: "${clipId}") {
              videoQualities {
                sourceURL
                quality
              }
              video {
                id
              }
            }
          }
        `
      }, {
        headers: {
          'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (gqlResponse.data?.data?.clip?.videoQualities?.length > 0) {
        const qualities = gqlResponse.data.data.clip.videoQualities;
        const bestQuality = qualities.find(q => q.quality === '1080') || 
                           qualities.find(q => q.quality === '720') || 
                           qualities[0];
        return bestQuality.sourceURL;
      }
    } catch (error) {
      console.error('GQL method failed:', error.message);
    }

    try {
      const pageResponse = await axios.get(`https://clips.twitch.tv/${clipId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = pageResponse.data;
      
      const videoUrlMatch = html.match(/https:\/\/[^"]*\.mp4/);
      if (videoUrlMatch) {
        return videoUrlMatch[0];
      }

      const clipDataMatch = html.match(/window\.__clipData\s*=\s*({[^}]+})/);
      if (clipDataMatch) {
        try {
          const clipData = JSON.parse(clipDataMatch[1]);
          if (clipData.quality_options) {
            return clipData.quality_options[0].source;
          }
        } catch (e) {
          console.error('Failed to parse clip data:', e);
        }
      }
    } catch (error) {
      console.error('Page scraping method failed:', error.message);
    }

    throw new Error(`Could not extract video URL for clip ${clipId}`);
  }

  async downloadClip(clipId, outputPath) {
    try {
      console.log(`Getting video URL for clip ${clipId}...`);
      const videoUrl = await this.getClipVideoUrl(clipId);
      
      console.log(`Downloading from: ${videoUrl}`);
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://clips.twitch.tv/'
        }
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Downloaded clip to: ${outputPath}`);
          resolve(outputPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Failed to download clip ${clipId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new TwitchClipDownloader();
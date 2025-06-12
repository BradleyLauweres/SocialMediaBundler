const axios = require('axios');

class TwitchService {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Twitch credentials not configured. Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in your .env file');
    }

    try {
      console.log('Requesting new Twitch access token...');
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      console.log('Successfully obtained Twitch access token');
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Twitch access token:', error.response?.data || error.message);
      if (error.response?.status === 400) {
        throw new Error('Invalid Twitch credentials. Please check your TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
      }
      throw new Error('Failed to authenticate with Twitch');
    }
  }

  async getClips(options = {}) {
    const accessToken = await this.getAccessToken();
    
    const params = new URLSearchParams();
    
    if (!options.broadcaster_id && !options.game_id && !options.id) {
      const topGames = await this.getTopGames(1);
      if (topGames.length > 0) {
        params.append('game_id', topGames[0].id);
      } else {

        params.append('game_id', '33214'); 
      }
    } else {
      if (options.broadcaster_id) params.append('broadcaster_id', options.broadcaster_id);
      if (options.game_id) params.append('game_id', options.game_id);
      if (options.id) params.append('id', options.id);
    }
    

    if (options.first) params.append('first', options.first.toString());
    if (options.after) params.append('after', options.after);
    if (options.before) params.append('before', options.before);
    if (options.started_at) params.append('started_at', options.started_at);
    if (options.ended_at) params.append('ended_at', options.ended_at);
    
    if (!params.has('first')) params.append('first', '20');
    
    try {
      console.log('Fetching clips with params:', params.toString());
      const response = await axios.get(`https://api.twitch.tv/helix/clips?${params.toString()}`, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return {
        clips: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      console.error('Failed to fetch Twitch clips:', error.response?.data || error.message);
      throw new Error('Failed to fetch clips from Twitch');
    }
  }

  async searchGames(query) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`https://api.twitch.tv/helix/games`, {
        params: { name: query },
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Failed to search games:', error);
      throw new Error('Failed to search games');
    }
  }

  async getTopGames(limit = 20) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`https://api.twitch.tv/helix/games/top`, {
        params: { first: limit },
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch top games:', error);
      throw new Error('Failed to fetch top games');
    }
  }

  async searchChannels(query) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`https://api.twitch.tv/helix/search/channels`, {
        params: { 
          query: query,
          first: 10
        },
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Failed to search channels:', error);
      throw new Error('Failed to search channels');
    }
  }

  async getClipDetails(clipId) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`https://api.twitch.tv/helix/clips`, {
        params: { id: clipId },
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.data[0];
    } catch (error) {
      console.error('Failed to fetch clip details:', error);
      throw new Error('Failed to fetch clip details');
    }
  }
}

module.exports = new TwitchService();
'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import axios from 'axios';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { CalendarIcon } from '@heroicons/react/24/solid';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Clip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
}

interface Game {
  id: string;
  name: string;
  box_art_url: string;
}

interface Channel {
  id: string;
  broadcaster_login: string;
  display_name: string;
  game_id: string;
  game_name: string;
  is_live: boolean;
  thumbnail_url: string;
}

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchGame, setSearchGame] = useState('');
  const [searchChannel, setSearchChannel] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [limit, setLimit] = useState(20);
  
  const [games, setGames] = useState<Game[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [searchingGames, setSearchingGames] = useState(false);
  const [searchingChannels, setSearchingChannels] = useState(false);

  const fetchClips = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {
        limit: limit
      };
      
      if (selectedGame) params.game_id = selectedGame.id;
      if (selectedChannel) params.broadcaster_id = selectedChannel.id;
      if (startDate) params.started_at = startDate.toISOString();
      if (endDate) params.ended_at = endDate.toISOString();
      
      const response = await axios.get(`${API_URL}/api/twitch/clips`, { params });
      setClips(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch clips');
    } finally {
      setLoading(false);
    }
  };

  const searchGames = async (query: string) => {
    if (!query || query.length < 2) {
      setGames([]);
      return;
    }
    
    setSearchingGames(true);
    try {
      const response = await axios.get(`${API_URL}/api/twitch/games/search`, {
        params: { q: query }
      });
      setGames(response.data.data);
    } catch (err) {
      console.error('Failed to search games:', err);
    } finally {
      setSearchingGames(false);
    }
  };

  const searchChannels = async (query: string) => {
    if (!query || query.length < 2) {
      setChannels([]);
      return;
    }
    
    setSearchingChannels(true);
    try {
      const response = await axios.get(`${API_URL}/api/twitch/channels/search`, {
        params: { q: query }
      });
      setChannels(response.data.data);
    } catch (err) {
      console.error('Failed to search channels:', err);
    } finally {
      setSearchingChannels(false);
    }
  };

  const toggleClipSelection = (clipId: string) => {
    const newSelection = new Set(selectedClips);
    if (newSelection.has(clipId)) {
      newSelection.delete(clipId);
    } else {
      newSelection.add(clipId);
    }
    setSelectedClips(newSelection);
  };

  const selectAllClips = () => {
    setSelectedClips(new Set(clips.map(clip => clip.id)));
  };


  const clearSelection = () => {
    setSelectedClips(new Set());
  };

  const saveSelectedClips = async () => {
    if (selectedClips.size === 0) return;
    
    try {
      const selectedClipData = clips.filter(clip => selectedClips.has(clip.id));
      await axios.post(`${API_URL}/api/twitch/clips/save`, {
        clips: selectedClipData
      });
      alert(`${selectedClips.size} clips saved successfully!`);
      clearSelection();
    } catch (err) {
      alert('Failed to save clips');
    }
  };

  useEffect(() => {
    fetchClips();
  }, []); 


  useEffect(() => {
    const timer = setTimeout(() => {
      searchGames(searchGame);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchGame]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchChannels(searchChannel);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchChannel]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Twitch Clips</h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse and select clips to create compilations
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filters
            </button>
            
            <button
              onClick={fetchClips}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Refresh Clips
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Game Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Game
                </label>
                <input
                  type="text"
                  value={searchGame}
                  onChange={(e) => setSearchGame(e.target.value)}
                  placeholder="Search games..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                {searchingGames && (
                  <div className="absolute right-2 top-9">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-500 rounded-full border-t-transparent"></div>
                  </div>
                )}
                {games.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-auto">
                    {games.map((game) => (
                      <button
                        key={game.id}
                        onClick={() => {
                          setSelectedGame(game);
                          setSearchGame(game.name);
                          setGames([]);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <img
                          src={game.box_art_url.replace('{width}', '40').replace('{height}', '56')}
                          alt={game.name}
                          className="w-10 h-14 object-cover rounded"
                        />
                        <span>{game.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Channel Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel
                </label>
                <input
                  type="text"
                  value={searchChannel}
                  onChange={(e) => setSearchChannel(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                {searchingChannels && (
                  <div className="absolute right-2 top-9">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-500 rounded-full border-t-transparent"></div>
                  </div>
                )}
                {channels.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-auto">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => {
                          setSelectedChannel(channel);
                          setSearchChannel(channel.display_name);
                          setChannels([]);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
                      >
                        <div className="font-medium">{channel.display_name}</div>
                        <div className="text-sm text-gray-500">{channel.game_name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholderText="Select start date"
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholderText="Select end date"
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                  minDate={startDate || undefined}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limit
                  </label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedGame(null);
                    setSelectedChannel(null);
                    setSearchGame('');
                    setSearchChannel('');
                    setStartDate(null);
                    setEndDate(null);
                    setLimit(20);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
                <button
                  onClick={fetchClips}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selection Actions */}
        {selectedClips.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-blue-800">
              {selectedClips.size} clip{selectedClips.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-blue-600 hover:text-blue-800"
              >
                Clear Selection
              </button>
              <button
                onClick={saveSelectedClips}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Selected Clips
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
          </div>
        )}

        {/* Clips Grid */}
        {!loading && clips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className={`relative bg-white rounded-lg shadow overflow-hidden cursor-pointer transition-all ${
                  selectedClips.has(clip.id) ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => toggleClipSelection(clip.id)}
              >
                {/* Selection Indicator */}
                <div className="absolute top-2 right-2 z-10">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      selectedClips.has(clip.id)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white bg-opacity-75 border border-gray-300'
                    }`}
                  >
                    {selectedClips.has(clip.id) && <CheckIcon className="h-4 w-4" />}
                  </div>
                </div>

                {/* Thumbnail */}
                <div className="relative aspect-video">
                  <img
                    src={clip.thumbnail_url}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {Math.floor(clip.duration / 60)}:{(clip.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                {/* Clip Info */}
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 line-clamp-2">
                    {clip.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {clip.broadcaster_name}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      {new Date(clip.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-600">
                      {clip.view_count.toLocaleString()} views
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && clips.length === 0 && (
          <div className="text-center py-12">
            <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No clips found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or search criteria
            </p>
            <div className="mt-6">
              <button
                onClick={fetchClips}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <MagnifyingGlassIcon className="-ml-1 mr-2 h-5 w-5" />
                Search Again
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
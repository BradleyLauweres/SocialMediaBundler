// frontend/src/app/clips/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckIcon,
  VideoCameraIcon,
  PlayIcon,
  HomeIcon,
  CalendarIcon,
  CogIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import toast, { Toaster } from 'react-hot-toast';
import CreateCompilationModal from '@/components/CreateCompilationModal';

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
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchGame, setSearchGame] = useState('');
  const [searchChannel, setSearchChannel] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [limit, setLimit] = useState(20);
  
  // Search results
  const [games, setGames] = useState<Game[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [searchingGames, setSearchingGames] = useState(false);
  const [searchingChannels, setSearchingChannels] = useState(false);
  

  // Fetch clips
  const fetchClips = async (useFilters = false) => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `${API_URL}/api/twitch/clips`;
      const params: any = { limit };
      
      if (useFilters && (selectedGame || selectedChannel)) {
        // Use filtered endpoint
        if (selectedGame) params.game_id = selectedGame.id;
        if (selectedChannel) params.broadcaster_id = selectedChannel.id;
        if (startDate) params.started_at = startDate.toISOString();
        if (endDate) params.ended_at = endDate.toISOString();
      } else {
        // Use popular clips endpoint
        url = `${API_URL}/api/twitch/clips/popular`;
      }
      
      const response = await axios.get(url, { params });
      
      if (response.data.success) {
        setClips(response.data.data);
        if (response.data.game) {
          setCurrentGame(response.data.game);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch clips');
      toast.error('Failed to fetch clips');
    } finally {
      setLoading(false);
    }
  };

  // Search games
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

  // Search channels
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

  // Toggle clip selection
  const toggleClipSelection = (clipId: string) => {
    const newSelection = new Set(selectedClips);
    if (newSelection.has(clipId)) {
      newSelection.delete(clipId);
    } else {
      newSelection.add(clipId);
    }
    setSelectedClips(newSelection);
  };

  // Select all clips
  const selectAllClips = () => {
    setSelectedClips(new Set(clips.map(clip => clip.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedClips(new Set());
  };

  // Save selected clips
  const saveSelectedClips = async () => {
    if (selectedClips.size === 0) return;
    
    try {
      const selectedClipData = clips.filter(clip => selectedClips.has(clip.id));
      await axios.post(`${API_URL}/api/twitch/clips/save`, {
        clips: selectedClipData
      });
      toast.success(`${selectedClips.size} clips saved successfully!`);
      clearSelection();
    } catch (err) {
      toast.error('Failed to save clips');
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedGame(null);
    setSelectedChannel(null);
    setSearchGame('');
    setSearchChannel('');
    setStartDate(null);
    setEndDate(null);
    setLimit(20);
  };

  // Apply filters
  const applyFilters = () => {
    fetchClips(true);
  };


  // Fetch clips on component mount
  useEffect(() => {
    fetchClips();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce game search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchGames(searchGame);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchGame]);

  // Debounce channel search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchChannels(searchChannel);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchChannel]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900">
        <div className="flex h-16 items-center justify-center">
          <h1 className="text-xl font-bold text-white">Social Media Tool</h1>
        </div>
        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            <li>
              <a href="/" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <HomeIcon className="mr-3 h-5 w-5" />
                Dashboard
              </a>
            </li>
            <li>
              <a href="/clips" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium bg-gray-800 text-white">
                <ClipboardDocumentListIcon className="mr-3 h-5 w-5" />
                Twitch Clips
              </a>
            </li>
            <li>
              <a href="/compilations" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <VideoCameraIcon className="mr-3 h-5 w-5" />
                Compilations
              </a>
            </li>
            <li>
              <a href="/editor" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <VideoCameraIcon className="mr-3 h-5 w-5" />
                Video Editor
              </a>
            </li>
            <li>
              <a href="/schedule" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <CalendarIcon className="mr-3 h-5 w-5" />
                Schedule
              </a>
            </li>
            <li>
              <a href="/uploads" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <ArrowDownTrayIcon className="mr-3 h-5 w-5" />
                Uploads
              </a>
            </li>
            <li>
              <a href="/settings" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <CogIcon className="mr-3 h-5 w-5" />
                Settings
              </a>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <div className="p-8">
          <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Twitch Clips</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {currentGame ? `Showing clips from ${currentGame.name}` : 'Browse and select clips to create compilations'}
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
                  onClick={() => fetchClips()}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
                      onClick={clearFilters}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Clear Filters
                    </button>
                    <button
                      onClick={applyFilters}
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
                <div className="flex items-center space-x-4">
                  <span className="text-blue-800">
                    {selectedClips.size} clip{selectedClips.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={selectAllClips}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 text-blue-600 hover:text-blue-800"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Create Compilation
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
                    className={`relative bg-white rounded-lg shadow overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
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

                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-40">
                      <PlayIcon className="h-12 w-12 text-white" />
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
                    onClick={() => fetchClips()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <MagnifyingGlassIcon className="-ml-1 mr-2 h-5 w-5" />
                    Search Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Compilation Modal */}
      <CreateCompilationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedClips={clips.filter(clip => selectedClips.has(clip.id))}
        onSuccess={() => {
          clearSelection();
          toast.success('Compilation process started!');
        }}
      />

    </div>
  );
}
// frontend/src/app/compilations/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  VideoCameraIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  HomeIcon,
  CalendarIcon,
  CogIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Compilation {
  id: string;
  state: 'completed' | 'active' | 'waiting' | 'failed';
  progress: number;
  createdAt: string;
  result?: {
    compilationId: string;
    videoPath: string;
    thumbnailPath: string;
    filename: string;
    title?: string;
    metadata?: {
      title?: string;
    };
  };
}

export default function CompilationsPage() {
  const [compilations, setCompilations] = useState<Compilation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const fetchCompilations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/compilations/list`);
      if (response.data.success) {
        setCompilations(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch compilations');
    } finally {
      setLoading(false);
    }
  };

  const downloadCompilation = (filename: string) => {
    window.open(`${API_URL}/api/compilations/download/${filename}`, '_blank');
  };

  const previewCompilation = (filename: string) => {
    setSelectedVideo(filename);
  };

  useEffect(() => {
    fetchCompilations();
    
    // Refresh every 5 seconds to update progress
    const interval = setInterval(fetchCompilations, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'active':
        return <div className="animate-spin h-5 w-5 border-2 border-indigo-600 rounded-full border-t-transparent" />;
      case 'waiting':
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (state: string, progress: number) => {
    switch (state) {
      case 'completed':
        return 'Completed';
      case 'active':
        return `Processing... ${progress}%`;
      case 'waiting':
        return 'Waiting in queue';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

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
              <a href="/clips" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <ClipboardDocumentListIcon className="mr-3 h-5 w-5" />
                Twitch Clips
              </a>
            </li>
            <li>
              <a href="/compilations" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium bg-gray-800 text-white">
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
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Compilations</h1>
                <p className="text-sm text-gray-500 mt-1">
                  View and manage your video compilations
                </p>
              </div>
              
              <button
                onClick={fetchCompilations}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Refresh
              </button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
              </div>
            )}

            {/* Compilations List */}
            {!loading && compilations.length > 0 && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {compilations.map((compilation) => (
                      <tr key={compilation.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {compilation.result?.title || compilation.result?.metadata?.title || `Compilation #${compilation.id}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(compilation.state)}
                            <span className="ml-2 text-sm text-gray-900">
                              {getStatusText(compilation.state, compilation.progress)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(compilation.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {compilation.state === 'completed' && compilation.result && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => previewCompilation(compilation.result!.filename)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <PlayIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => downloadCompilation(compilation.result!.filename)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <ArrowDownTrayIcon className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty State */}
            {!loading && compilations.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No compilations yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select clips and create your first compilation
                </p>
                <div className="mt-6">
                  <a
                    href="/clips"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Go to Clips
                  </a>
                </div>
              </div>
            )}

            {/* Video Preview Modal */}
            {selectedVideo && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex min-h-screen items-center justify-center p-4">
                  <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setSelectedVideo(null)} />
                  <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full">
                    <div className="p-4">
                      <button
                        onClick={() => setSelectedVideo(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                      >
                        <XCircleIcon className="h-6 w-6" />
                      </button>
                      <video
                        controls
                        autoPlay
                        className="w-full rounded"
                        src={`${API_URL}/api/compilations/preview/${selectedVideo}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
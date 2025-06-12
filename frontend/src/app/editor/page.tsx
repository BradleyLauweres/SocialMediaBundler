// frontend/src/app/editor/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  VideoCameraIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  SparklesIcon,
  HomeIcon,
  CalendarIcon,
  CogIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  FilmIcon,
  CursorArrowRippleIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import OutroManager from '@/components/OutroManager';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type CameraPosition = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'top left' | 'top right' | 'bottom left' | 'bottom right' | 'bottom full' | 'top full';
type AspectRatio = '9:16' | '16:9' | '1:1';

interface CamRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VideoTemplate {
  id: string;
  name: string;
  cameraPosition: CameraPosition;
  aspectRatio: AspectRatio;
  hasOutro: boolean;
  hasIntro: boolean;
  overlayStyle: 'minimal' | 'gaming' | 'professional';
}

const defaultTemplates: VideoTemplate[] = [
  {
    id: 'tiktok-gaming',
    name: 'TikTok Gaming',
    cameraPosition: 'bottom',
    aspectRatio: '9:16',
    hasOutro: true,
    hasIntro: false,
    overlayStyle: 'gaming',
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    cameraPosition: 'center',
    aspectRatio: '9:16',
    hasOutro: true,
    hasIntro: true,
    overlayStyle: 'professional',
  },
  {
    id: 'instagram-reels',
    name: 'Instagram Reels',
    cameraPosition: 'top',
    aspectRatio: '9:16',
    hasOutro: false,
    hasIntro: false,
    overlayStyle: 'minimal',
  },
];

export default function VideoEditorPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate>(defaultTemplates[0]);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('bottom');
  const [showGrid, setShowGrid] = useState(true);
  const [showOutroManager, setShowOutroManager] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  
  // Camera region selection
  const [isSelectingCam, setIsSelectingCam] = useState(false);
  const [camRegion, setCamRegion] = useState<CamRegion | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<CamRegion | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setUploadedVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCamRegion(null); // Reset cam region when new video is uploaded
      setVideoLoaded(false); // Reset video loaded state
    } else {
      toast.error('Please upload a valid video file');
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setUploadedVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCamRegion(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle mouse events for cam selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelectingCam || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;
    
    setCurrentRect({
      x: width < 0 ? currentX : startPoint.x,
      y: height < 0 ? currentY : startPoint.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect || !videoRef.current || !containerRef.current) return;
    
    setIsDrawing(false);
    
    // Get the actual displayed dimensions
    const videoRect = videoRef.current.getBoundingClientRect();
    
    // Since we're showing the full video with object-fit: contain, 
    // we need to calculate the actual scale
    const scaleX = videoRef.current.videoWidth / videoRect.width;
    const scaleY = videoRef.current.videoHeight / videoRect.height;
    
    const camRegion = {
      x: Math.round(currentRect.x * scaleX),
      y: Math.round(currentRect.y * scaleY),
      width: Math.round(currentRect.width * scaleX),
      height: Math.round(currentRect.height * scaleY),
    };
    
    setCamRegion(camRegion);
    setIsSelectingCam(false);
    setCurrentRect(null);
    toast.success('Camera region selected!');
  };

  // Process video with selected settings
  const processVideo = async () => {
    if (!uploadedVideo) {
      toast.error('Please upload a video first');
      return;
    }

    if (!camRegion) {
      toast.error('Please select the camera region in your video');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('video', uploadedVideo);
    formData.append('template', JSON.stringify(selectedTemplate));
    formData.append('cameraPosition', cameraPosition);
    formData.append('camRegion', JSON.stringify(camRegion));

    try {
      const response = await axios.post(`${API_URL}/api/editor/process`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setJobId(response.data.jobId);
        toast.success('Video processing started!');
        pollJobStatus(response.data.jobId);
      }
    } catch (error) {
      toast.error('Failed to process video');
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll for job status
  const pollJobStatus = async (jobId: string) => {
    const checkStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/editor/status/${jobId}`);
        const { state, progress, result } = response.data;

        if (state === 'completed') {
          toast.success('Video processed successfully!');
          // Handle the processed video
          if (result?.filename) {
            const processedUrl = `${API_URL}/api/compilations/preview/${result.filename}`;
            window.open(processedUrl, '_blank');
          }
          return true;
        } else if (state === 'failed') {
          toast.error('Video processing failed');
          return true;
        } else if (state === 'active') {
          toast.loading(`Processing: ${progress}% complete`, { id: `editor-${jobId}` });
          return false;
        }
        return false;
      } catch (error) {
        console.error('Error checking job status:', error);
        return true;
      }
    };

    const interval = setInterval(async () => {
      const shouldStop = await checkStatus();
      if (shouldStop) {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 2000);

    checkStatus();
  };

  const getCameraPositionStyle = () => {
    const baseStyle = "absolute bg-gray-800 rounded-lg border-2 border-white shadow-lg";
    const size = "w-[30%] h-[30%]"; // 30% size for most positions
    const fullBottom = "w-full h-[30%]"; // Full width for bottom
    const fullTop = "w-full h-[30%]"; // Full width for top
    
    switch (cameraPosition) {
      case 'top':
        return `${baseStyle} ${size} top-0 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseStyle} ${size} bottom-0 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseStyle} ${size} left-0 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseStyle} ${size} right-0 top-1/2 -translate-y-1/2`;
      case 'center':
        return `${baseStyle} ${size} top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`;
      case 'top left':
        return `${baseStyle} ${size} top-0 left-0`;
      case 'top right':
        return `${baseStyle} ${size} top-0 right-0`;
      case 'bottom left':
        return `${baseStyle} ${size} bottom-0 left-0`;
      case 'bottom right':
        return `${baseStyle} ${size} bottom-0 right-0`;
      case 'bottom full':
        return `${baseStyle} ${fullBottom} bottom-0 left-0`;
      case 'top full':
        return `${baseStyle} ${fullTop} top-0 left-0`;
      default:
        return baseStyle;
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
              <a href="/compilations" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
                <VideoCameraIcon className="mr-3 h-5 w-5" />
                Compilations
              </a>
            </li>
            <li>
              <a href="/editor" className="flex items-center rounded-lg px-4 py-3 text-sm font-medium bg-gray-800 text-white">
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Video Editor</h1>
            <p className="text-sm text-gray-500 mt-1">
              Customize your videos for TikTok, YouTube Shorts, and Instagram Reels
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Preview Section */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Video Preview</h2>
                
                {/* Video Upload Area */}
                {!videoUrl ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Drop a video here or click to upload
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      MP4, MOV, AVI up to 500MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Preview Container */}
                    <div className="relative bg-black rounded-lg overflow-hidden">
                      {/* Aspect Ratio Container */}
                      <div className={`relative mx-auto ${
                        selectedTemplate.aspectRatio === '9:16' ? 'max-w-sm' :
                        selectedTemplate.aspectRatio === '1:1' ? 'max-w-md' : 'max-w-2xl'
                      }`}>
                        <div 
                          ref={containerRef}
                          className={`relative ${
                            selectedTemplate.aspectRatio === '9:16' ? 'aspect-[9/16]' :
                            selectedTemplate.aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'
                          } ${isSelectingCam ? 'cursor-crosshair' : ''}`}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                        >
                          {/* Grid Overlay */}
                          {showGrid && (
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-20">
                              {[...Array(9)].map((_, i) => (
                                <div key={i} className="border border-white/20" />
                              ))}
                            </div>
                          )}
                          
                          {/* Selection Rectangle */}
                          {(isDrawing || currentRect) && (
                            <div
                              className="absolute border-2 border-yellow-400 bg-yellow-400/20 pointer-events-none z-30"
                              style={{
                                left: `${currentRect?.x}px`,
                                top: `${currentRect?.y}px`,
                                width: `${currentRect?.width}px`,
                                height: `${currentRect?.height}px`,
                              }}
                            />
                          )}
                          
                          {/* Camera Position Preview */}
                          {camRegion && !isSelectingCam && (
                            <div className={getCameraPositionStyle()}>
                              <div className="flex items-center justify-center h-full bg-yellow-500/20 border-2 border-yellow-500 rounded-lg">
                                <span className="text-yellow-600 font-semibold text-xs">Camera Area</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Video - already cropped to 9:16 */}
                          <video
                            ref={videoRef}
                            src={videoUrl}
                            controls={!isSelectingCam}
                            className="relative z-10 w-full h-full object-cover"
                            style={{
                              objectPosition: 'center center'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Video Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          Change video
                        </button>
                        <button
                          onClick={() => {
                            setIsSelectingCam(true);
                            toast('Draw a rectangle around the player camera', {
                              icon: '📹',
                              duration: 4000,
                            });
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                        >
                          <CursorArrowRippleIcon className="h-4 w-4 mr-1" />
                          {camRegion ? 'Reselect camera region' : 'Select camera region'}
                        </button>
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={showGrid}
                          onChange={(e) => setShowGrid(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600">Show grid</span>
                      </label>
                    </div>

                    {/* Camera Region Info */}
                    {camRegion && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800">
                          Camera region selected: {camRegion.width}x{camRegion.height} at ({camRegion.x}, {camRegion.y})
                        </p>
                      </div>
                    )}
                    
                    {isSelectingCam && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          Draw a rectangle around the player camera. The yellow border shows what will be visible in the final 9:16 video.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Settings Panel */}
            <div className="space-y-6">
              {/* Templates */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Templates</h3>
                <div className="space-y-2">
                  {defaultTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setCameraPosition(template.cameraPosition);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedTemplate.id === template.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{template.name}</div>
                      <div className="text-sm text-gray-500">
                        {template.aspectRatio} • {template.overlayStyle}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Position */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Camera Position</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Where to place the extracted camera region
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCameraPosition('top full')}
                    className={`col-span-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      cameraPosition === 'top full'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Top Full Width
                  </button>
                  {['top-left', 'top', 'top-right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setCameraPosition(pos.replace('-', ' ') as CameraPosition)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cameraPosition === pos.replace('-', ' ')
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pos.charAt(0).toUpperCase() + pos.slice(1).replace('-', ' ')}
                    </button>
                  ))}
                  {['left', 'center', 'right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setCameraPosition(pos as CameraPosition)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cameraPosition === pos
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </button>
                  ))}
                  {['bottom-left', 'bottom', 'bottom-right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setCameraPosition(pos.replace('-', ' ') as CameraPosition)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cameraPosition === pos.replace('-', ' ')
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pos.charAt(0).toUpperCase() + pos.slice(1).replace('-', ' ')}
                    </button>
                  ))}
                  <button
                    onClick={() => setCameraPosition('bottom full')}
                    className={`col-span-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      cameraPosition === 'bottom full'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Bottom Full Width
                  </button>
                </div>
              </div>

              {/* Export Options */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Export Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.hasIntro}
                      onChange={(e) => setSelectedTemplate({
                        ...selectedTemplate,
                        hasIntro: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Add intro</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.hasOutro}
                      onChange={(e) => setSelectedTemplate({
                        ...selectedTemplate,
                        hasOutro: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Add outro</span>
                  </label>
                  {selectedTemplate.hasOutro && (
                    <button
                      onClick={() => setShowOutroManager(true)}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      <FilmIcon className="h-4 w-4 mr-1" />
                      Manage outros
                    </button>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <button
                onClick={processVideo}
                disabled={!uploadedVideo || isProcessing || !camRegion}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Process Video
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Outro Manager Modal */}
      <OutroManager
        isOpen={showOutroManager}
        onClose={() => setShowOutroManager(false)}
      />
    </div>
  );
}
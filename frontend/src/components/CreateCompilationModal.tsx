// frontend/src/components/CreateCompilationModal.tsx
import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import {
  XMarkIcon,
  VideoCameraIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Clip {
  id: string;
  title: string;
  broadcaster_name: string;
  duration: number;
  thumbnail_url: string;
}

interface CreateCompilationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClips: Clip[];
  onSuccess: () => void;
}

export default function CreateCompilationModal({
  isOpen,
  onClose,
  selectedClips,
  onSuccess,
}: CreateCompilationModalProps) {
  const [title, setTitle] = useState('');
  const [convertToVertical, setConvertToVertical] = useState(true);
  const [cameraPosition, setCameraPosition] = useState<'top' | 'bottom'>('bottom');
  const [addOutro, setAddOutro] = useState(true);
  const [creating, setCreating] = useState(false);

  const totalDuration = selectedClips.reduce((sum, clip) => sum + clip.duration, 0);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for the compilation');
      return;
    }

    setCreating(true);

    try {
      const response = await axios.post(`${API_URL}/api/compilations/create`, {
        clips: selectedClips,
        options: {
          title,
          convertToVertical,
          cameraPosition,
          addOutro,
        },
      });

      if (response.data.success) {
        toast.success('Compilation job started! Check the progress in the dashboard.');
        onSuccess();
        onClose();
        
        // Start polling for job status
        pollJobStatus(response.data.jobId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create compilation');
    } finally {
      setCreating(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    let toastId: string | undefined;
    
    const checkStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/compilations/status/${jobId}`);
        const { state, progress, result } = response.data;

        if (state === 'completed') {
          if (toastId) toast.dismiss(toastId);
          toast.success('Compilation completed successfully!');
          // Stop polling
          return true;
        } else if (state === 'failed') {
          if (toastId) toast.dismiss(toastId);
          toast.error('Compilation failed. Please try again.');
          // Stop polling
          return true;
        } else if (state === 'active') {
          // Update or create progress toast
          const message = `Processing: ${progress}% complete`;
          if (toastId) {
            toast.loading(message, { id: toastId });
          } else {
            toastId = toast.loading(message);
          }
          return false;
        }
        return false;
      } catch (error) {
        console.error('Error checking job status:', error);
        if (toastId) toast.dismiss(toastId);
        return true; // Stop polling on error
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      const shouldStop = await checkStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    // Initial check
    checkStatus();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-lg font-semibold">
              Create Compilation
            </Dialog.Title>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Selected Clips Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Selected Clips</h3>
                <span className="text-sm text-gray-500">
                  Total duration: {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {selectedClips.map((clip) => (
                  <div key={clip.id} className="relative">
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title}
                      className="w-full h-20 object-cover rounded"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded flex items-center justify-center">
                      <CheckIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compilation Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Compilation Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Epic Gaming Moments Compilation"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Format Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">
                    Convert to Vertical (TikTok/Shorts)
                  </label>
                  <p className="text-sm text-gray-500">
                    Converts the video to 9:16 aspect ratio
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConvertToVertical(!convertToVertical)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    convertToVertical ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      convertToVertical ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {convertToVertical && (
                <div className="ml-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera Position
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="bottom"
                        checked={cameraPosition === 'bottom'}
                        onChange={(e) => setCameraPosition(e.target.value as 'bottom')}
                        className="mr-2"
                      />
                      Bottom (Gameplay on top)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="top"
                        checked={cameraPosition === 'top'}
                        onChange={(e) => setCameraPosition(e.target.value as 'top')}
                        className="mr-2"
                      />
                      Top (Gameplay on bottom)
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">
                    Add Outro
                  </label>
                  <p className="text-sm text-gray-500">
                    Append your outro video to the end
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOutro(!addOutro)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    addOutro ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      addOutro ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end p-6 border-t space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {creating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <VideoCameraIcon className="h-5 w-5 mr-2" />
                  Create Compilation
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
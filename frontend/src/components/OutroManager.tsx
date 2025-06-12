// frontend/src/components/OutroManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  FilmIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Outro {
  filename: string;
  name: string;
}

interface OutroManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OutroManager({ isOpen, onClose }: OutroManagerProps) {
  const [outros, setOutros] = useState<Outro[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOutros = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/editor/outros`);
      if (response.data.success) {
        setOutros(response.data.outros);
      }
    } catch (error) {
      console.error('Failed to fetch outros:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOutros();
    }
  }, [isOpen]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please upload a video file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('outro', file);

    try {
      const response = await axios.post(`${API_URL}/api/editor/outros/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        toast.success('Outro uploaded successfully');
        fetchOutros();
      }
    } catch (error) {
      toast.error('Failed to upload outro');
    } finally {
      setUploading(false);
    }
  };

  const deleteOutro = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this outro?')) return;

    try {
      const response = await axios.delete(`${API_URL}/api/editor/outros/${filename}`);
      if (response.data.success) {
        toast.success('Outro deleted');
        fetchOutros();
      }
    } catch (error) {
      toast.error('Failed to delete outro');
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-lg font-semibold">
              Manage Outros
            </Dialog.Title>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Upload Section */}
            <div className="mb-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors flex flex-col items-center justify-center disabled:opacity-50"
              >
                <DocumentArrowUpIcon className="h-10 w-10 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {uploading ? 'Uploading...' : 'Click to upload outro video'}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  MP4, MOV, AVI up to 50MB
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Outros List */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 mb-3">Available Outros</h3>
              
              {outros.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FilmIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No outros uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {outros.map((outro) => (
                    <div
                      key={outro.filename}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <FilmIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">
                          {outro.name}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteOutro(outro.filename)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end p-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
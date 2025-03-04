import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AudioUpload = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    setIsLoading(true);
    setProgress(10);
    
    try {
      const formData = new FormData();
      formData.append('audioFile', audioFile);
      
      // Add language option for Hebrew summarization
      const options = {
        language: 'Hebrew'
      };
      formData.append('options', JSON.stringify(options));
      
      setProgress(30);
      
      console.log('Uploading audio file:', audioFile.name);
      console.log('With options:', options);
      
      const response = await axios.post('/api/upload-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 70) / progressEvent.total
          );
          setProgress(30 + percentCompleted); // Start from 30% and go up to 100%
        }
      });
      
      console.log('Upload response:', response.data);
      
      if (response.data && response.data.summary) {
        // Navigate to the summary result page with the data
        console.log('Navigating to summary result page with data:', {
          summary: response.data.summary,
          pdfPath: response.data.pdfPath
        });
        
        navigate('/summary-result', { 
          state: { 
            summary: response.data.summary,
            pdfPath: response.data.pdfPath
          } 
        });
      } else {
        console.error('Invalid response format:', response.data);
        setError('Failed to process audio: Invalid response format');
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      setError(error.response?.data?.error || 'Failed to upload audio');
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="audioFile">
            בחר קובץ אודיו או וידאו
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="audioFile"
            type="file"
            accept="audio/*,video/*"
            onChange={handleFileChange}
          />
        </div>
        
        {error && (
          <div className="mb-4 text-red-500 text-sm">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center mt-2 text-sm text-gray-600">מעבד... {progress}%</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
              disabled={!audioFile || isLoading}
            >
              העלה והפק סיכום
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default AudioUpload; 
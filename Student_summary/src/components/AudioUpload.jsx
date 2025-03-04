import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AudioUpload = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      const response = await axios.post('/api/upload-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Upload response:', response.data);
      
      if (response.data.success) {
        // Navigate to the summary result page with the data
        navigate('/summary-result', { 
          state: { 
            summary: response.data.summary,
            pdfPath: response.data.pdfPath
          } 
        });
      } else {
        setError('Failed to process audio');
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      setError(error.response?.data?.error || 'Failed to upload audio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Render your form here */}
    </div>
  );
};

export default AudioUpload; 
import React, { useState } from 'react';
import '../styles/FileUpload.css';
import API_BASE_URL from '../config';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    // Only accept audio files
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select an audio file (MP3, WAV, etc.)');
      setFile(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('audioFile', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/process-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Handle successful upload (e.g., show summary)
      } else {
        setError(data.message || 'Error processing file');
      }
    } catch (error) {
      setError('Error uploading file');
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <h3>או העלה קובץ אודיו</h3>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="file-input"
        />
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">File processed successfully!</div>}
        <button 
          type="submit" 
          disabled={!file || loading}
          className={`upload-button ${loading ? 'loading' : ''}`}
        >
          {loading ? 'מעבד...' : 'העלה קובץ'}
        </button>
      </form>
    </div>
  );
}

export default FileUpload; 
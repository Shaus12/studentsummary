import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract video ID from YouTube URL
function extractVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

// Function to get transcript from YouTube video ID
async function fetchTranscript(videoId) {
  try {
    // Use the YouTube transcript API
    const response = await fetch(`https://youtubetranscript.com/?server_vid=${videoId}`);
    
    if (!response.ok) {
      console.error(`Transcript API returned status: ${response.status}`);
      throw new Error('Failed to fetch transcript');
    }
    
    const data = await response.json();
    
    if (!data || !data.transcript) {
      console.error('No transcript data returned');
      throw new Error('No captions found for this video');
    }
    
    return data.transcript;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

// Main function to process a YouTube video
export async function getYouTubeTranscript(videoId) {
  try {
    console.log(`Getting transcript for video ID: ${videoId}`);
    
    // Validate video ID
    if (!videoId || typeof videoId !== 'string' || videoId.length !== 11) {
      console.error('Invalid video ID:', videoId);
      throw new Error('Invalid video ID');
    }
    
    // Try to fetch the transcript
    const transcript = await fetchTranscript(videoId);
    
    if (!transcript) {
      throw new Error('No transcript available');
    }
    
    return transcript;
  } catch (error) {
    console.error('Error getting YouTube transcript:', error);
    throw error;
  }
} 
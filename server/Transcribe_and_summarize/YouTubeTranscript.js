import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract video ID from YouTube URL
export function extractVideoId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid YouTube URL');
  }
  
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  
  if (!match || !match[1]) {
    throw new Error('Could not extract video ID from URL');
  }
  
  return match[1];
}

// Function to get transcript from YouTube video ID
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

// Function to download YouTube audio
export async function downloadYouTubeAudio(youtubeUrl, outputPath) {
  try {
    console.log(`Downloading audio from: ${youtubeUrl}`);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    console.log(`Video ID: ${videoId}`);
    
    // Use yt-dlp to download audio
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" ${youtubeUrl}`;
    console.log(`Executing command: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    console.log('Download stdout:', stdout);
    
    if (stderr) {
      console.error('Download stderr:', stderr);
    }
    
    console.log(`Audio downloaded to: ${outputPath}`);
    
    return {
      method: 'download',
      outputPath: outputPath
    };
  } catch (error) {
    console.error('Error downloading YouTube audio:', error);
    throw error;
  }
}

// Private helper function to fetch transcript
async function fetchTranscript(videoId) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    // First, check if captions are available
    const captionsResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
    );
    
    if (!captionsResponse.data.items || captionsResponse.data.items.length === 0) {
      throw new Error('No captions found for this video');
    }
    
    // Get the first available caption track
    const captionId = captionsResponse.data.items[0].id;
    
    // Get the actual transcript
    const transcriptResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}`
    );
    
    if (!transcriptResponse.data || !transcriptResponse.data.text) {
      throw new Error('No transcript data returned');
    }
    
    return transcriptResponse.data.text;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
} 
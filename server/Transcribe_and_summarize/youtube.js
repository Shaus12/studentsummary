import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transcribeAudio } from './audio.js';
import { summarizeText, cleanupFile } from './utils.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
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

/**
 * Downloads audio from YouTube video
 * @param {string} youtubeUrl - YouTube URL
 * @param {string} outputPath - Path to save audio
 * @returns {Promise<object>} - Result object
 */
export async function downloadYouTubeAudio(youtubeUrl, outputPath) {
  try {
    console.log(`Downloading audio from: ${youtubeUrl}`);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    console.log(`Video ID: ${videoId}`);
    
    // Try the alternative approach without browser cookies
    const cmd = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-check-certificate --force-ipv4 --geo-bypass -o "${outputPath}" ${youtubeUrl}`;
    console.log('Running command:', cmd);
    
    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr && stderr.includes('ERROR:')) {
      console.error('Error downloading audio:', stderr);
      throw new Error(`yt-dlp error: ${stderr}`);
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

/**
 * Gets transcript from YouTube API (fallback method)
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Video transcript
 */
export async function getYouTubeTranscript(videoId) {
  try {
    // First try using youtube-transcript-api which doesn't require API key
    try {
      console.log(`Attempting to get transcript using youtube-transcript-api for video ID: ${videoId}`);
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (transcriptItems && transcriptItems.length > 0) {
        console.log(`Successfully retrieved transcript using youtube-transcript-api`);
        // Format the transcript
        const transcript = transcriptItems
          .map(item => item.text)
          .join(' ');
        return transcript;
      }
    } catch (error) {
      console.error('Error with youtube-transcript-api:', error.message);
    }
    
    // If we get here, the first method failed, try the YouTube API
    try {
      console.log(`Getting transcript for video ID: ${videoId} via API (fallback method)`);
      // YouTube API code...
      // ... existing API code ...
    } catch (apiError) {
      console.error('Error with YouTube API:', apiError.message);
    }
    
    // As a last resort, indicate we need to use audio transcription
    console.log('Falling back to audio transcription...');
    return null; // Return null instead of throwing an error
    
  } catch (error) {
    console.error('Error getting YouTube transcript:', error);
    return null; // Return null instead of throwing an error
  }
}

/**
 * Gets video info from YouTube API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object>} - Video info
 */
export async function getVideoInfo(videoId) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    console.log(`Fetching video info for video ID: ${videoId}`);
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`
    );
    
    if (!response.data.items || response.data.items.length === 0) {
      console.error('Video not found');
      throw new Error('Video not found');
    }
    
    console.log('Successfully retrieved video info');
    return response.data.items[0];
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
}

/**
 * Processes YouTube video
 * @param {string} youtubeUrl - YouTube URL
 * @param {string} outputType - Output type (summary or pdf)
 * @returns {Promise<object>} - Result object
 */
export async function processYouTube(youtubeUrl, outputType = 'summary') {
  try {
    console.log(`Attempting to download and transcribe YouTube video...`);
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    console.log(`Downloading audio from: ${youtubeUrl}`);
    console.log(`Video ID: ${videoId}`);
    
    // First try to get the transcript directly (without downloading)
    const transcript = await getYouTubeTranscript(videoId);
    
    if (transcript) {
      console.log('Successfully retrieved transcript, processing...');
      // Process the transcript based on outputType
      if (outputType === 'summary') {
        return await summarizeText(transcript);
      } else if (outputType === 'transcript') {
        return transcript;
      }
    }
    
    // If we couldn't get the transcript, try downloading the audio
    console.log('No transcript available, attempting to download audio...');
    const timestamp = Date.now();
    const outputPath = path.join(process.cwd(), 'temp', `audio_${timestamp}.mp3`);
    
    try {
      await downloadYouTubeAudio(youtubeUrl, outputPath);
      console.log(`Audio downloaded successfully to ${outputPath}`);
      
      // Transcribe the downloaded audio
      console.log('Transcribing downloaded audio...');
      const audioTranscript = await transcribeAudio(outputPath);
      
      // Process the transcript based on outputType
      if (outputType === 'summary') {
        return await summarizeText(audioTranscript);
      } else if (outputType === 'transcript') {
        return audioTranscript;
      }
    } catch (downloadError) {
      console.error('Error downloading or transcribing audio:', downloadError);
      throw new Error('Failed to process YouTube video: ' + downloadError.message);
    }
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    throw error;
  }
} 
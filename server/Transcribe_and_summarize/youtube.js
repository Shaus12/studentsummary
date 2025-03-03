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
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Path to downloaded audio
 */
const downloadYouTubeAudio = async (videoId) => {
  try {
    console.log(`Downloading audio from: https://www.youtube.com/watch?v=${videoId}`);
    console.log(`Video ID: ${videoId}`);
    
    const outputPath = path.join(process.cwd(), 'temp', `audio_${Date.now()}.mp3`);
    
    // Try with cookies from browser first
    try {
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --cookies-from-browser chrome -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Running command: ${command}`);
      
      const { stdout } = await exec(command);
      console.log(`YouTube download output: ${stdout}`);
      return outputPath;
    } catch (error) {
      console.log("Error with cookies-from-browser method, trying alternative approach...");
      
      // If that fails, try with other options
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-check-certificate --force-ipv4 --geo-bypass -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Running command: ${command}`);
      
      try {
        const { stdout } = await exec(command);
        console.log(`YouTube download output: ${stdout}`);
        return outputPath;
      } catch (downloadError) {
        if (downloadError.stderr && downloadError.stderr.includes("Sign in to confirm you're not a bot")) {
          throw new Error("YouTube is requiring authentication to access this video. Please try a different video or try again later.");
        } else {
          throw downloadError;
        }
      }
    }
  } catch (error) {
    console.error("Error downloading YouTube audio:", error);
    throw error;
  }
};

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
 * @param {string} url - YouTube URL
 * @param {string} outputType - Output type (summary or pdf)
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Result object
 */
export async function processYouTube(url, outputType = 'summary', options = {}) {
  try {
    console.log("Attempting to download and transcribe YouTube video...");
    
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }
    
    // First try to get transcript
    try {
      const transcript = await getYouTubeTranscript(videoId);
      if (transcript) {
        console.log("Successfully retrieved transcript");
        
        // Process the transcript based on output type
        if (outputType === "summary") {
          return await summarizeText(transcript, options);
        } else if (outputType === "questions") {
          return await generateQuestions(transcript, options);
        } else {
          return transcript;
        }
      }
    } catch (transcriptError) {
      console.log("Falling back to audio transcription...");
      // If transcript retrieval fails, continue to audio download
    }
    
    // If we get here, we need to download and transcribe the audio
    try {
      console.log("No transcript available, attempting to download audio...");
      const audioPath = await downloadYouTubeAudio(videoId);
      
      // Transcribe the downloaded audio
      const transcription = await transcribeAudio(audioPath);
      
      // Clean up the temporary audio file
      try {
        fs.unlinkSync(audioPath);
        console.log(`Deleted temporary file: ${audioPath}`);
      } catch (unlinkError) {
        console.error(`Error deleting temporary file: ${unlinkError.message}`);
      }
      
      // Process the transcription based on output type
      if (outputType === "summary") {
        return await summarizeText(transcription, options);
      } else if (outputType === "questions") {
        return await generateQuestions(transcription, options);
      } else {
        return transcription;
      }
    } catch (downloadError) {
      if (downloadError.message.includes("YouTube is requiring authentication")) {
        throw downloadError; // Pass through the user-friendly error
      } else {
        console.error("Error downloading or transcribing audio:", downloadError);
        throw new Error("Failed to process YouTube video: " + downloadError.message);
      }
    }
  } catch (error) {
    console.error("Error processing YouTube video:", error);
    throw error;
  }
}

// Export the functions
export {
  processYouTube,
  downloadYouTubeAudio
}; 
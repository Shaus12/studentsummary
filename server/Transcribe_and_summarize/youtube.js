import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transcribeAudio } from './audio.js';
import { summarizeText, cleanupFile } from './utils.js';
import { YoutubeTranscript } from 'youtube-transcript';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Extracts video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
const extractVideoId = (url) => {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match && match[1] ? match[1] : null;
};

/**
 * Downloads audio from YouTube video
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Path to downloaded audio
 */
const downloadYouTubeAudio = async (videoId) => {
  try {
    console.log(`Downloading audio from: https://www.youtube.com/watch?v=${videoId}`);
    console.log(`Video ID: ${videoId}`);
    
    const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    
    // Try with cookies from browser first
    try {
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --cookies-from-browser chrome -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Running command: ${command}`);
      
      const { stdout } = await execAsync(command);
      console.log(`YouTube download output: ${stdout}`);
      return outputPath;
    } catch (error) {
      console.log("Error with cookies-from-browser method, trying alternative approach...");
      
      // If that fails, try with other options
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-check-certificate --force-ipv4 --geo-bypass -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Running command: ${command}`);
      
      try {
        const { stdout } = await execAsync(command);
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
const getYouTubeTranscript = async (videoId) => {
  try {
    console.log(`Attempting to get transcript using youtube-transcript-api for video ID: ${videoId}`);
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error('No transcript available');
    }
    
    // Combine all transcript items into a single text
    const fullTranscript = transcriptItems.map(item => item.text).join(' ');
    return fullTranscript;
  } catch (error) {
    console.log(`Error with youtube-transcript-api: ${error.message}`);
    
    // Try fallback method using YouTube API
    console.log(`Getting transcript for video ID: ${videoId} via API (fallback method)`);
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      console.log(`Using YouTube API Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'undefined'}`);
      
      // First, check if the API key is valid by making a simple request
      try {
        const testResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
        );
        console.log(`API key validation successful. Response status: ${testResponse.status}`);
      } catch (testError) {
        console.error(`API key validation failed: ${testError.message}`);
        if (testError.response) {
          console.error(`Response status: ${testError.response.status}`);
          console.error(`Response data: ${JSON.stringify(testError.response.data)}`);
        }
        throw new Error(`YouTube API key validation failed: ${testError.message}`);
      }
      
      // If we get here, the API key is valid, so try to get captions
      const captionsResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
      );
      
      if (!captionsResponse.data.items || captionsResponse.data.items.length === 0) {
        throw new Error('No captions found for this video');
      }
      
      const captionId = captionsResponse.data.items[0].id;
      const transcriptResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}`
      );
      
      if (!transcriptResponse.data) {
        throw new Error('No transcript data returned');
      }
      
      return transcriptResponse.data.text || '';
    } catch (apiError) {
      console.log(`Error with YouTube API fallback: ${apiError.message}`);
      throw new Error('Failed to get transcript');
    }
  }
};

/**
 * Gets video info from YouTube API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object>} - Video info
 */
const getVideoInfo = async (videoId) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    return response.data.items[0];
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
};

/**
 * Processes YouTube video
 * @param {string} url - YouTube URL
 * @param {string} outputType - Output type (summary or pdf)
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Result object
 */
const processYouTube = async (youtubeUrl, outputType = 'summary', options = {}) => {
  try {
    console.log(`Attempting to download and transcribe YouTube video...`);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Try to get transcript first
    let transcription;
    try {
      transcription = await getYouTubeTranscript(videoId);
      console.log("Successfully retrieved transcript");
    } catch (transcriptError) {
      console.log('Falling back to audio transcription...');
      console.log('No transcript available, attempting to download audio...');
      
      try {
        const audioPath = await downloadYouTubeAudio(videoId);
        
        // Here you would call your transcription function
        // transcription = await transcribeAudio(audioPath);
        
        // Clean up the audio file
        try {
          fs.unlinkSync(audioPath);
        } catch (cleanupError) {
          console.error('Error cleaning up audio file:', cleanupError);
        }
      } catch (downloadError) {
        if (downloadError.message.includes("YouTube is requiring authentication")) {
          throw new Error("YouTube is requiring authentication to access this video. Please try a different video or try again later.");
        } else {
          console.error("Error downloading or transcribing audio:", downloadError);
          throw new Error("Failed to process YouTube video. YouTube may be blocking automated access. Please try a different video or try again later.");
        }
      }
    }
    
    // If we don't have a transcription at this point, we need to inform the user
    if (!transcription) {
      throw new Error("Could not retrieve or generate a transcript for this video. Please try a different video.");
    }
    
    // Process the transcription based on output type
    if (outputType === "summary") {
      return await summarizeText(transcription, options);
    } else if (outputType === "questions") {
      return await generateQuestions(transcription, options);
    } else {
      return transcription;
    }
  } catch (error) {
    console.error("Error processing YouTube video:", error);
    throw error; // Pass the error directly to maintain the user-friendly message
  }
};

// Export all functions in a single export statement
export {
  extractVideoId,
  getYouTubeTranscript,
  getVideoInfo,
  processYouTube,
  downloadYouTubeAudio
}; 
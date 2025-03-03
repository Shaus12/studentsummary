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
    console.log(`Getting transcript for video ID: ${videoId} via API (fallback method)`);
    
    // Validate video ID
    if (!videoId || typeof videoId !== 'string' || videoId.length !== 11) {
      console.error('Invalid video ID:', videoId);
      throw new Error('Invalid video ID');
    }
    
    // First try with youtube-transcript (doesn't require API key)
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (transcript && transcript.length > 0) {
        // Format the transcript
        return transcript
          .map(item => item.text)
          .join(' ');
      }
    } catch (transcriptError) {
      console.log('Error with youtube-transcript, falling back to other methods:', transcriptError.message);
    }
    
    // If we have a valid API key, try the official API
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey && apiKey !== 'undefined') {
      try {
        // First get the caption tracks
        const captionsResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
        );
        
        if (captionsResponse.data && captionsResponse.data.items && captionsResponse.data.items.length > 0) {
          // Get the first caption track ID
          const captionId = captionsResponse.data.items[0].id;
          
          // Then get the actual transcript
          const transcriptResponse = await axios.get(
            `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}`
          );
          
          if (transcriptResponse.data) {
            return transcriptResponse.data;
          }
        }
      } catch (apiError) {
        console.log('Error with YouTube API:', apiError.message);
      }
    }
    
    // As a last resort, try to extract transcript from the downloaded audio
    console.log('Falling back to audio transcription...');
    throw new Error('No transcript available, will use audio transcription');
    
  } catch (error) {
    console.error('Error getting YouTube transcript:', error);
    throw error;
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
    console.log(`Processing YouTube URL: ${youtubeUrl}`);
    console.log(`Output type: ${outputType}`);
    
    const videoId = extractVideoId(youtubeUrl);
    let transcript;
    let method;
    
    // FIRST ATTEMPT: Download and transcribe
    try {
      console.log('Attempting to download and transcribe YouTube video...');
      const audioPath = path.join(__dirname, '..', 'temp', `audio_${Date.now()}.mp3`);
      const downloadResult = await downloadYouTubeAudio(youtubeUrl, audioPath);
      transcript = await transcribeAudio(downloadResult.outputPath);
      method = 'download';
      
      // Clean up audio file
      await cleanupFile(downloadResult.outputPath);
    } catch (downloadError) {
      console.error('Download failed, falling back to YouTube API:', downloadError);
      
      // FALLBACK: Try to get transcript via YouTube API
      transcript = await getYouTubeTranscript(videoId);
      method = 'api';
    }
    
    // Get video metadata
    let metadata = {};
    try {
      const videoInfo = await getVideoInfo(videoId);
      metadata = {
        title: videoInfo.snippet.title || 'Untitled Video',
        description: videoInfo.snippet.description || 'No description available',
        channelTitle: videoInfo.snippet.channelTitle || 'Unknown Channel',
        publishedAt: videoInfo.snippet.publishedAt 
          ? new Date(videoInfo.snippet.publishedAt).toLocaleDateString() 
          : 'Unknown date'
      };
    } catch (metadataError) {
      console.error('Error getting video metadata:', metadataError);
      metadata = {
        title: 'Unknown Title',
        description: 'No description available',
        channelTitle: 'Unknown Channel',
        publishedAt: 'Unknown date'
      };
    }
    
    // Process transcript in chunks
    const words = transcript.split(" ");
    const chunkSize = 1500;
    const chunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }
    
    // Summarize each chunk
    const summaries = [];
    for (const [index, chunk] of chunks.entries()) {
      console.log(`Summarizing chunk ${index + 1}/${chunks.length}...`);
      const summary = await summarizeText(chunk);
      summaries.push(summary);
    }
    
    // Combine all summaries into a final summary
    const finalSummary = await summarizeText(summaries.join(" "));
    
    // Generate PDF if requested
    let pdfPath = null;
    if (outputType === 'pdf') {
      const { generatePDF } = await import('./pdf.js');
      
      // Format content for PDF
      const pdfContent = `
# ${metadata.title}

ערוץ: ${metadata.channelTitle}
פורסם: ${metadata.publishedAt}

## תיאור
${metadata.description}

## סיכום
${finalSummary}
      `;
      
      pdfPath = await generatePDF(pdfContent);
    }
    
    return {
      summary: finalSummary,
      pdfPath,
      method,
      metadata
    };
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    throw error;
  }
} 
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractVideoId, downloadYouTubeAudio, getYouTubeTranscript } from './YouTubeTranscript.js';
import { transcribeAudio, summarizeText } from './audioProcessing.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || 'YOUR_DEEPGRAM_API_KEY';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY');

// Function to download YouTube audio
async function downloadYouTubeAudio(youtubeUrl, outputPath) {
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

// Main function to process YouTube videos
export async function processYouTube(youtubeUrl, outputType) {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    console.log(`Output type: ${outputType}`);
    
    // Process the YouTube video
    const audioPath = path.join(__dirname, '..', 'temp', `audio_${Date.now()}.mp3`);
    const result = await downloadYouTubeAudio(youtubeUrl, audioPath);
    
    // Try to get transcript first
    let text;
    try {
      const videoId = extractVideoId(youtubeUrl);
      text = await getYouTubeTranscript(videoId);
    } catch (transcriptError) {
      console.log('Failed to get transcript, falling back to audio transcription');
      text = await transcribeAudio(result.outputPath);
    }
    
    console.log(`Text obtained, length: ${text?.length}`);
    
    // Generate summary
    const output = await summarizeText(text);
    console.log(`Output generated, length: ${output?.length}`);
    
    // Clean up the audio file
    try {
      await fs.promises.unlink(result.outputPath);
      console.log(`Cleaned up audio file: ${result.outputPath}`);
    } catch (cleanupError) {
      console.error('Error cleaning up audio file:', cleanupError);
    }
    
    return {
      method: 'download',
      summary: output,
      pdfPath: null
    };
  } catch (error) {
    console.error('Error in processYouTube:', error);
    throw error;
  }
}
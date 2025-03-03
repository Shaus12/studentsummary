import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || 'YOUR_DEEPGRAM_API_KEY';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY');

// Function to extract video ID from YouTube URL
function extractVideoId(url) {
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

// Function to transcribe audio
async function transcribeAudio(audioPath) {
  try {
    console.log(`Transcribing audio file: ${audioPath}`);
    
    // Read the audio file
    const audioFile = fs.readFileSync(audioPath);
    
    // Transcribe with Deepgram
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioFile,
      {
        model: 'whisper',
        language: 'he',
        smart_format: true,
      }
    );
    
    const transcript = result.results.channels[0].alternatives[0].transcript;
    console.log(`Transcription complete: ${transcript.substring(0, 100)}...`);
    
    return transcript;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

// Function to summarize text
async function summarizeText(text) {
  try {
    console.log(`Summarizing text of length: ${text.length}`);
    
    // Use Gemini to summarize
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
    Please summarize the following Hebrew text in Hebrew. 
    Create a comprehensive summary that captures the main points and key details.
    
    Text to summarize:
    ${text}
    `;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    console.log(`Summary generated: ${summary.substring(0, 100)}...`);
    
    return summary;
  } catch (error) {
    console.error('Error summarizing text:', error);
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
    
    // Transcribe the audio
    const text = await transcribeAudio(result.outputPath);
    
    console.log(`Text obtained, length: ${text?.length}`);
    
    // Generate summary or notes based on the output type
    let output;
    if (outputType === 'summary') {
      output = await summarizeText(text);
    } else if (outputType === 'notes') {
      // For now, just use summarizeText for notes as well
      output = await summarizeText(text);
    } else {
      output = await summarizeText(text);
    }
    
    console.log(`Output generated, length: ${output?.length}`);
    
    // Generate PDF
    const pdfPath = await generatePDF(output);
    
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
      pdfPath: pdfPath
    };
  } catch (error) {
    console.error('Error in processYouTube:', error);
    throw error;
  }
}
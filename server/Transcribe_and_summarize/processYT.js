import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { transcribeAudio, summarizeText } from './transcribeAndSummarize.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || 'AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '2a60d94169738ee178d20bb606126fdd56c85710');

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

// Function to generate PDF
async function generatePDF(content) {
  try {
    console.log('Generating PDF...');
    
    const outputPath = path.join(__dirname, '..', 'temp', `summary_${Date.now()}.pdf`);
    
    // Format the content for PDF
    const formattedContent = content.replace(/\n/g, '<br>');
    
    // Create HTML template
    const html = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Summary</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            direction: rtl;
            text-align: right;
            padding: 20px;
          }
          h1 {
            text-align: center;
            margin-bottom: 20px;
          }
          .content {
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
        </style>
      </head>
      <body>
        <h1>סיכום</h1>
        <div class="content">
          ${formattedContent}
        </div>
      </body>
    </html>
    `;
    
    // Generate PDF using puppeteer
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    await browser.close();
    
    console.log(`PDF generated at: ${outputPath}`);
    
    // Return the relative path for storage in the database
    return `/files/${path.basename(outputPath)}`;
  } catch (error) {
    console.error('Error generating PDF:', error);
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
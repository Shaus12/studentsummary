import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadYouTubeAudio } from './DownloadFromYT.js';
import { getYouTubeTranscript } from './YouTubeTranscript.js';
import puppeteer from 'puppeteer';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { summarizeText } from './audioProcessing.js';
import { generatePDF } from './GeneratePDF.js';
import { extractVideoId } from './YouTubeTranscript.js';
import fetch from 'node-fetch';
import { dirname } from 'path';
import { transcribeAudio } from './transcribeAndSummarize.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure Deepgram with hardcoded key
const deepgramApiKey = '2a60d94169738ee178d20bb606126fdd56c85710';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini with hardcoded key
const genAI = new GoogleGenerativeAI('AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A');

// Function to generate PDF
async function generatePDF(content) {
  try {
    console.log('Generating PDF...');
    
    const outputPath = path.join(__dirname, '..', 'files', `summary_${Date.now()}.pdf`);
    
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
export async function processYouTube(youtubeUrl, outputType = 'summary', options = {}) {
  try {
    console.log(`Processing YouTube URL: ${youtubeUrl}`);
    console.log(`Output type: ${outputType}`);
    console.log(`Options:`, options);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Get video info using YouTube API
    const videoInfo = await getVideoInfo(videoId);
    
    // Extract relevant information
    const title = videoInfo.snippet.title || 'Untitled Video';
    const description = videoInfo.snippet.description || 'No description available';
    const channelTitle = videoInfo.snippet.channelTitle || 'Unknown Channel';
    const publishedAt = videoInfo.snippet.publishedAt 
      ? new Date(videoInfo.snippet.publishedAt).toLocaleDateString() 
      : 'Unknown date';
    
    // Format the summary based on language
    const language = options.language || 'en';
    
    let summary;
    if (language === 'he') {
      summary = `# ${title}\n\n`;
      summary += `ערוץ: ${channelTitle}\n`;
      summary += `פורסם: ${publishedAt}\n\n`;
      summary += `## תיאור\n\n`;
      summary += description;
    } else {
      summary = `# ${title}\n\n`;
      summary += `Channel: ${channelTitle}\n`;
      summary += `Published: ${publishedAt}\n\n`;
      summary += `## Description\n\n`;
      summary += description;
    }
    
    return {
      summary,
      pdfPath: null,
      method: 'api'
    };
  } catch (error) {
    console.error('Error in processYouTube:', error);
    throw error;
  }
}

// Helper function to get video info
async function getVideoInfo(videoId) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    console.log(`Fetching video info for video ID: ${videoId}`);
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`);
    
    if (!response.ok) {
      console.error(`YouTube API returned status: ${response.status}`);
      throw new Error(`YouTube API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.error('Video not found');
      throw new Error('Video not found');
    }
    
    console.log('Successfully retrieved video info');
    return data.items[0];
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
}

// Helper functions
async function downloadAudio(youtubeUrl) {
  try {
    console.log(`Downloading audio from ${youtubeUrl}...`);
    const audioPath = await downloadYouTubeAudio(youtubeUrl);
    console.log(`Audio downloaded to ${audioPath}`);
    return audioPath;
  } catch (error) {
    console.error("Error downloading audio:", error);
    throw error;
  }
}
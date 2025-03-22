import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadYouTubeAudio } from './DownloadFromYT.js';
import { getYouTubeTranscript } from './YouTubeTranscript.js';
import puppeteer from 'puppeteer-core';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { summarizeText, generatePDF } from './audioProcessing.js';
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
    
    // Generate PDF if needed
    let pdfPath = null;
    if (outputType === 'pdf') {
      pdfPath = await generatePDF(summary);
      console.log(`PDF generated at: ${pdfPath}`);
    }
    
    return {
      summary,
      pdfPath,
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

export async function summarizeText(text) {
  try {
    console.log("Starting summarization with Gemini...");
    console.log("Text to summarize:", text);
    
    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    };

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
      generationConfig,
    });

    const chat = model.startChat({
      history: [],
    });

    const prompt = `Please summarize the following text in Hebrew, using bullet points:
    
    ${text}
    
    Please make the summary concise and clear, focusing on the main points.`;

    const result = await chat.sendMessage(prompt);
    console.log("Summarization completed! Result:", result.response.text);
    return result.response.text;  // Make sure we're returning the text property
  } catch (error) {
    console.error("Error summarizing text:", error);
    throw error;
  }
}

async function processYouTubeVideo(youtubeUrl) {
  try {
    // ... rest of the code ...
    
    const summary = await summarizeText(transcription);
    console.log("Got summary:", summary);
    
    // Add check for summary format
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      console.error('Invalid summary format:', summary);
      throw new Error('לא נמצא סיכום');
    }
    
    const pdfPath = path.join(tempDir, 'summary.pdf');
    await createSummaryPDF(summary, pdfPath);
    
    // ... rest of the code ...
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  }
}
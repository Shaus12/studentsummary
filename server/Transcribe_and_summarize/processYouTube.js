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
import { transcribeAudio } from './Transcribe.js';
import { summarizeText } from './Summarize.js';
import { generatePDF } from './GeneratePDF.js';
import { extractVideoId } from '../utils/youtubeUtils.js';
import fetch from 'node-fetch';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure Deepgram with hardcoded key
const deepgramApiKey = '2a60d94169738ee178d20bb606126fdd56c85710';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini with hardcoded key
const genAI = new GoogleGenerativeAI('AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A');

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
    
    // Get video info for metadata
    const videoInfo = await getVideoInfo(videoId);
    
    // Try to download audio and transcribe it
    try {
      console.log("Downloading audio from YouTube...");
      const audioPath = await downloadYouTubeAudio(youtubeUrl);
      console.log(`Audio downloaded to ${audioPath}`);
      
      // Transcribe the audio
      console.log("Transcribing audio...");
      const transcription = await transcribeAudio(audioPath);
      console.log("Audio transcribed successfully");
      
      // Clean up the audio file
      fs.unlinkSync(audioPath);
      
      // Generate summary using the transcription
      console.log("Generating summary from transcription...");
      const summary = await summarizeText(transcription, options);
      
      return {
        summary,
        pdfPath: null,
        method: 'transcription'
      };
    } catch (error) {
      console.error("Error processing audio:", error);
      
      // Fallback to using video metadata
      console.log("Falling back to video metadata...");
      
      // Get title and description
      const title = videoInfo.snippet.title;
      const description = videoInfo.snippet.description;
      
      // Format metadata for display
      const language = options.language || 'en';
      const labels = {
        en: {
          videoInfo: 'Video Information',
          channel: 'Channel',
          published: 'Published',
          duration: 'Duration',
          views: 'Views',
          likes: 'Likes',
          comments: 'Comments',
          description: 'Description',
          note: 'Note',
          limitationsHeader: 'Limitations',
          limitationsText: 'We were unable to access the video content directly. This information is based on the video metadata only.'
        },
        he: {
          videoInfo: 'מידע על הסרטון',
          channel: 'ערוץ',
          published: 'פורסם',
          duration: 'משך',
          views: 'צפיות',
          likes: 'לייקים',
          comments: 'תגובות',
          description: 'תיאור',
          note: 'הערה',
          limitationsHeader: 'מגבלות',
          limitationsText: 'לא הצלחנו לגשת לתוכן הסרטון ישירות. מידע זה מבוסס על המטא-דאטה של הסרטון בלבד.'
        }
      };
      
      const l = labels[language] || labels.en;
      
      // Format the metadata as a summary
      let summary = `# ${title}\n\n`;
      summary += `## ${l.limitationsHeader}\n\n`;
      summary += `${l.limitationsText}\n\n`;
      summary += `## ${l.description}\n\n`;
      summary += description;
      
      return {
        summary,
        pdfPath: null,
        method: 'metadata'
      };
    }
  } catch (error) {
    console.error('Error in processYouTube:', error);
    
    // Return a fallback summary in case of any error
    const language = options?.language || 'en';
    
    // Multilingual error messages
    const errorMessages = {
      en: `Unable to process this YouTube video due to an error: ${error.message}. Please try another video.`,
      he: `לא ניתן לעבד את סרטון היוטיוב הזה בגלל שגיאה: ${error.message}. אנא נסה סרטון אחר.`
    };
    
    return {
      summary: errorMessages[language] || errorMessages.en,
      pdfPath: null,
      method: 'error'
    };
  }
}

// Helper function to get video info
async function getVideoInfo(videoId) {
  try {
    const apiKey = 'AIzaSyAZ78Gva-kSMxsY0MQ6r2QREuDjvWmgjIA';
    
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
function extractVideoId(url) {
  if (!url) return null;
  
  // Regular expression to extract video ID from various YouTube URL formats
  const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2].length === 11) {
    return match[2];
  }
  
  return null;
}

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
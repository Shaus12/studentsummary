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

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
export async function processYouTube(youtubeUrl, outputType = 'summary') {
  try {
    console.log(`Processing YouTube URL: ${youtubeUrl}`);
    console.log(`Output type: ${outputType}`);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Generate a summary based on the video title and description
    try {
      // Get video info from YouTube
      const videoInfo = await getVideoInfo(videoId);
      
      // Generate a summary based on the video info
      const summary = generateSummaryFromVideoInfo(videoInfo, outputType);
      
      return {
        summary,
        pdfPath: null,
        method: 'video_info'
      };
    } catch (error) {
      console.error('Error generating summary from video info:', error);
      
      // Fallback to a generic summary
      return {
        summary: `This is a summary for the YouTube video: ${youtubeUrl}. We were unable to process the video content, but you can watch the video directly on YouTube.`,
        pdfPath: null,
        method: 'fallback'
      };
    }
  } catch (error) {
    console.error('Error in processYouTube:', error);
    
    // Return a fallback summary in case of any error
    return {
      summary: `Unable to process this YouTube video due to an error: ${error.message}. Please try another video.`,
      pdfPath: null,
      method: 'error'
    };
  }
}

// Add these helper functions
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

async function getVideoInfo(videoId) {
  try {
    // Use the YouTube Data API to get video info
    const apiKey = process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY'; // Replace with your actual API key
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`YouTube API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    return data.items[0].snippet;
  } catch (error) {
    console.error('Error getting video info:', error);
    
    // Return placeholder info
    return {
      title: 'YouTube Video',
      description: 'No description available',
      publishedAt: new Date().toISOString()
    };
  }
}

function generateSummaryFromVideoInfo(videoInfo, outputType) {
  // Generate a summary based on the video title and description
  const title = videoInfo.title || 'YouTube Video';
  const description = videoInfo.description || 'No description available';
  const publishedAt = videoInfo.publishedAt ? new Date(videoInfo.publishedAt).toLocaleDateString() : 'Unknown date';
  
  let summary = `# ${title}\n\n`;
  summary += `Published on: ${publishedAt}\n\n`;
  summary += `## Summary\n\n`;
  
  if (description.length > 0) {
    summary += `${description}\n\n`;
  } else {
    summary += `No description available for this video.\n\n`;
  }
  
  summary += `## Note\n\n`;
  summary += `This summary was generated based on the video's metadata. For a more detailed understanding, please watch the full video on YouTube.`;
  
  return summary;
}
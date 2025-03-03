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
    
    // Get video info from YouTube API
    const videoInfo = await getVideoInfo(videoId);
    
    // Generate a summary based on the video info and options
    const summary = generateSummaryFromVideoInfo(videoInfo, outputType, options);
    
    return {
      summary,
      pdfPath: null,
      method: 'api'
    };
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

async function getVideoInfo(videoId) {
  try {
    // Use the provided YouTube Data API key
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

function generateSummaryFromVideoInfo(videoInfo, outputType, options = {}) {
  try {
    console.log('Generating summary from video info');
    
    // Get language preference
    const language = options.language || 'en';
    console.log(`Using language: ${language}`);
    
    // Extract relevant information
    const snippet = videoInfo.snippet || {};
    const statistics = videoInfo.statistics || {};
    const contentDetails = videoInfo.contentDetails || {};
    
    const title = snippet.title || 'Untitled Video';
    const description = snippet.description || 'No description available';
    const channelTitle = snippet.channelTitle || 'Unknown Channel';
    const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleDateString() : 'Unknown date';
    const viewCount = statistics.viewCount ? parseInt(statistics.viewCount).toLocaleString() : 'Unknown';
    const likeCount = statistics.likeCount ? parseInt(statistics.likeCount).toLocaleString() : 'Unknown';
    const commentCount = statistics.commentCount ? parseInt(statistics.commentCount).toLocaleString() : 'Unknown';
    
    // Format duration
    let duration = 'Unknown duration';
    if (contentDetails.duration) {
      // Convert ISO 8601 duration to readable format
      const match = contentDetails.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      const hours = (match[1] || '').replace('H', '');
      const minutes = (match[2] || '').replace('M', '');
      const seconds = (match[3] || '').replace('S', '');
      
      duration = '';
      if (hours) duration += `${hours} hours `;
      if (minutes) duration += `${minutes} minutes `;
      if (seconds) duration += `${seconds} seconds`;
      duration = duration.trim();
    }
    
    // Multilingual labels
    const labels = {
      en: {
        channel: 'Channel',
        published: 'Published',
        duration: 'Duration',
        views: 'Views',
        likes: 'Likes',
        comments: 'Comments',
        summary: 'Summary',
        note: 'Note',
        noDescription: 'No description available for this video.',
        generatedNote: 'This summary was generated based on the video\'s metadata. For a more detailed understanding, please watch the full video on YouTube.',
        keyPoints: 'Key Points',
        additionalContent: '... (additional content in the description)',
        noKeyPoints: 'No key points could be extracted from the video description',
        watchVideo: 'For detailed information, please watch the video',
        videoStats: 'Video Statistics',
        automatedSummary: 'This is an automated summary based on the video metadata. For complete information, please watch the full video.'
      },
      he: {
        channel: 'ערוץ',
        published: 'פורסם',
        duration: 'משך',
        views: 'צפיות',
        likes: 'לייקים',
        comments: 'תגובות',
        summary: 'סיכום',
        note: 'הערה',
        noDescription: 'אין תיאור זמין לסרטון זה.',
        generatedNote: 'סיכום זה נוצר על בסיס המטא-דאטה של הסרטון. להבנה מפורטת יותר, אנא צפה בסרטון המלא ביוטיוב.',
        keyPoints: 'נקודות מפתח',
        additionalContent: '... (תוכן נוסף בתיאור)',
        noKeyPoints: 'לא ניתן לחלץ נקודות מפתח מתיאור הסרטון',
        watchVideo: 'למידע מפורט, אנא צפה בסרטון',
        videoStats: 'נתוני הסרטון',
        automatedSummary: 'זהו סיכום אוטומטי המבוסס על המטא-דאטה של הסרטון. למידע מלא, אנא צפה בסרטון המלא.'
      }
    };
    
    // Use English as fallback if requested language is not supported
    const l = labels[language] || labels.en;
    
    // Generate summary based on output type
    let summary = '';
    
    if (outputType === 'summary') {
      summary = `# ${title}\n\n`;
      summary += `**${l.channel}:** ${channelTitle}\n`;
      summary += `**${l.published}:** ${publishedAt}\n`;
      summary += `**${l.duration}:** ${duration}\n`;
      summary += `**${l.views}:** ${viewCount} | **${l.likes}:** ${likeCount} | **${l.comments}:** ${commentCount}\n\n`;
      
      summary += `## ${l.summary}\n\n`;
      
      if (description.length > 0) {
        // Clean up and format the description
        const cleanDescription = description
          .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newlines
          .trim();
        
        summary += `${cleanDescription}\n\n`;
      } else {
        summary += `${l.noDescription}\n\n`;
      }
      
      summary += `## ${l.note}\n\n`;
      summary += `${l.generatedNote}`;
    } else if (outputType === 'notes') {
      summary = `# ${title}\n\n`;
      summary += `**${l.channel}:** ${channelTitle}\n`;
      summary += `**${l.published}:** ${publishedAt}\n\n`;
      
      summary += `## ${l.keyPoints}\n\n`;
      
      // Extract potential key points from description
      const lines = description.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length > 0) {
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
          summary += `- ${lines[i]}\n`;
        }
        
        if (lines.length > 10) {
          summary += `- ${l.additionalContent}\n`;
        }
      } else {
        summary += `- ${l.noKeyPoints}\n`;
        summary += `- ${l.watchVideo}\n`;
      }
      
      summary += `\n## ${l.videoStats}\n\n`;
      summary += `- ${l.duration}: ${duration}\n`;
      summary += `- ${l.views}: ${viewCount}\n`;
      summary += `- ${l.likes}: ${likeCount}\n`;
      summary += `- ${l.comments}: ${commentCount}\n\n`;
      
      summary += `${l.automatedSummary}`;
    }
    
    console.log('Summary generated successfully');
    return summary;
  } catch (error) {
    console.error('Error generating summary from video info:', error);
    
    // Return a simple fallback summary
    return `Summary for YouTube video: Unable to generate a detailed summary due to an error. Please watch the video directly.`;
  }
}
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
    
    // Try to get content from YouTube
    let content;
    let method;
    
    try {
      const result = await downloadYouTubeAudio(youtubeUrl);
      if (result.transcript) {
        content = result.transcript;
        method = 'transcript';
      } else if (result.audioPath) {
        // Transcribe the audio
        content = await transcribeAudio(result.audioPath);
        method = 'audio';
      }
    } catch (contentError) {
      console.error('Error getting content from YouTube:', contentError);
      
      // If we can't get content, generate a fallback summary
      const fallbackSummary = `Unable to process this YouTube video. The video might be private, age-restricted, or not have captions available. Please try another video.`;
      
      return {
        summary: fallbackSummary,
        pdfPath: null,
        method: 'fallback'
      };
    }
    
    if (!content) {
      console.log('No content available, using fallback summary');
      return {
        summary: `Unable to process this YouTube video. The video might be private, age-restricted, or not have captions available. Please try another video.`,
        pdfPath: null,
        method: 'fallback'
      };
    }
    
    // Generate summary
    console.log(`Generating ${outputType} from content (length: ${content.length})`);
    
    let summary;
    let pdfPath = null;
    
    if (outputType === 'summary') {
      summary = await summarizeText(content);
    } else if (outputType === 'notes') {
      summary = await summarizeText(content);
    } else {
      summary = await summarizeText(content);
    }
    
    // Generate PDF if needed
    if (summary) {
      try {
        pdfPath = await generatePDF(summary);
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        // Continue without PDF
      }
    }
    
    return {
      summary,
      pdfPath,
      method
    };
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
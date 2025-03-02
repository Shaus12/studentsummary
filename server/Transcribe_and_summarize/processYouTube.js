import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadYouTubeAudio } from './DownloadFromYT.js';
import { getYouTubeTranscript } from './YouTubeTranscript.js';
import 'dotenv/config';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import other necessary modules
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';

// Configure Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    const browser = await puppeteer.launch({ headless: true });
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
    
    // Process the YouTube video with our hybrid approach
    const audioPath = path.join(__dirname, '..', 'temp', 'audio.mp3');
    const result = await downloadYouTubeAudio(youtubeUrl, audioPath);
    
    let text;
    
    if (result.method === 'download') {
      // If we successfully downloaded the audio, transcribe it
      console.log('Audio downloaded successfully, transcribing...');
      text = await transcribeAudio(result.outputPath);
    } else if (result.method === 'transcript') {
      // If we used the transcript API, use the transcript directly
      console.log('Using transcript directly...');
      text = result.transcript;
    }
    
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
    
    return {
      method: result.method,
      summary: output,
      pdfPath: pdfPath
    };
  } catch (error) {
    console.error('Error in processYouTube:', error);
    throw error;
  }
}
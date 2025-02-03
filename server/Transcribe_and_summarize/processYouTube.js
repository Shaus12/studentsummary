import 'dotenv/config';
import downloadAudio from './DownloadFromYT.js';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configure Deepgram with increased timeout
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey, {
  timeoutMs: 120000,  // 2 minutes timeout
});

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Then verify the API key is loaded
console.log('Deepgram API Key:', process.env.DEEPGRAM_API_KEY ? 'Found' : 'Not found');

// Add retry logic
async function retryWithDelay(fn, retries = 3, delay = 5000) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.log(`Retrying... ${retries} attempts left`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithDelay(fn, retries - 1, delay);
  }
}

export async function transcribeAudio(filePath) {
  try {
    console.log("Starting transcription with Deepgram...");
    
    const audioFile = readFileSync(filePath);
    console.log(`Audio file size: ${audioFile.length} bytes`);
    
    const transcribeFunction = async () => {
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioFile,
        {
          model: 'whisper',
          language: 'he',
          smart_format: true,
        }
      );

      if (error) {
        console.error('Deepgram error details:', error);
        throw new Error('Deepgram transcription failed: ' + error);
      }

      return result;
    };

    const result = await retryWithDelay(transcribeFunction);
    const transcript = result.results.channels[0].alternatives[0].transcript;
    console.log("Transcription completed! Content:", transcript);
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Empty transcription received');
    }
    
    return transcript;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

export async function summarizeText(text, summaryType = 'medium') {
  try {
    console.log("Starting summarization with Gemini...");
    console.log("Summary type:", summaryType);
    
    const summaryTypes = {
      'transcription': 'תמלל את הטקסט הבא בעברית בדיוק כפי שהוא, בלי לסכם:',
      'extended': 'סכם את הטקסט הבא בעברית באופן מורחב ומפורט, כולל דוגמאות ונקודות משנה:',
      'medium': 'סכם את הטקסט הבא בעברית באופן בינוני, עם הנקודות העיקריות:',
      'general': 'תן סיכום כללי בעברית של הטקסט הבא, התמקד ברעיונות המרכזיים:',
      'short': 'תן סיכום קצר וממוקד בעברית של הטקסט הבא, רק את הנקודות החשובות ביותר:'
    };

    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: summaryType === 'transcription' ? 16384 : 8192,
    };

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
      generationConfig,
    });

    const prompt = `${summaryTypes[summaryType]}
    
    ${text}
    
    אנא הצג את התוצאה בנקודות עם סימן • בתחילת כל שורה.`;

    const result = await model.generateContent(prompt);
    
    const summary = result.response.candidates[0].content.parts.map(part => part.text).join(' ');
    console.log("Raw Gemini response:", result.response);
    console.log("Summarization completed! Result:", summary);
    
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      throw new Error('Invalid summary format received from Gemini');
    }
    
    return summary;
  } catch (error) {
    console.error("Error summarizing text:", error);
    throw error;
  }
}

export async function createSummaryPDF(summary, outputPath) {
  try {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              direction: rtl;
            }
            h1 {
              color: #333;
              text-align: right;
            }
            .summary {
              line-height: 1.6;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <h1>סיכום הקלטה</h1>
          <div class="summary">
            ${summary}
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    await browser.close();
  } catch (error) {
    console.error('Error creating PDF:', error);
    throw error;
  }
}

export async function processYouTubeVideo(youtubeUrl, summaryType = 'medium') {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    console.log(`Summary type requested: ${summaryType}`);
    
    const shortsPattern = /\/shorts\//;
    if (shortsPattern.test(youtubeUrl)) {
      youtubeUrl = youtubeUrl.replace('/shorts/', '/watch?v=');
    }
    
    const tempDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const audioPath = await downloadAudio(youtubeUrl);
    console.log("Audio downloaded to:", audioPath);
    
    const transcription = await transcribeAudio(audioPath);
    console.log("Got transcription:", transcription);
    
    const summary = await summarizeText(transcription, summaryType);
    console.log("Got summary:", summary);
    
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      console.error('Invalid summary format:', summary);
      throw new Error('לא נמצא סיכום');
    }
    
    const pdfPath = path.join(tempDir, 'summary.pdf');
    await createSummaryPDF(summary, pdfPath);
    
    await fs.unlink(audioPath);
    
    return {
      summary: summary,
      pdfPath: '/files/summary.pdf'
    };
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  }
}

export default processYouTubeVideo;
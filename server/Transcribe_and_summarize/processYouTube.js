import downloadAudio from './DownloadFromYT.js';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const execAsync = promisify(exec);

const openai = new OpenAI({ apiKey: "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" });

export async function transcribeAudio(filePath) {
  try {
    console.log("Starting transcription with Whisper Small...");
    console.log(`Running Whisper command: whisper "${filePath}" --model small --language he --output_dir "${path.dirname(filePath)}"`);
    
    const { stdout, stderr } = await execAsync(`whisper "${filePath}" --model small --language he --output_dir "${path.dirname(filePath)}"`);
    
    if (stderr) {
      console.error("Whisper Error:", stderr);
    }

    const transcriptPath = filePath.replace(/\.mp3$/, ".txt");
    console.log("Looking for transcript at:", transcriptPath);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await fs.access(transcriptPath);
      const hebrewTranscript = await fs.readFile(transcriptPath, 'utf8');
      console.log("Successfully read transcript file");

      await fs.unlink(transcriptPath);

      console.log("Transcription completed!");
      return hebrewTranscript;
    } catch (err) {
      console.error("Could not find transcript file. Available files in directory:");
      const files = await fs.readdir(path.dirname(filePath));
      console.log(files);
      throw new Error(`Transcript file not found at ${transcriptPath}`);
    }
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

export async function summarizeText(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "user", content: `Summarize the following text in Hebrew with bulletpoints:\n\n${text}` },
      ],
      max_tokens: 1000,
      temperature: 0.5,
    });
    return response.choices[0].message.content.trim();
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

async function processYouTubeVideo(youtubeUrl) {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    
    const shortsPattern = /\/shorts\//;
    if (shortsPattern.test(youtubeUrl)) {
      youtubeUrl = youtubeUrl.replace('/shorts/', '/watch?v=');
    }
    
    const tempDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const audioPath = await downloadAudio(youtubeUrl);
    const transcription = await transcribeAudio(audioPath);
    const summary = await summarizeText(transcription);
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
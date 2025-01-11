import downloadAudio from './DownloadFromYT.js';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import puppeteer from 'puppeteer';

const execAsync = promisify(exec);

const openAiApiKey = "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";
const openai = new OpenAI({ apiKey: openAiApiKey });

async function transcribeAudio(filePath) {
  try {
    console.log("Starting transcription with Whisper Small...");
    console.log(`Running Whisper command: whisper "${filePath}" --model small --language he --output_dir "${path.dirname(filePath)}"`);
    
    const { stdout, stderr } = await execAsync(`whisper "${filePath}" --model small --language he --output_dir "${path.dirname(filePath)}"`);
    
    if (stderr) {
      console.error("Whisper Error:", stderr);
    }

    // The transcript file will have the same name as the audio file but with .txt extension
    const transcriptPath = filePath.replace(/\.mp3$/, ".txt");
    console.log("Looking for transcript at:", transcriptPath);
    
    // Wait a moment to ensure the file is written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await fs.access(transcriptPath); // Check if the file exists
      const hebrewTranscript = await fs.readFile(transcriptPath, 'utf8');
      console.log("Successfully read transcript file");

      // Clean up the transcript file
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

async function summarizeText(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "user", content: `Summarize the following text in Hebrew with bulletpoints:\n\n${text}` },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error summarizing text:", error);
    throw error;
  }
}

// Add this function to create PDF
async function createSummaryPDF(summary, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Create HTML content with proper Hebrew support
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 40px;
                direction: rtl;
            }
            h1 {
                text-align: center;
                margin-bottom: 30px;
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
            ${summary.replace(/\n/g, '<br>')}
        </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    }
  });

  await browser.close();
}

async function processYouTubeVideo(youtubeUrl) {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    
    // Step 1: Download audio from YouTube
    console.log("Downloading audio from YouTube...");
    const audioPath = await downloadAudio(youtubeUrl);
    
    // Step 2: Transcribe the audio
    console.log("Transcribing audio...");
    const transcription = await transcribeAudio(audioPath);
    
    // Step 3: Summarize content
    console.log("Summarizing content...");
    const summary = await summarizeText(transcription);
    
    // Step 4: Create PDF
    const pdfPath = path.join(path.dirname(audioPath), 'summary.pdf');
    await createSummaryPDF(summary, pdfPath);
    console.log(`PDF summary created at: ${pdfPath}`);
    
    // Clean up: Delete the audio file
    await fs.unlink(audioPath);
    
    console.log("הנה הסיכום שלך:", summary);
    
    return {
      summary: summary,
      pdfPath: pdfPath
    };
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  }
}

// Example usage (you can comment this out when importing the function)
const youtubeUrl = "https://www.youtube.com/watch?v=HQ3yZ2es_Ts";
processYouTubeVideo(youtubeUrl)
  .then(result => console.log("Process completed successfully!"))
  .catch(error => console.error("Process failed:", error));

export default processYouTubeVideo; 
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec
const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the API key (first few characters) to verify it's loaded
console.log(`Deepgram API key (first 5 chars): ${process.env.DEEPGRAM_API_KEY?.substring(0, 5)}...`);

// Configure Deepgram with the API key from .env
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
console.log(`Using Deepgram API key: ${deepgramApiKey?.substring(0, 5)}...`);

// Create the Deepgram client with the correct initialization
const deepgram = createClient(deepgramApiKey);

// Configure Gemini with the API key from .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Convert audio file to a format Deepgram can handle
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<string>} - Path to the converted file
 */
async function convertAudioFile(filePath) {
  try {
    // Create output path with mp3 extension (Whisper was trained on mp3 files)
    const outputPath = filePath.replace(/\.[^/.]+$/, '') + '_converted.mp3';
    
    console.log(`Converting audio file from ${filePath} to ${outputPath}`);
    
    // Use ffmpeg to normalize and convert the audio
    await execAsync(`ffmpeg -y -i "${filePath}" -af "loudnorm=I=-16:LRA=11:TP=-1.5" -ar 16000 -ac 1 "${outputPath}"`);
    
    console.log(`Converted audio file to: ${outputPath}`);
    
    // Verify the file exists and has content
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error(`Conversion failed: Output file ${outputPath} does not exist or is empty`);
    }
    
    return outputPath;
  } catch (error) {
    console.error("Error converting audio file:", error);
    throw error;
  }
}

/**
 * Clean up a file
 * @param {string} filePath - Path to the file to clean up
 */
async function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error);
  }
}

/**
 * Upload file to a temporary storage service
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - URL to the uploaded file
 */
async function uploadFileToTemporaryStorage(filePath) {
  try {
    // For this example, we'll use a mock implementation
    // In a real application, you would upload to a service like AWS S3, Google Cloud Storage, etc.
    console.log(`Would upload ${filePath} to temporary storage`);
    
    // Return a mock URL
    return `https://example.com/temp/${path.basename(filePath)}`;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

/**
 * Transcribe audio file using Deepgram
 * @param {string} filePath - Path to audio file
 * @returns {Promise<string>} - Transcription text
 */
export async function transcribeAudio(filePath) {
  let convertedFilePath = null;
  
  try {
    console.log(`Transcribing audio file: ${filePath}`);
    console.log(`Using Deepgram API key: ${deepgramApiKey?.substring(0, 5)}...`);
    
    // Convert the audio file to a format Deepgram can handle
    convertedFilePath = await convertAudioFile(filePath);
    
    // Read the converted audio file
    const audioFile = fs.readFileSync(convertedFilePath);
    console.log(`Converted file size: ${audioFile.length} bytes`);
    
    // Configure Deepgram options for Whisper with Hebrew
    const options = {
      smart_format: true,
      model: "whisper",
      diarize: true,
      utterances: true,
      punctuate: true,
      language: 'he'
    };
    
    console.log(`Sending request to Deepgram with options:`, options);
    
    // Send to Deepgram for transcription
    const response = await deepgram.listen.prerecorded.transcribeFile(
      { buffer: audioFile, mimetype: 'audio/mp3' },
      options
    );
    
    console.log(`Deepgram response:`, JSON.stringify(response).substring(0, 200) + '...');
    
    // Clean up the converted file
    await cleanupFile(convertedFilePath);
    
    // Check if response is valid
    if (!response || !response.results) {
      console.error('Invalid Deepgram response:', response);
      return "לא ניתן היה לתמלל את הקובץ. אנא ודא שהקובץ תקין ונסה שוב.";
    }
    
    // Extract transcript
    const transcript = response.results.channels[0].alternatives[0].transcript;
    console.log(`Transcription complete, length: ${transcript.length}`);
    
    return transcript;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    
    // Clean up the converted file if it exists
    if (convertedFilePath) {
      await cleanupFile(convertedFilePath);
    }
    
    return "אירעה שגיאה בתמלול הקובץ. אנא נסה שוב מאוחר יותר.";
  }
}

// Function to summarize text
export async function summarizeText(text) {
  try {
    console.log(`Summarizing text of length: ${text.length}`);
    
    // Use Gemini to summarize
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
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
    return "אירעה שגיאה בסיכום הטקסט. אנא נסה שוב מאוחר יותר.";
  }
}

// Function to generate PDF
export async function generatePDF(content) {
  try {
    console.log('Generating PDF...');
    
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const outputPath = path.join(tempDir, `summary_${Date.now()}.pdf`);
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(`
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              direction: rtl;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <pre>${content}</pre>
        </body>
      </html>
    `);
    
    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px'
      }
    });
    
    await browser.close();
    
    console.log(`PDF generated at: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
} 
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Deepgram with the correct API key
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || '26e3b5fc5fd1451123c9c799ede5d211ff94fce9';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini with the correct API key and model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A');

/**
 * Transcribe audio file using Deepgram
 * @param {string} filePath - Path to audio file
 * @returns {Promise<string>} - Transcription text
 */
export async function transcribeAudio(filePath) {
  try {
    console.log(`Transcribing audio file: ${filePath}`);
    
    // Read the audio file
    const audioFile = fs.readFileSync(filePath);
    
    // Configure Deepgram options
    const options = {
      smart_format: true,
      model: "whisper-large",
      diarize: true,
      utterances: true,
      punctuate: true,
      language: 'he'
    };
    
    // Send to Deepgram for transcription
    const response = await deepgram.listen.prerecorded.transcribeFile(
      { buffer: audioFile, mimetype: 'audio/mp3' },
      options
    );
    
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
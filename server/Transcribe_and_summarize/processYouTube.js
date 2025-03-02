import 'dotenv/config';
import downloadAudio from './DownloadFromYT.js';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { downloadYouTubeAudio } from './DownloadFromYT.js';
import { transcribeAudio } from './TranscribeAudio.js';
import { summarizeText } from './SummarizeText.js';
import { generatePDF } from './GeneratePDF.js';

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

export async function summarizeText(text, summaryOptions = {}) {
  try {
    console.log("Starting summarization with Gemini...");
    console.log("Text to summarize:", text);
    
    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    };

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
      generationConfig,
    });

    // Default summary instructions
    const defaultInstructions = [
      "יש להשתמש בעברית בלבד, למעט שמות פרטיים, מונחים טכניים או שמות של טכנולוגיות שאין להם תרגום מקובל לעברית",
      "יש לכתוב כל נקודה עיקרית עם תבליט (•) בתחילתה",
      "לכל נקודה עיקרית יש להוסיף 2-3 פרטים ספציפיים או דוגמאות",
      "יש לשמור על סדר כרונולוגי של הדברים כפי שהוצגו בטקסט המקורי",
      "יש לכלול מספרים, שמות ונתונים מדויקים שהוזכרו"
    ];

    // Merge default options with user options
    const {
      style = 'detailed', // 'detailed' or 'concise'
      format = 'bullets', // 'bullets' or 'paragraphs'
      additionalInstructions = [],
      maxPoints = 10, // maximum number of main points
      language = 'he' // 'he' for Hebrew or 'en' for English
    } = summaryOptions;

    // Build custom instructions based on options
    let customInstructions = [...defaultInstructions, ...additionalInstructions];
    
    if (style === 'concise') {
      customInstructions.push(`יש להגביל את הסיכום ל-${maxPoints} נקודות עיקריות`);
    }

    if (format === 'paragraphs') {
      customInstructions = customInstructions.filter(inst => !inst.includes('תבליט'));
      customInstructions.push('יש לכתוב את הסיכום בפסקאות קצרות ומובנות');
    }

    const prompt = `אנא סכם את הטקסט הבא ${language === 'he' ? 'בעברית' : 'באנגלית'} באופן ${style === 'detailed' ? 'מפורט' : 'תמציתי'}:

    ${text}
    
    הנחיות לסיכום:
    ${customInstructions.map((inst, index) => `${index + 1}. ${inst}`).join('\n')}
    
    אנא הקפד על סיכום ${style === 'detailed' ? 'מפורט' : 'תמציתי'} ומדויק תוך שמירה על בהירות המידע.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.candidates[0].content.parts.map(part => part.text).join(' ');
    
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
    // Convert the summary text into HTML with line breaks and bullet points
    const formattedSummary = summary
      .split('•')
      .map(point => point.trim())
      .filter(point => point.length > 0)
      .map(point => `<li>${point}</li>`)
      .join('\n');  // Add newline for better readability

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
            ul {
              list-style-type: disc;
              padding-right: 20px;
              margin: 0;
              padding: 0;
            }
            li {
              margin-bottom: 10px;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <h1>סיכום הקלטה</h1>
          <div class="summary">
            <ul>
              ${formattedSummary}
            </ul>
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });  // Use 'domcontentloaded' to ensure content is loaded
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    await browser.close();
  } catch (error) {
    console.error('Error creating PDF:', error);
    throw error;
  }
}

async function processYouTubeVideo(youtubeUrl, { outputType = 'summary', summaryOptions = {} } = {}) {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    console.log('Output Type:', outputType);
    
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
    
    // If only transcription is requested, return it without summarizing
    if (outputType === 'transcription') {
      const pdfPath = path.join(tempDir, 'transcription.pdf');
      await createTranscriptionPDF(transcription, pdfPath);
      
      await fs.unlink(audioPath);
      
      return {
        summary: transcription, // Using the same field for consistency
        pdfPath: '/files/transcription.pdf'
      };
    }
    
    // If summary is requested, proceed with summarization
    const summary = await summarizeText(transcription, summaryOptions);
    console.log("Got summary:", summary);
    
    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
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

// Add a new function to create PDF for transcription
async function createTranscriptionPDF(transcription, outputPath) {
  try {
    // Use the same formatting logic as the summary
    const formatTranscription = (text) => {
      return text
        .replace(/([.!?])\s*/g, '$1\n\n') // Add double line break after sentences
        .replace(/([,:])\s*/g, '$1 ')    // Add space after commas and colons
        .split('\n')
        .filter(line => line.trim())
        .join('\n\n');
    };

    const formattedTranscription = formatTranscription(transcription);

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
              line-height: 1.8;
              font-size: 16px;
              color: #333;
            }
            h1 {
              color: #1a1a1a;
              text-align: center;
              margin-bottom: 40px;
              font-size: 28px;
              border-bottom: 2px solid #eee;
              padding-bottom: 20px;
            }
            .transcription-container {
              max-width: 800px;
              margin: 0 auto;
              background-color: #ffffff;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            }
            .transcription {
              text-align: right;
              white-space: pre-wrap;
              padding: 20px;
              background-color: #f8f9fa;
              border-radius: 8px;
              line-height: 1.8;
            }
            .paragraph {
              margin-bottom: 24px;
              text-align: justify;
              padding: 10px;
              background-color: white;
              border-radius: 6px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            .paragraph:last-child {
              margin-bottom: 0;
            }
            @media print {
              body {
                margin: 20mm;
              }
              .transcription-container {
                box-shadow: none;
              }
              .paragraph {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="transcription-container">
            <h1>תמלול הקלטה</h1>
            <div class="transcription">
              ${formattedTranscription.split('\n\n').map(paragraph => 
                paragraph.trim() ? `<div class="paragraph">${paragraph}</div>` : ''
              ).join('')}
            </div>
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%;">
          <span class="pageNumber"></span> מתוך <span class="totalPages"></span>
        </div>
      `,
      footerHeight: '30mm'
    });
    await browser.close();
  } catch (error) {
    console.error('Error creating transcription PDF:', error);
    throw error;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function processYouTube(youtubeUrl, outputType) {
  try {
    console.log('Processing YouTube video:', youtubeUrl);
    console.log('Output Type:', outputType);

    // Process the YouTube video with our hybrid approach
    const result = await downloadYouTubeAudio(youtubeUrl, path.join(__dirname, '..', 'temp', 'audio.mp3'));
    
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

    console.log('Text obtained, length:', text?.length);

    // Generate summary or notes based on the output type
    let output;
    if (outputType === 'summary') {
      output = await summarizeText(text);
    } else if (outputType === 'notes') {
      // Import generateNotes only if needed
      try {
        const notesModule = await import('./GenerateNotes.js');
        output = await notesModule.generateNotes(text);
      } catch (error) {
        console.error('Error importing GenerateNotes.js, falling back to summary:', error);
        output = await summarizeText(text);
      }
    } else {
      output = await summarizeText(text);
    }

    console.log('Output generated, length:', output?.length);

    // Generate PDF
    const pdfPath = await generatePDF(output);
    console.log('PDF generated at:', pdfPath);
    
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

export default processYouTubeVideo;
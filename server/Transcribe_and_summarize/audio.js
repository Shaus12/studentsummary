import { createClient } from '@deepgram/sdk';
import fs from 'fs';
import { summarizeText } from './utils.js';

// Configure Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || '26e3b5fc5fd1451123c9c799ede5d211ff94fce9';
const deepgram = createClient(deepgramApiKey);

/**
 * Transcribes audio file using Deepgram
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudio(audioPath) {
  try {
    console.log(`Transcribing audio file: ${audioPath}`);
    
    const audioFile = fs.readFileSync(audioPath);
    
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

/**
 * Processes uploaded audio/video file
 * @param {string} filePath - Path to audio/video file
 * @param {string} outputType - Output type (summary or pdf)
 * @returns {Promise<object>} - Result object with summary and PDF path
 */
export async function processUploadedFile(filePath, outputType = 'summary') {
  try {
    console.log(`Processing uploaded file: ${filePath}`);
    
    // Step 1: Transcribe the audio
    const transcription = await transcribeAudio(filePath);

    // Step 2: Break transcription into chunks
    const words = transcription.split(" ");
    const chunkSize = 1500;
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    // Step 3: Summarize each chunk
    const summaries = [];
    for (const [index, chunk] of chunks.entries()) {
      console.log(`Summarizing chunk ${index + 1}/${chunks.length}...`);
      const summary = await summarizeText(chunk);
      summaries.push(summary);
    }

    // Step 4: Combine all summaries into a final summary
    const finalSummary = await summarizeText(summaries.join(" "));
    console.log("הנה הסיכום שלך:", finalSummary);

    // Step 5: Generate PDF if requested
    let pdfPath = null;
    if (outputType === 'pdf') {
      const { generatePDF } = await import('./pdf.js');
      pdfPath = await generatePDF(finalSummary);
    }

    return {
      summary: finalSummary,
      pdfPath,
      method: 'upload'
    };
  } catch (error) {
    console.error("Error processing and summarizing:", error);
    throw error;
  }
} 
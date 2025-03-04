import fs from 'fs';
import path from 'path';
import { createClient } from '@deepgram/sdk';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { cleanupFile } from './utils.js';
import { summarizeText } from './utils.js';
import { exec } from 'child_process';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Initialize Deepgram client with the new SDK format
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey);

const execPromise = promisify(exec);

/**
 * Convert audio file to a format Deepgram can handle
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<string>} - Path to the converted file
 */
async function convertAudioFile(filePath) {
  try {
    // Create output path with flac extension (FLAC often works well with speech recognition)
    const outputPath = path.join(
      path.dirname(filePath),
      `${path.basename(filePath, path.extname(filePath))}_converted.flac`
    );
    
    console.log(`Converting audio file from ${filePath} to ${outputPath}`);
    
    // Use ffmpeg to convert the file to FLAC format
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .audioCodec('flac')
        .audioChannels(1)         // Mono
        .audioFrequency(16000)    // 16kHz sampling rate (good for speech)
        .format('flac')           // FLAC format
        .on('error', (err) => {
          console.error('Error in ffmpeg conversion:', err);
          reject(err);
        })
        .on('end', () => {
          console.log(`Converted audio file to: ${outputPath}`);
          resolve(outputPath);
        })
        .save(outputPath);
    });
  } catch (error) {
    console.error("Error converting audio file:", error);
    // If conversion fails, return the original file path
    return filePath;
  }
}

/**
 * Transcribe audio file using Deepgram with Whisper Large model
 * @param {string} audioPath - Path to audio file
 * @param {object} options - Transcription options
 * @returns {Promise<object>} - Transcription response
 */
export async function transcribeAudio(filePath, language = 'auto') {
  try {
    console.log(`Transcribing audio file: ${filePath} with language: ${language}`);
    
    // Convert audio to a format Deepgram can handle
    const convertedFilePath = await convertAudioFile(filePath);
    
    // Read the audio file
    const audioFile = await fs.promises.readFile(convertedFilePath);
    
    // Configure Deepgram options with Whisper Large model
    const options = {
      smart_format: true,
      model: "whisper",  // Use Whisper Large model
      diarize: true,
      utterances: true,
      punctuate: true,
      language: 'he'  // Always use Hebrew language
    };
    
    // If language is specifically set, override the default
    if (language && language !== 'auto' && language !== 'he') {
      options.language = language;
    }
    
    console.log(`Sending request to Deepgram with options:`, options);
    
    // Use the new SDK format
    // Create a source from the audio buffer
    const source = {
      buffer: audioFile,
      mimetype: 'audio/flac'  // Changed to FLAC
    };
    
    // Send to Deepgram for transcription using the new format
    const response = await deepgram.listen.prerecorded.transcribeFile(source, options);
    
    // Clean up the converted file
    await cleanupFile(convertedFilePath);
    
    console.log(`Deepgram response:`, JSON.stringify(response));
    
    return response;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Process uploaded audio file
 * @param {string} filePath - Path to uploaded audio file
 * @param {object} options - Processing options
 * @returns {Promise<object>} - Processing result
 */
export const processAudioFile = async (filePath, options = {}) => {
  try {
    console.log(`Processing uploaded audio file: ${filePath}`);
    
    // Transcribe the audio
    const transcription = await transcribeAudio(filePath, options.language || 'auto');
    
    // Return the transcription or summary based on options
    if (options.outputType === 'transcription') {
      return {
        transcription,
        success: true
      };
    } else if (options.outputType === 'summary') {
      // Generate summary
      const summary = await summarizeText(transcription.transcript, options.summaryOptions || {});
      
      return {
        summary,
        transcription: options.includeTranscription ? transcription.transcript : undefined,
        success: true
      };
    } else {
      throw new Error('Invalid output type specified');
    }
  } catch (error) {
    console.error('Error processing audio file:', error);
    throw new Error(`Failed to process audio file: ${error.message}`);
  }
};

/**
 * Processes uploaded audio/video file
 * @param {string} filePath - Path to audio/video file
 * @param {object} options - Processing options
 * @returns {Promise<object>} - Result object with summary and PDF path
 */
export async function processUploadedFile(filePath, options = {}) {
  try {
    console.log(`Processing uploaded file: ${filePath}`);
    
    // Step 1: Transcribe the audio
    let transcriptionResponse;
    try {
      transcriptionResponse = await transcribeAudio(filePath, options.language || 'auto');
      
      // Check if there was an error in the response
      if (transcriptionResponse.error || !transcriptionResponse.results) {
        console.log("Deepgram returned an error, using fallback");
        transcriptionResponse = await fallbackTranscription(filePath);
      }
    } catch (error) {
      console.error('Transcription failed, using fallback:', error);
      transcriptionResponse = await fallbackTranscription(filePath);
    }

    // Step 2: Extract transcript from the response
    let transcript = '';
    try {
      // Try to extract transcript from the response format
      transcript = transcriptionResponse.results?.channels[0]?.alternatives[0]?.transcript || '';
      
      console.log(`Extracted transcript of length: ${transcript.length}`);
    } catch (error) {
      console.error('Error extracting transcript from response:', error);
      transcript = "לא ניתן היה לתמלל את הקובץ. אנא ודא שהקובץ תקין ונסה שוב.";
    }
    
    // If transcript is empty, use a fallback message
    if (!transcript || transcript.trim().length === 0) {
      transcript = "לא ניתן היה לתמלל את הקובץ. אנא ודא שהקובץ תקין ונסה שוב.";
    }

    // Step 3: Break transcription into chunks
    const words = transcript.split(" ");
    const chunkSize = 1500;
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    // Step 4: Summarize each chunk
    const summaries = [];
    for (const [index, chunk] of chunks.entries()) {
      console.log(`Summarizing chunk ${index + 1}/${chunks.length}...`);
      const summary = await summarizeText(chunk, options);
      summaries.push(summary);
    }

    // Step 5: Combine all summaries into a final summary
    let finalSummary = '';
    if (summaries.length > 0) {
      finalSummary = await summarizeText(summaries.join(" "), options);
    } else {
      finalSummary = "לא ניתן היה לסכם את הקובץ. אנא ודא שהקובץ תקין ונסה שוב.";
    }
    
    console.log("הנה הסיכום שלך:", finalSummary);

    // Step 6: Generate PDF if requested
    let pdfPath = null;
    if (options.outputType === 'pdf') {
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
    return {
      summary: "אירעה שגיאה בעיבוד הקובץ. אנא נסה שוב מאוחר יותר.",
      method: 'upload'
    };
  }
}

/**
 * Fallback transcription method when Deepgram fails
 * @param {string} filePath - Path to audio file
 * @returns {Promise<object>} - Basic transcription response
 */
async function fallbackTranscription(filePath) {
  try {
    console.log("Using fallback transcription method");
    
    // Create a more detailed fallback message in Hebrew
    return {
      results: {
        channels: [{
          alternatives: [{
            transcript: `
            התמלול האוטומטי נכשל עבור הקובץ "${path.basename(filePath)}".
            
            סיבות אפשריות:
            - איכות הקלטה נמוכה
            - רעש רקע משמעותי
            - פורמט קובץ לא נתמך
            
            המלצות:
            - נסה להעלות קובץ באיכות גבוהה יותר
            - נסה להמיר את הקובץ לפורמט MP3 או WAV לפני ההעלאה
            - ודא שהקובץ מכיל דיבור ברור
            
            אנא נסה שוב או פנה לתמיכה אם הבעיה נמשכת.
            `
          }]
        }]
      }
    };
  } catch (error) {
    console.error("Fallback transcription also failed:", error);
    return {
      results: {
        channels: [{
          alternatives: [{
            transcript: "שגיאה בתמלול. אנא נסה שוב מאוחר יותר."
          }]
        }]
      }
    };
  }
} 
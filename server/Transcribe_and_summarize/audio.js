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
 * Convert audio file to a format compatible with transcription services
 * @param {string} inputPath - Path to input audio file
 * @returns {Promise<string>} - Path to converted audio file
 */
const convertAudioFormat = async (inputPath) => {
  try {
    console.log(`Converting audio file: ${inputPath}`);
    
    // Create output path with mp3 extension
    const outputPath = path.join(tempDir, `converted_${Date.now()}.mp3`);
    
    // Convert using ffmpeg
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(1) // Mono for better transcription
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => {
          console.log(`Audio conversion complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error converting audio:', err);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error('Error in audio conversion:', error);
    throw new Error(`Failed to convert audio file: ${error.message}`);
  }
};

/**
 * Transcribe audio file using Deepgram with the latest SDK format
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
    
    // Configure Deepgram options
    const options = {
      smart_format: true,
      model: "nova-2",
      diarize: true,
      utterances: true,
      punctuate: true
    };
    
    // If language is specifically set to Hebrew, add it to options
    if (language === 'he' || language === 'hebrew' || language === 'Hebrew') {
      options.language = 'he';
    }
    
    console.log(`Sending request to Deepgram with options:`, options);
    
    // Use the new SDK format
    // Create a source from the audio buffer
    const source = {
      buffer: audioFile,
      mimetype: 'audio/wav'
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
 * Convert audio file to a format Deepgram can handle (WAV)
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<string>} - Path to the converted file
 */
async function convertAudioFile(filePath) {
  try {
    const outputPath = path.join(
      path.dirname(filePath),
      `${path.basename(filePath, path.extname(filePath))}_converted.wav`
    );
    
    console.log(`Converting audio file from ${filePath} to ${outputPath}`);
    
    // Use ffmpeg to convert the file to WAV format with more specific parameters
    await execPromise(`ffmpeg -i "${filePath}" -acodec pcm_s16le -ac 1 -ar 16000 "${outputPath}"`);
    
    return outputPath;
  } catch (error) {
    console.error("Error converting audio file:", error);
    // If conversion fails, return the original file path
    return filePath;
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
    const transcriptionResponse = await transcribeAudio(filePath, options.language || 'auto');

    // Step 2: Extract transcript from the new response format
    // The structure might be different in the new SDK
    let transcript = '';
    
    try {
      // Try to extract transcript from the new response format
      transcript = transcriptionResponse.results?.channels[0]?.alternatives[0]?.transcript || '';
      
      // If that fails, try other possible formats
      if (!transcript && transcriptionResponse.results?.utterances) {
        transcript = transcriptionResponse.results.utterances.map(u => u.transcript).join(' ');
      }
      
      // If still no transcript, check if there's a direct transcript property
      if (!transcript && transcriptionResponse.transcript) {
        transcript = transcriptionResponse.transcript;
      }
      
      console.log(`Extracted transcript of length: ${transcript.length}`);
    } catch (error) {
      console.error('Error extracting transcript from response:', error);
      console.log('Response structure:', JSON.stringify(transcriptionResponse));
      transcript = 'Failed to extract transcript from response.';
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
    const finalSummary = await summarizeText(summaries.join(" "), options);
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
    throw error;
  }
} 
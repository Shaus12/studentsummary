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
 * Transcribe audio file using Deepgram with Whisper Large model
 * @param {string} audioPath - Path to audio file
 * @param {object} options - Transcription options
 * @returns {Promise<string>} - Transcription text
 */
export async function transcribeAudio(filePath, language) {
  try {
    console.log(`Transcribing audio file: ${filePath} with language: ${language}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Convert the audio file to a format Deepgram can handle
    const convertedFilePath = await convertAudioFile(filePath);
    console.log(`Converted audio file to: ${convertedFilePath}`);
    
    // Determine the appropriate language parameter based on the input
    let deepgramLanguage = language;
    if (language === 'auto') {
      deepgramLanguage = null; // Let Deepgram auto-detect
    }
    
    // Configure options for Deepgram API v3
    const options = {
      smart_format: true,
      model: "nova-2",
      diarize: true,
      utterances: true,
      punctuate: true,
    };
    
    // Only add language if it's specified (not auto)
    if (deepgramLanguage) {
      options.language = deepgramLanguage;
    }
    
    console.log("Sending request to Deepgram with options:", JSON.stringify(options));
    
    // Create the Deepgram client using the v3 SDK format
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    // Try a different approach - use the REST API directly
    const fileStats = fs.statSync(convertedFilePath);
    const fileSize = fileStats.size;
    
    // Read the file as a buffer
    const audioBuffer = fs.readFileSync(convertedFilePath);
    
    // Make a direct API call to Deepgram
    const url = 'https://api.deepgram.com/v1/listen';
    
    // Create a promise to handle the HTTP request
    const response = await new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/wav',
            'Content-Length': fileSize
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const jsonResponse = JSON.parse(data);
              resolve(jsonResponse);
            } catch (e) {
              reject(new Error(`Failed to parse Deepgram response: ${e.message}`));
            }
          });
        }
      );
      
      req.on('error', (error) => {
        reject(error);
      });
      
      // Write the audio buffer to the request
      req.write(audioBuffer);
      req.end();
    });
    
    // Clean up the converted file if it's different from the original
    if (convertedFilePath !== filePath && fs.existsSync(convertedFilePath)) {
      fs.unlinkSync(convertedFilePath);
      console.log(`Cleaned up temporary converted file: ${convertedFilePath}`);
    }
    
    console.log("Deepgram response:", JSON.stringify(response));
    
    // Extract transcript from the response
    let transcript = '';
    let paragraphs = [];
    
    if (response && response.results && response.results.channels && response.results.channels.length > 0) {
      // Extract the full transcript
      transcript = response.results.channels[0].alternatives[0]?.transcript || '';
      
      // Extract paragraphs/utterances if available
      if (response.results.utterances && response.results.utterances.length > 0) {
        paragraphs = response.results.utterances.map(utterance => ({
          text: utterance.transcript,
          start: utterance.start,
          end: utterance.end,
          speaker: utterance.speaker || 0
        }));
      } else {
        // Fallback if no utterances
        paragraphs = [{ text: transcript, start: 0, end: 0, speaker: 0 }];
      }
    } else {
      console.error("Unexpected response structure from Deepgram:", JSON.stringify(response));
      
      // If there's an error in the response, extract it
      if (response.error) {
        throw new Error(`Deepgram error: ${JSON.stringify(response.error)}`);
      } else {
        throw new Error("Invalid response structure from Deepgram");
      }
    }
    
    return { transcript, paragraphs };
  } catch (error) {
    console.error("Error with Deepgram API:", error);
    
    // Improved error handling with more context
    if (error.response) {
      try {
        console.error("Deepgram error response:", JSON.stringify(error.response));
      } catch (e) {
        console.error("Deepgram error response (non-JSON):", error.response);
      }
    }
    
    // Try to extract more meaningful error message
    const errorMessage = error.message || "Unknown error";
    throw new Error(`Failed to transcribe with Deepgram: ${errorMessage}`);
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
 * @param {string} outputType - Output type (summary or pdf)
 * @returns {Promise<object>} - Result object with summary and PDF path
 */
export async function processUploadedFile(filePath, outputType = 'summary') {
  try {
    console.log(`Processing uploaded file: ${filePath}`);
    
    // Step 1: Transcribe the audio
    const transcription = await transcribeAudio(filePath, 'auto');

    // Step 2: Break transcription into chunks
    const words = transcription.transcript.split(" ");
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
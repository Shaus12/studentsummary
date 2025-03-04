import fs from 'fs';
import path from 'path';
import { createClient } from '@deepgram/sdk';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { cleanupFile } from './utils.js';
import { summarizeText } from './utils.js';

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
export async function transcribeAudio(audioFilePath, options = {}) {
  try {
    console.log('Transcribing audio file:', audioFilePath);
    console.log('Transcription options:', options);

    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Get file size
    const stats = fs.statSync(audioFilePath);
    console.log('Audio file size:', stats.size, 'bytes');

    // Read the audio file
    const audioBuffer = fs.readFileSync(audioFilePath);

    // Configure Deepgram request
    const transcriptionOptions = {
      model: 'whisper-large',
      language: 'he',
      detect_language: false,
      diarize: true,
      smart_format: true,
      utterances: true,
      punctuate: true,
      ...options
    };

    console.log('Sending audio to Deepgram with Whisper Large model and Hebrew language');
    console.log('Transcription options:', transcriptionOptions);

    try {
      // Create a Deepgram client
      const deepgramApiKey = process.env.DEEPGRAM_API_KEY || '2a60d94169738ee178d20bb606126fdd56c85710';
      const deepgram = createClient(deepgramApiKey);

      // Send the audio to Deepgram
      const response = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        transcriptionOptions
      );

      // Save the full response for debugging
      const responseFilePath = path.join(
        path.dirname(audioFilePath),
        `deepgram_response_${Date.now()}.json`
      );
      fs.writeFileSync(responseFilePath, JSON.stringify(response, null, 2));
      console.log(`Saved full Deepgram response to ${responseFilePath}`);

      // Check if response has the expected structure
      if (!response || !response.results || !response.results.channels) {
        console.error('Unexpected Deepgram response structure:', JSON.stringify(response));
        throw new Error('Invalid response from Deepgram');
      }

      // Extract the transcript
      let transcript = '';
      
      // Try to get the transcript from the response
      try {
        // First try the standard path
        if (response.results.channels[0].alternatives[0].transcript) {
          transcript = response.results.channels[0].alternatives[0].transcript;
        } 
        // If that fails, try to get it from utterances
        else if (response.results.utterances && response.results.utterances.length > 0) {
          transcript = response.results.utterances.map(u => u.transcript).join(' ');
        }
        // If both fail, throw an error
        else {
          throw new Error('No transcript found in Deepgram response');
        }
      } catch (extractError) {
        console.error('Error extracting transcript from Deepgram response:', extractError);
        console.error('Response structure:', JSON.stringify(response));
        throw new Error('Failed to extract transcript from Deepgram response');
      }

      if (!transcript) {
        throw new Error('Empty transcript from Deepgram');
      }

      console.log('Transcription successful');
      return transcript;
    } catch (deepgramError) {
      console.error('Error with Deepgram API:', deepgramError);
      
      // Try an alternative transcription method if Deepgram fails
      console.log('Attempting alternative transcription method...');
      
      // Here you could implement a fallback to another service
      // For now, we'll just throw the error
      throw new Error(`Failed to transcribe with Deepgram: ${deepgramError.message}`);
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
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
    const transcription = await transcribeAudio(filePath, options);
    
    // Return the transcription or summary based on options
    if (options.outputType === 'transcription') {
      return {
        transcription,
        success: true
      };
    } else if (options.outputType === 'summary') {
      // Generate summary
      const summary = await summarizeText(transcription, options.summaryOptions || {});
      
      return {
        summary,
        transcription: options.includeTranscription ? transcription : undefined,
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
import fs from 'fs';
import path from 'path';
import { Deepgram } from '@deepgram/sdk';
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

// Initialize Deepgram client
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = new Deepgram(deepgramApiKey);

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
export const transcribeAudio = async (audioPath, options = {}) => {
  try {
    console.log(`Transcribing audio file: ${audioPath}`);
    console.log(`Transcription options:`, options);
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    // Get file stats
    const stats = fs.statSync(audioPath);
    console.log(`Audio file size: ${stats.size} bytes`);
    
    // Check if file is empty
    if (stats.size === 0) {
      throw new Error('Audio file is empty');
    }
    
    // Convert audio to compatible format if needed
    let processedAudioPath = audioPath;
    const fileExt = path.extname(audioPath).toLowerCase();
    const compatibleFormats = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
    
    if (!compatibleFormats.includes(fileExt)) {
      console.log(`Converting audio from ${fileExt} to compatible format`);
      processedAudioPath = await convertAudioFormat(audioPath);
    }
    
    // Read audio file
    const audioBuffer = fs.readFileSync(processedAudioPath);
    
    // Set up transcription options specifically for Hebrew with Whisper Large
    const transcriptionOptions = {
      smart_format: true,
      model: 'whisper-large', // Use Whisper Large model
      language: 'he', // Explicitly set to Hebrew
      detect_language: false, // Don't auto-detect, we know it's Hebrew
      diarize: true,
      utterances: true,
      punctuate: true,
      profanity_filter: false, // Allow all words for accurate transcription
      tier: 'enhanced' // Use enhanced tier for better quality
    };
    
    console.log('Sending audio to Deepgram with Whisper Large model and Hebrew language');
    console.log('Transcription options:', transcriptionOptions);
    
    // Send to Deepgram using the new SDK format
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      transcriptionOptions
    );
    
    if (error) {
      throw new Error(`Deepgram error: ${error.message}`);
    }
    
    // Save the full response for debugging
    const responseOutputPath = path.join(tempDir, `deepgram_response_${Date.now()}.json`);
    fs.writeFileSync(responseOutputPath, JSON.stringify(result, null, 2));
    console.log(`Saved full Deepgram response to ${responseOutputPath}`);
    
    // Extract transcript
    if (!result || !result.results || !result.results.channels) {
      throw new Error('Invalid response from Deepgram');
    }
    
    // Get transcript from the first channel
    const transcript = result.results.channels[0].alternatives[0].transcript;
    
    if (!transcript || transcript.trim() === '') {
      throw new Error('No transcript returned from Deepgram');
    }
    
    console.log(`Transcription successful, length: ${transcript.length} characters`);
    console.log(`Transcript sample: ${transcript.substring(0, 200)}...`);
    
    // Clean up temporary files
    if (processedAudioPath !== audioPath) {
      cleanupFile(processedAudioPath);
    }
    
    return transcript;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    
    // Provide more specific error messages
    if (error.message.includes('API key')) {
      throw new Error('Transcription service API key is invalid or missing');
    } else if (error.message.includes('format')) {
      throw new Error('Audio file format is not supported');
    } else if (error.message.includes('empty')) {
      throw new Error('Audio file is empty or contains no audio data');
    } else if (error.message.includes('language')) {
      throw new Error('Hebrew language transcription is not supported by the selected model');
    } else if (error.message.includes('whisper')) {
      throw new Error('Whisper Large model is not available or not configured correctly');
    } else {
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }
};

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
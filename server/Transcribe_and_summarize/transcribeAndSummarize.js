import { createClient } from '@deepgram/sdk';
import fs from "fs/promises";
import { summarizeText } from './audioProcessing.js';

// Configure Deepgram
const deepgramApiKey = '26e3b5fc5fd1451123c9c799ede5d211ff94fce9';
const deepgram = createClient(deepgramApiKey);

// Updated Transcription Function using Deepgram
async function transcribeAudio(filePath, retries = 3, delay = 5000) {
  try {
    const audioData = await fs.readFile(filePath);

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioData,
      {
        model: 'whisper-large',
        language: 'he',
        smart_format: true,
      }
    );

    if (error) {
      throw new Error('Deepgram transcription failed: ' + error);
    }

    return result.results.channels[0].alternatives[0].transcript;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}

// Process transcription in chunks and summarize
async function processAndSummarize(filePath) {
  try {
    // Step 1: Transcribe the audio
    const transcription = await transcribeAudio(filePath);

    // Step 2: Break transcription into 5-minute chunks
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
    return finalSummary;
  } catch (error) {
    console.error("Error processing and summarizing:", error);
    throw error;
  }
}

// Export only what's needed
export { processAndSummarize };
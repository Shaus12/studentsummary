import { createClient } from '@deepgram/sdk';
import fs from "fs/promises";
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configure Deepgram
const deepgramApiKey = '26e3b5fc5fd1451123c9c799ede5d211ff94fce9';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// Updated Summarization Function using Gemini
async function summarizeText(text) {
  try {
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

    const chat = model.startChat({
      history: [],
    });

    const prompt = `Please summarize the following text in Hebrew, using bullet points:
    
    ${text}
    
    Please make the summary concise and clear, focusing on the main points.`;

    const result = await chat.sendMessage(prompt);
    return result.response.text;
  } catch (error) {
    console.error("Error summarizing text:", error);
    throw error;
  }
}

// Process transcription in chunks and summarize
async function processAndSummarize(filePath) {
  try {
    // Step 1: Transcribe the audio
    const transcription = await transcribeAudio(filePath);

    // Step 2: Break transcription into 5-minute chunks (assuming ~1500 words per 5 minutes)
    const words = transcription.split(" ");
    const chunkSize = 1500; // Approximate word count for 5 minutes
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

// Import the functions from audioProcessing.js instead of defining them here
import { summarizeText, generatePDF } from './audioProcessing.js';

// Export only what's needed
export { summarizeText, generatePDF, processAndSummarize };
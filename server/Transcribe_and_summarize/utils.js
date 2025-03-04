import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A');

/**
 * Summarize text using Google's Gemini API
 * @param {string} text - Text to summarize
 * @param {object} options - Summarization options
 * @returns {Promise<string>} - Summarized text
 */
export async function summarizeText(text, options = {}) {
  try {
    console.log(`Summarizing text of length: ${text.length}`);
    
    if (!text || text.trim().length === 0) {
      return "No text to summarize.";
    }
    
    // Initialize the Gemini API with the correct API key
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    // Use the correct model name - updated from gemini-pro to the latest version
    // The error suggests we need to check available models
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Create a prompt for summarization
    const prompt = `Please summarize the following text in a concise and informative way:
    
    ${text}
    
    Summary:`;
    
    // Generate content with the prompt
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    
    return summary;
  } catch (error) {
    console.error("Error summarizing text:", error);
    
    // Try an alternative approach if the first one fails
    try {
      console.log("Attempting alternative summarization method...");
      
      // Initialize with a different model if available
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      
      // Try with a different model name
      const model = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
      
      const prompt = `Summarize this text: ${text}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (fallbackError) {
      console.error("Alternative summarization also failed:", fallbackError);
      
      // Return a basic summary or the original text if all else fails
      return `Failed to generate summary. Here's the transcription: ${text.substring(0, 500)}...`;
    }
  }
}

/**
 * Ensures a directory exists
 * @param {string} dirPath - Directory path
 */
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Cleans up a file
 * @param {string} filePath - File path
 */
export async function cleanupFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
    console.log(`Cleaned up file: ${filePath}`);
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error);
  }
} 
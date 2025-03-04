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
    
    // Use the correct environment variable name: GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error("Missing or empty Gemini API key");
      return `Here's the transcription: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }
    
    // Log the first few characters of the API key for debugging (don't log the full key)
    console.log(`Using Gemini API key starting with: ${apiKey.substring(0, 4)}...`);
    
    // Initialize the Gemini API with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try with gemini-pro model (more widely available)
    try {
      console.log("Attempting summarization with gemini-pro model");
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      const prompt = `Please summarize the following text in a concise and informative way:
      
      ${text}
      
      Summary:`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      return summary;
    } catch (error) {
      console.error("Error with gemini-pro model:", error);
      
      // If the first attempt fails, try with a different model
      try {
        console.log("Attempting summarization with gemini-1.0-pro model");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        
        const prompt = `Summarize this text: ${text}`;
        const result = await fallbackModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (fallbackError) {
        console.error("All Gemini models failed:", fallbackError);
        return `Here's the transcription: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
      }
    }
  } catch (error) {
    console.error("Error summarizing text:", error);
    return `Here's the transcription: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
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
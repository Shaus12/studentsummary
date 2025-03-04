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
    console.log(`Summarization options:`, options);
    
    if (!text || text.trim().length === 0) {
      return "אין טקסט לסיכום.";
    }
    
    // Use the correct environment variable name: GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error("Missing or empty Gemini API key");
      return `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }
    
    console.log(`Using Gemini API key starting with: ${apiKey.substring(0, 4)}...`);
    
    // Initialize the Gemini API with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
      // Use a fixed model name that should work with the current SDK version
      console.log("Using gemini-pro model");
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      // Create a prompt that explicitly requests Hebrew output
      const prompt = `
      סכם את הטקסט הבא בעברית בצורה תמציתית ואינפורמטיבית:
      
      ${text}
      
      הסיכום בעברית:
      `;
      
      console.log(`Using Hebrew prompt for summarization`);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      console.log(`Generated summary in Hebrew`);
      
      // If the summary is empty or failed, provide a fallback
      if (!summary || summary.trim().length === 0) {
        return `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
      }
      
      return summary;
    } catch (error) {
      console.error("Error with Gemini API:", error);
      
      // Try an alternative model as fallback
      try {
        console.log("Trying alternative model: gemini-1.0-pro");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        
        const hebrewPrompt = `
        תסכם את הטקסט הבא בעברית:
        
        ${text}
        
        סיכום בעברית:
        `;
        
        const result = await fallbackModel.generateContent(hebrewPrompt);
        const response = await result.response;
        return response.text() || `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
      } catch (fallbackError) {
        console.error("Fallback model also failed:", fallbackError);
        return `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
      }
    }
  } catch (error) {
    console.error("Error summarizing text:", error);
    return `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
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
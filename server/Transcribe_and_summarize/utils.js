import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A');

/**
 * Summarize text using a simple extractive method with Hebrew output
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
    
    // Check if the text is primarily in Hebrew
    const isHebrewText = containsHebrew(text);
    console.log(`Text contains Hebrew: ${isHebrewText}`);
    
    // If text is not in Hebrew, we'll create a simple Hebrew summary
    if (!isHebrewText) {
      // Simple extractive summarization
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      if (sentences.length <= 3) {
        return `סיכום: ${text}`;
      }
      
      // Extract key sentences (first, middle, and last)
      const firstSentence = sentences[0];
      const middleSentence = sentences[Math.floor(sentences.length / 2)];
      const lastSentence = sentences[sentences.length - 1];
      
      // Create a basic summary in Hebrew
      const summary = `
      סיכום הקלטה:
      
      נקודות מפתח:
      - ${firstSentence}.
      - ${middleSentence}.
      - ${lastSentence}.
      
      הערה: התמלול המקורי אינו בעברית.
      `;
      
      return summary;
    } else {
      // For Hebrew text, we'll use the text directly
      // Simple extractive summarization for Hebrew
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      if (sentences.length <= 3) {
        return `סיכום: ${text}`;
      }
      
      // Extract key sentences (first, middle, and last)
      const firstSentence = sentences[0];
      const middleSentence = sentences[Math.floor(sentences.length / 2)];
      const lastSentence = sentences[sentences.length - 1];
      
      // Create a basic summary in Hebrew
      const summary = `
      סיכום הקלטה:
      
      נקודות מפתח:
      - ${firstSentence}.
      - ${middleSentence}.
      - ${lastSentence}.
      `;
      
      return summary;
    }
  } catch (error) {
    console.error("Error creating summary:", error);
    return `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
  }
}

/**
 * Check if text contains Hebrew characters
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains Hebrew
 */
function containsHebrew(text) {
  // Hebrew Unicode range
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
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
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCzIsCmQVuaiUKd0TqaIctPVZ0Bj_3i11A');

/**
 * Summarizes text using Gemini AI
 * @param {string} text - Text to summarize
 * @returns {Promise<string>} - Summarized text
 */
export async function summarizeText(text) {
  try {
    console.log(`Summarizing text of length: ${text.length}`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
    Please summarize the following Hebrew text in Hebrew. 
    Create a comprehensive summary that captures the main points and key details.
    
    Text to summarize:
    ${text}
    `;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    console.log(`Summary generated: ${summary.substring(0, 100)}...`);
    
    return summary;
  } catch (error) {
    console.error('Error summarizing text:', error);
    throw error;
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
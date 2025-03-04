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
      return "No text to summarize.";
    }
    
    // Use the correct environment variable name: GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error("Missing or empty Gemini API key");
      return `Here's the transcription: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }
    
    console.log(`Using Gemini API key starting with: ${apiKey.substring(0, 4)}...`);
    
    // Initialize the Gemini API with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the list of available models first
    try {
      console.log("Listing available models...");
      const modelList = await genAI.listModels();
      console.log("Available models:", modelList);
      
      // Try to find a suitable model from the list
      let modelName = null;
      if (modelList && modelList.models) {
        // Look for gemini models in order of preference
        const preferredModels = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
        for (const preferred of preferredModels) {
          const found = modelList.models.find(m => m.name.includes(preferred));
          if (found) {
            modelName = found.name;
            console.log(`Found suitable model: ${modelName}`);
            break;
          }
        }
      }
      
      // If no suitable model found, use a hardcoded fallback
      if (!modelName) {
        modelName = "models/gemini-pro";
        console.log(`No suitable model found, using fallback: ${modelName}`);
      }
      
      // Use the found or fallback model
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Determine language for summarization (default to Hebrew)
      const language = options.language || 'Hebrew';
      
      // Create a prompt that specifies Hebrew output
      let prompt = '';
      if (language === 'Hebrew' || language === 'hebrew') {
        prompt = `Please summarize the following text in Hebrew (עברית) in a concise and informative way:
        
        ${text}
        
        Summary in Hebrew:`;
      } else {
        prompt = `Please summarize the following text in a concise and informative way:
        
        ${text}
        
        Summary:`;
      }
      
      // Add any additional instructions from options
      if (options.style) {
        prompt += `\n\nPlease make the summary ${options.style}.`;
      }
      
      if (options.length) {
        prompt += `\n\nThe summary should be ${options.length} in length.`;
      }
      
      console.log(`Using prompt: ${prompt.substring(0, 100)}...`);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      console.log(`Generated summary in ${language}`);
      return summary;
    } catch (error) {
      console.error("Error with Gemini API:", error);
      
      // If all attempts fail, return a portion of the transcription
      if (options.language === 'Hebrew' || options.language === 'hebrew') {
        return `הנה התמלול: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
      } else {
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
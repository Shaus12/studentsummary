// Step 1: Install the required package in your Node.js project
// Run this in your terminal: npm install youtube-dl-exec

// Step 2: Import youtube-dl-exec using ES modules syntax
import ytdl from 'youtube-dl-exec';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Step 3: Define the function to download audio from YouTube
async function downloadAudio(link) {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(path.dirname(__filename), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const outputPath = path.join(tempDir, 'audio.mp3');
    
    // Delete existing audio file if it exists
    try {
      await fs.unlink(outputPath);
      console.log('Cleaned up existing audio file');
    } catch (err) {
      // File doesn't exist, which is fine
    }
    
    console.log('Starting download...');
    console.log('Output path:', outputPath);

    // Updated configuration for yt-dlp
    await ytdl(link, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '192k',
      output: outputPath,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      forceOverwrite: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ],
      cookies: 'cookies.txt',  // Optional: if you have a cookies file
      format: 'bestaudio',
      extractorArgs: ['youtube:player_client=all'],
      concurrent: 1
    });

    // Verify the file exists and is the correct one
    const stats = await fs.stat(outputPath);
    console.log(`Downloaded file size: ${stats.size} bytes`);

    console.log('Download complete!');
    return outputPath;
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

export default downloadAudio;

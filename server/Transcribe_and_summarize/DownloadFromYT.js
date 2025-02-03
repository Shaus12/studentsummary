import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function downloadAudio(youtubeUrl) {
  try {
    // Create temp directory path
    const tempDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'temp');
    const outputPath = path.join(tempDir, 'audio.mp3');

    // Modified command to output MP3 format
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${youtubeUrl}"`;
    
    console.log('Running command:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('yt-dlp stderr:', stderr);
    }
    
    console.log('yt-dlp stdout:', stdout);
    
    // Verify the file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Audio file was not created');
    }

    return outputPath;
  } catch (error) {
    console.error('Error downloading audio:', error);
    throw error;
  }
}

export default downloadAudio;

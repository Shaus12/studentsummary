import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export async function downloadYouTubeAudio(youtubeUrl, outputPath) {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    
    // First try the original download method
    try {
      // Use cookies file if it exists
      const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
      const cookiesOption = fs.existsSync(cookiesPath) ? `--cookies ${cookiesPath}` : '';
      
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-check-certificate --force-ipv4 --geo-bypass ${cookiesOption} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" -o "${outputPath}" "${youtubeUrl}"`;
      
      console.log('Attempting to download with yt-dlp...');
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error('yt-dlp stderr:', stderr);
        // Check if the error is about bot detection
        if (stderr.includes('Sign in to confirm you\'re not a bot') || 
            stderr.includes('ERROR:') || 
            stderr.includes('does not look like a Netscape format cookies file')) {
          throw new Error('Bot detection or other error triggered');
        }
      }
      
      console.log('yt-dlp stdout:', stdout);
      return { method: 'download', outputPath };
    } catch (downloadError) {
      console.error('Download failed, falling back to transcript API:', downloadError.message);
      
      // If download fails, fall back to transcript API
      console.log('Falling back to transcript API...');
      
      // Import the transcript function directly here to avoid module loading issues
      const { getYouTubeTranscript } = await import('./YouTubeTranscript.js');
      const result = await getYouTubeTranscript(youtubeUrl);
      
      // Create a dummy audio file with the transcript
      // This is just so the rest of your pipeline can work as expected
      const dummyAudioPath = outputPath.replace('.mp3', '_transcript.txt');
      await fs.promises.writeFile(dummyAudioPath, result.transcript);
      
      return { 
        method: 'transcript', 
        outputPath: dummyAudioPath,
        transcript: result.transcript 
      };
    }
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    throw error;
  }
}

export default downloadAudio;

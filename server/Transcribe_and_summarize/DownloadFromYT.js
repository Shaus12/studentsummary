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

export async function downloadYouTubeAudio(youtubeUrl) {
  try {
    console.log(`Downloading audio from YouTube URL: ${youtubeUrl}`);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // First try to get the transcript
    try {
      console.log(`Getting transcript for video ID: ${videoId}`);
      const transcript = await getYouTubeTranscript(videoId);
      if (transcript) {
        console.log('Successfully retrieved transcript');
        return { transcript, method: 'transcript' };
      }
    } catch (transcriptError) {
      console.log(`Error fetching transcript: ${transcriptError}`);
    }
    
    // If transcript fails, try downloading the audio
    const outputPath = path.join(tempDir, 'audio.mp3');
    
    try {
      // Try downloading with yt-dlp
      console.log('Attempting to download audio with yt-dlp...');
      
      // Create a more robust yt-dlp command with additional options
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-check-certificate --force-ipv4 --geo-bypass --cookies ${path.join(__dirname, '../cookies.txt')} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" -o "${outputPath}" "${youtubeUrl}"`;
      
      await execAsync(command);
      console.log('Audio downloaded successfully');
      
      return { audioPath: outputPath, method: 'download' };
    } catch (downloadError) {
      console.log(`Download failed, falling back to transcript API: ${downloadError}`);
      
      // If download fails, try one more time with the transcript API
      try {
        console.log('Falling back to transcript API...');
        console.log(`Getting transcript for video ID: ${videoId}`);
        const transcript = await getYouTubeTranscript(videoId);
        if (transcript) {
          console.log('Successfully retrieved transcript on second attempt');
          return { transcript, method: 'transcript' };
        }
      } catch (secondTranscriptError) {
        console.log(`Error fetching transcript on second attempt: ${secondTranscriptError}`);
      }
      
      // If all methods fail, throw an error
      throw new Error('Failed to get content from YouTube video. The video might be private, age-restricted, or not have captions available.');
    }
  } catch (error) {
    console.error('Error getting YouTube transcript:', error);
    throw error;
  }
}

export default downloadAudio;

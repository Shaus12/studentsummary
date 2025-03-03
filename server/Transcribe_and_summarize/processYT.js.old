import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractVideoId, downloadYouTubeAudio, getYouTubeTranscript } from './YouTubeTranscript.js';
import { transcribeAudio, summarizeText, generatePDF } from './audioProcessing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main function to process YouTube videos
export async function processYouTube(youtubeUrl, outputType) {
  try {
    console.log(`Processing YouTube video: ${youtubeUrl}`);
    console.log(`Output type: ${outputType}`);
    
    // Process the YouTube video
    const audioPath = path.join(__dirname, '..', 'temp', `audio_${Date.now()}.mp3`);
    const result = await downloadYouTubeAudio(youtubeUrl, audioPath);
    
    // Try to get transcript first
    let text;
    try {
      const videoId = extractVideoId(youtubeUrl);
      text = await getYouTubeTranscript(videoId);
    } catch (transcriptError) {
      console.log('Failed to get transcript, falling back to audio transcription');
      text = await transcribeAudio(result.outputPath);
    }
    
    console.log(`Text obtained, length: ${text?.length}`);
    
    // Generate summary
    const output = await summarizeText(text);
    console.log(`Output generated, length: ${output?.length}`);
    
    // Generate PDF if requested
    let pdfPath = null;
    if (outputType === 'pdf') {
      pdfPath = await generatePDF(output);
      console.log(`PDF generated at: ${pdfPath}`);
    }
    
    // Clean up the audio file
    try {
      await fs.promises.unlink(result.outputPath);
      console.log(`Cleaned up audio file: ${result.outputPath}`);
    } catch (cleanupError) {
      console.error('Error cleaning up audio file:', cleanupError);
    }
    
    return {
      method: 'download',
      summary: output,
      pdfPath: pdfPath
    };
  } catch (error) {
    console.error('Error in processYouTube:', error);
    throw error;
  }
}

// Keep the generatePDF function as is
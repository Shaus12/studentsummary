import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract video ID from YouTube URL
function extractVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

// Function to get transcript from YouTube video ID
async function fetchTranscript(videoId) {
  try {
    // First, get the video page to find available transcripts
    const videoPageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
    const videoPageHtml = videoPageResponse.data;
    
    // Extract the serializedShareEntity which contains the transcript data
    const match = videoPageHtml.match(/"captionTracks":(\[.*?\]),"audioTracks"/);
    if (!match || !match[1]) {
      throw new Error('No captions found for this video');
    }
    
    // Parse the JSON data
    const captionTracks = JSON.parse(match[1].replace(/\\"/g, '"'));
    
    // Find the English transcript or use the first available one
    const englishTrack = captionTracks.find(track => track.languageCode === 'en') || captionTracks[0];
    if (!englishTrack || !englishTrack.baseUrl) {
      throw new Error('No suitable transcript found');
    }
    
    // Get the transcript data
    const transcriptResponse = await axios.get(englishTrack.baseUrl);
    const transcriptXml = transcriptResponse.data;
    
    // Parse the XML to extract text
    const textSegments = [];
    const regex = /<text[^>]*>(.*?)<\/text>/g;
    let segmentMatch;
    while ((segmentMatch = regex.exec(transcriptXml)) !== null) {
      // Decode HTML entities
      const text = segmentMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      if (text.trim()) {
        textSegments.push(text);
      }
    }
    
    return textSegments.join(' ');
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

// Main function to process a YouTube video
export async function getYouTubeTranscript(youtubeUrl) {
  try {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    console.log(`Getting transcript for video ID: ${videoId}`);
    
    // Get video transcript
    const transcript = await fetchTranscript(videoId);
    
    // Save transcript to a file
    const transcriptPath = path.join(__dirname, '..', 'temp', `${videoId}_transcript.txt`);
    await fs.promises.writeFile(transcriptPath, transcript);
    
    return {
      videoId,
      transcript,
      transcriptPath
    };
  } catch (error) {
    console.error('Error getting YouTube transcript:', error);
    throw error;
  }
} 
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transcribeAudio } from './audio.js';
import { summarizeText, cleanupFile } from './utils.js';
import { YoutubeTranscript } from 'youtube-transcript';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Extracts video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
const extractVideoId = (url) => {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match && match[1] ? match[1] : null;
};

/**
 * Downloads audio from YouTube video using Puppeteer
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Path to downloaded audio
 */
const downloadYouTubeAudioWithPuppeteer = async (videoId) => {
  try {
    console.log(`Attempting to download audio with Puppeteer for video ID: ${videoId}`);
    
    const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Launch browser with stealth mode
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled' // Prevents detection
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
      
      // Set extra headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      });
      
      // Override navigator.webdriver property to prevent detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Add missing properties that headless browsers don't have
        window.navigator.chrome = {
          runtime: {},
        };
        
        // Overwrite the plugins property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {
                type: 'application/x-google-chrome-pdf',
                suffixes: 'pdf',
                description: 'Portable Document Format',
                enabledPlugin: Plugin,
              },
              description: 'Chrome PDF Plugin',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin',
            },
          ],
        });
        
        // Overwrite the languages property
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });
      
      // Navigate to the video page
      console.log(`Navigating to ${videoUrl}`);
      await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Check if we're on a captcha page
      const isCaptcha = await page.evaluate(() => {
        return document.title.includes('confirm') || document.body.innerText.includes('not a robot');
      });
      
      if (isCaptcha) {
        console.log('Captcha detected, cannot proceed');
        throw new Error('YouTube is showing a captcha. Please try again later or use a different video.');
      }
      
      // Wait longer for the video player to load
      console.log('Waiting for video player to load...');
      await page.waitForSelector('video', { timeout: 45000 }).catch(() => {
        console.log('Video element not found, trying alternative approach');
      });
      
      // Try to extract the audio URL using network requests
      console.log('Monitoring network requests for audio URLs...');
      
      // Create a promise that resolves when we find an audio URL
      const audioUrlPromise = new Promise((resolve, reject) => {
        let audioUrl = null;
        
        // Listen for network requests that contain audio
        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('googlevideo.com') && 
              (url.includes('audio') || url.includes('mp4a'))) {
            audioUrl = url;
            resolve(url);
          }
        });
        
        // Set a timeout
        setTimeout(() => {
          if (!audioUrl) {
            reject(new Error('Could not find audio URL in network requests'));
          }
        }, 30000);
      });
      
      // Click the play button to start the video
      await page.evaluate(() => {
        const playButton = document.querySelector('.ytp-play-button');
        if (playButton) playButton.click();
      });
      
      // Wait for the audio URL
      const audioUrl = await audioUrlPromise;
      console.log(`Extracted audio URL: ${audioUrl}`);
      
      // Download the audio file
      const response = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'stream',
        headers: {
          'Referer': videoUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        }
      });
      
      // Save the audio file
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Audio saved to ${outputPath}`);
          resolve(outputPath);
        });
        writer.on('error', reject);
      });
    } finally {
      // Always close the browser
      await browser.close();
    }
  } catch (error) {
    console.error('Error downloading YouTube audio with Puppeteer:', error);
    throw error;
  }
};

/**
 * Gets transcript from YouTube API (fallback method)
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Video transcript
 */
const getYouTubeTranscript = async (videoId) => {
  try {
    console.log(`Attempting to get transcript using youtube-transcript-api for video ID: ${videoId}`);
    
    // Try with specific language options and include auto-generated captions
    const options = {
      lang: 'he',        // Try Hebrew first (based on your video)
      languages: ['he', 'en', 'iw', 'auto'], // Try multiple languages including auto
      includeAutoGenerated: true  // This is important for auto-generated captions
    };
    
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, options);
    
    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error('No transcript available');
    }
    
    // Combine all transcript items into a single text
    const fullTranscript = transcriptItems.map(item => item.text).join(' ');
    return fullTranscript;
  } catch (error) {
    console.log(`Error with youtube-transcript-api: ${error.message}`);
    
    // Try fallback method using YouTube API for video info
    console.log(`Getting video info for video ID: ${videoId} via API`);
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      console.log(`Using YouTube API Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'undefined'}`);
      
      // Get video information to check if it exists and is accessible
      const videoResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
      );
      
      if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
        throw new Error('Video not found or not accessible');
      }
      
      // If we can access the video but not the transcript, inform the user
      const videoTitle = videoResponse.data.items[0].snippet.title;
      console.log(`Found video: "${videoTitle}" but could not access transcript`);
      
      throw new Error(`No transcript available for video: "${videoTitle}"`);
    } catch (apiError) {
      console.log(`Error with YouTube API: ${apiError.message}`);
      throw new Error('Failed to get transcript');
    }
  }
};

/**
 * Gets video info from YouTube API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object>} - Video info
 */
const getVideoInfo = async (videoId) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    return response.data.items[0];
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
};

/**
 * Downloads audio from YouTube video using yt-dlp
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Path to downloaded audio
 */
const downloadYouTubeAudio = async (videoId) => {
  try {
    console.log(`Downloading audio from: https://www.youtube.com/watch?v=${videoId}`);
    console.log(`Video ID: ${videoId}`);
    
    const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    
    // Try with advanced options first
    try {
      // This command uses multiple techniques to bypass restrictions
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --extractor-args "youtube:player_client=android,web" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36" --add-header "Accept-Language: en-US,en;q=0.9" --sleep-interval 1 --max-sleep-interval 5 --geo-bypass-country US -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
      
      console.log(`Running command with advanced options: ${command}`);
      
      const { stdout } = await execAsync(command);
      console.log(`YouTube download output: ${stdout}`);
      return outputPath;
    } catch (advancedError) {
      console.log("Error with advanced options, trying alternative approach...");
      console.log(advancedError.message);
      
      // Try with cookies from browser
      try {
        // Try with a different player client
        const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --cookies-from-browser chrome --extractor-args "youtube:player_client=ios" --geo-bypass -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
        console.log(`Running command with cookies: ${command}`);
        
        const { stdout } = await execAsync(command);
        console.log(`YouTube download output: ${stdout}`);
        return outputPath;
      } catch (cookiesError) {
        console.log("Error with cookies method, trying third approach...");
        
        // Try with embed page approach
        try {
          const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --referer "https://www.google.com/" --add-header "Origin:https://www.youtube.com" --embed-metadata --no-check-certificate --force-ipv4 -o "${outputPath}" https://www.youtube.com/embed/${videoId}`;
          console.log(`Running embed approach: ${command}`);
          
          const { stdout } = await execAsync(command);
          console.log(`YouTube download output: ${stdout}`);
          return outputPath;
        } catch (embedError) {
          console.log("Error with embed approach, trying final method...");
          
          // Last resort: try with invidious
          try {
            const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" https://invidious.snopyta.org/watch?v=${videoId}`;
            console.log(`Running invidious approach: ${command}`);
            
            const { stdout } = await execAsync(command);
            console.log(`YouTube download output: ${stdout}`);
            return outputPath;
          } catch (invidiousError) {
            if (invidiousError.stderr && invidiousError.stderr.includes("Sign in to confirm you're not a bot")) {
              throw new Error("YouTube is requiring authentication to access this video. Please try a different video or try again later.");
            } else {
              throw invidiousError;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error downloading YouTube audio:", error);
    throw error;
  }
};

/**
 * Processes YouTube video
 * @param {string} url - YouTube URL
 * @param {string} outputType - Output type (summary or pdf)
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Result object
 */
const processYouTube = async (youtubeUrl, outputType = 'summary', options = {}) => {
  try {
    console.log(`Attempting to download and transcribe YouTube video...`);
    
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Try to get transcript first
    let transcription;
    try {
      transcription = await getYouTubeTranscript(videoId);
      console.log("Successfully retrieved transcript");
    } catch (transcriptError) {
      console.log('Falling back to audio transcription...');
      console.log('No transcript available, attempting to download audio...');
      
      try {
        // Try with yt-dlp first
        let audioPath;
        try {
          audioPath = await downloadYouTubeAudio(videoId);
        } catch (ytdlpError) {
          console.log('Error with yt-dlp, trying Puppeteer approach...');
          audioPath = await downloadYouTubeAudioWithPuppeteer(videoId);
        }
        
        // Here you would call your transcription function
        transcription = await transcribeAudio(audioPath);
        
        // Clean up the audio file
        try {
          fs.unlinkSync(audioPath);
        } catch (cleanupError) {
          console.error('Error cleaning up audio file:', cleanupError);
        }
      } catch (downloadError) {
        if (downloadError.message.includes("YouTube is requiring authentication")) {
          throw new Error("YouTube is requiring authentication to access this video. Please try a different video or try again later.");
        } else {
          console.error("Error downloading or transcribing audio:", downloadError);
          throw new Error("Failed to process YouTube video. YouTube may be blocking automated access. Please try a different video or try again later.");
        }
      }
    }
    
    // If we don't have a transcription at this point, we need to inform the user
    if (!transcription) {
      throw new Error("Could not retrieve or generate a transcript for this video. Please try a different video.");
    }
    
    // Process the transcription based on output type
    if (outputType === "summary") {
      return await summarizeText(transcription, options);
    } else if (outputType === "questions") {
      return await generateQuestions(transcription, options);
    } else {
      return transcription;
    }
  } catch (error) {
    console.error("Error processing YouTube video:", error);
    throw error; // Pass the error directly to maintain the user-friendly message
  }
};

// Export all functions in a single export statement
export {
  extractVideoId,
  getYouTubeTranscript,
  getVideoInfo,
  processYouTube,
  downloadYouTubeAudio,
  downloadYouTubeAudioWithPuppeteer
}; 
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transcribeAudio } from './audio.js';
import { summarizeText, cleanupFile } from './utils.js';
import { YoutubeTranscript } from 'youtube-transcript';
import puppeteer from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Create a puppeteer instance with stealth plugin
// Note: This approach needs to be modified for puppeteer-core
// We'll need to manually apply stealth techniques

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

// Supadata API key
const SUPADATA_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6IjEifQ.eyJpc3MiOiJuYWRsZXMiLCJpYXQiOiIxNzQxMDMxNjAwIiwicHVycG9zZSI6ImFwaV9hdXRoZW50aWNhdGlvbiIsInN1YiI6ImFmOTRhM2YzNmJhZDQ4OThiODU5NDFiNjFiNDllMDczIn0.UrmgeY-pgd81QEOKUWRB_NISwmmCXkJMw-GwmSd21Nc';

/**
 * Extracts video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
const extractVideoId = (url) => {
  if (!url) return null;
  
  // Handle different YouTube URL formats
  const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[2].length === 11) ? match[2] : null;
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
    
    // Launch browser with puppeteer-core
    const browser = await puppeteer.launch({
      executablePath: process.env.NODE_ENV === 'production' 
        ? '/usr/bin/google-chrome'  // Path to Chrome on Render
        : process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Local Chrome path
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
    
    // Try with VPN first
    try {
      // Connect to VPN
      console.log("Connecting to VPN...");
      await execAsync('sudo openvpn --config /path/to/your/vpn/config.ovpn --daemon');
      
      // Wait a moment for the VPN connection to establish
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Running command with VPN: ${command}`);
      
      const { stdout } = await execAsync(command);
      console.log(`YouTube download output: ${stdout}`);
      
      // Disconnect from VPN
      await execAsync('sudo killall openvpn');
      
      return outputPath;
    } catch (vpnError) {
      console.log("Error with VPN method, trying alternative approaches...");
      
      // Disconnect from VPN if it's still running
      try {
        await execAsync('sudo killall openvpn');
      } catch (e) {
        // Ignore errors if openvpn wasn't running
      }
      
      // Try with cookies from browser
      try {
        const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --cookies-from-browser chrome -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
        console.log(`Running command: ${command}`);
        
        const { stdout } = await execAsync(command);
        console.log(`YouTube download output: ${stdout}`);
        return outputPath;
      } catch (error) {
        console.log("Error with cookies-from-browser method, trying alternative approach...");
        
        // If that fails, try with other options
        const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-check-certificate --force-ipv4 --geo-bypass -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
        console.log(`Running command: ${command}`);
        
        try {
          const { stdout } = await execAsync(command);
          console.log(`YouTube download output: ${stdout}`);
          return outputPath;
        } catch (downloadError) {
          if (downloadError.stderr && downloadError.stderr.includes("Sign in to confirm you're not a bot")) {
            throw new Error("YouTube is requiring authentication to access this video. Please try a different video or try again later.");
          } else {
            throw downloadError;
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
 * Get transcript from Supadata API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Transcript text
 */
const getSupadataTranscript = async (videoId) => {
  try {
    console.log(`Attempting to get transcript from Supadata API for video ID: ${videoId}`);
    
    const response = await axios.get(`https://api.supadata.ai/v1/youtube/transcript`, {
      params: {
        videoId: videoId
      },
      headers: {
        'x-api-key': SUPADATA_API_KEY
      },
      timeout: 30000 // 30 second timeout
    });
    
    // Check if we have a valid response with transcript data
    if (response.data && response.data.transcript) {
      console.log('Successfully retrieved transcript from Supadata API');
      
      // Format the transcript
      let transcriptText = '';
      if (Array.isArray(response.data.transcript)) {
        // If it's an array of transcript segments
        transcriptText = response.data.transcript
          .map(segment => segment.text)
          .join(' ');
      } else if (typeof response.data.transcript === 'string') {
        // If it's already a string
        transcriptText = response.data.transcript;
      }
      
      return transcriptText;
    } else if (response.data && response.data.error) {
      // If Supadata returns an error message
      throw new Error(`Supadata API error: ${response.data.error}`);
    } else {
      throw new Error('No transcript data in Supadata API response');
    }
  } catch (error) {
    console.error('Error with Supadata API:', error.message);
    if (error.response) {
      console.error('Supadata API response status:', error.response.status);
      console.error('Supadata API response data:', JSON.stringify(error.response.data));
    }
    throw error;
  }
};

/**
 * Downloads audio from YouTube video using a proxy service
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Path to downloaded audio
 */
const downloadYouTubeAudioWithProxy = async (videoId) => {
  try {
    console.log(`Attempting to download audio with proxy service for video ID: ${videoId}`);
    
    const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    
    // Try using a YouTube to MP3 API service
    try {
      console.log('Trying YouTube to MP3 API service...');
      
      // Using a more reliable YouTube to MP3 API
      const apiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;
      
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Referer': 'https://www.google.com/'
        },
        timeout: 30000
      });
      
      // Extract the download link from the HTML response
      const htmlResponse = response.data;
      const downloadLink = htmlResponse.match(/href="(https:\/\/[^"]+\.mp3)"/);
      
      if (downloadLink && downloadLink[1]) {
        console.log(`Found MP3 download link: ${downloadLink[1]}`);
        
        // Download the file
        const fileResponse = await axios({
          method: 'GET',
          url: downloadLink[1],
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
          },
          timeout: 60000
        });
        
        // Save the file
        const writer = fs.createWriteStream(outputPath);
        fileResponse.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            console.log(`Audio saved to ${outputPath}`);
            resolve(outputPath);
          });
          writer.on('error', reject);
        });
      } else {
        throw new Error('No download link found in API response');
      }
    } catch (apiError) {
      console.log(`Error with YouTube to MP3 API: ${apiError.message}`);
    }
    
    // Try using a direct download service
    try {
      console.log('Trying direct download service...');
      
      // Using ytmp3.cc API (another YouTube downloader)
      const downloadUrl = `https://ytmp3.cc/download/?url=https://www.youtube.com/watch?v=${videoId}`;
      
      const browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === 'production' 
          ? '/usr/bin/google-chrome'  // Path to Chrome on Render
          : process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Local Chrome path
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
      
      try {
        const page = await browser.newPage();
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
        
        // Navigate to download page
        await page.goto(downloadUrl, { 
          waitUntil: 'networkidle2',
          timeout: 60000 
        });
        
        // Wait for the download button to appear
        await page.waitForSelector('a.download', { timeout: 60000 });
        
        // Get the download link
        const mp3Url = await page.evaluate(() => {
          const downloadBtn = document.querySelector('a.download');
          return downloadBtn ? downloadBtn.href : null;
        });
        
        if (mp3Url) {
          console.log(`Found MP3 URL: ${mp3Url}`);
          
          // Download the file
          const response = await axios({
            method: 'GET',
            url: mp3Url,
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
              'Referer': downloadUrl
            },
            timeout: 60000
          });
          
          // Save the file
          const writer = fs.createWriteStream(outputPath);
          response.data.pipe(writer);
          
          return new Promise((resolve, reject) => {
            writer.on('finish', () => {
              console.log(`Audio saved to ${outputPath}`);
              resolve(outputPath);
            });
            writer.on('error', reject);
          });
        } else {
          throw new Error('No download link found');
        }
      } finally {
        await browser.close();
      }
    } catch (directError) {
      console.log(`Error with direct download service: ${directError.message}`);
    }
    
    // Try using a YouTube API proxy
    try {
      console.log('Trying YouTube API proxy...');
      
      // Using a proxy service that can bypass YouTube restrictions
      const proxyUrl = `https://pipedapi.kavin.rocks/streams/${videoId}`;
      
      const response = await axios.get(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        },
        timeout: 30000
      });
      
      // Find the audio stream URL
      if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
        // Get the highest quality audio stream
        const audioStream = response.data.audioStreams.reduce((best, current) => {
          return (current.bitrate > best.bitrate) ? current : best;
        }, response.data.audioStreams[0]);
        
        console.log(`Found audio stream URL: ${audioStream.url}`);
        
        // Download the file
        const fileResponse = await axios({
          method: 'GET',
          url: audioStream.url,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
          },
          timeout: 60000
        });
        
        // Save the file
        const writer = fs.createWriteStream(outputPath);
        fileResponse.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            console.log(`Audio saved to ${outputPath}`);
            resolve(outputPath);
          });
          writer.on('error', reject);
        });
      } else {
        throw new Error('No audio streams found in proxy response');
      }
    } catch (proxyError) {
      console.log(`Error with YouTube API proxy: ${proxyError.message}`);
    }
    
    throw new Error('All proxy methods failed to download the audio');
  } catch (error) {
    console.error('Error downloading YouTube audio with proxy:', error);
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
    
    let transcription = '';
    let videoTitle = '';
    
    // Try to get transcript using Supadata API first (new primary method)
    try {
      transcription = await getSupadataTranscript(videoId);
      console.log('Successfully obtained transcript from Supadata API');
    } catch (supadataError) {
      console.log(`Error with Supadata API: ${supadataError.message}`);
      
      // Fall back to youtube-transcript-api
      try {
        console.log(`Attempting to get transcript using youtube-transcript-api for video ID: ${videoId}`);
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
        
        if (transcriptData && transcriptData.length > 0) {
          transcription = transcriptData.map(item => item.text).join(' ');
          console.log('Successfully obtained transcript from youtube-transcript-api');
        } else {
          throw new Error('No transcript data returned from youtube-transcript-api');
        }
      } catch (ytTranscriptError) {
        console.log(`Error with youtube-transcript-api: ${ytTranscriptError.message}`);
        
        // Fall back to YouTube API
        try {
          console.log(`Getting video info for video ID: ${videoId} via API`);
          const videoInfo = await getVideoInfo(videoId);
          videoTitle = videoInfo.title;
          
          if (videoInfo.transcript) {
            transcription = videoInfo.transcript;
            console.log(`Successfully obtained transcript from YouTube API`);
          } else {
            throw new Error(`No transcript available for video: "${videoTitle}"`);
          }
        } catch (apiError) {
          console.log(`Error with YouTube API: ${apiError.message}`);
          console.log('Falling back to audio transcription...');
          
          // Fall back to audio download and transcription
          try {
            console.log('No transcript available, attempting to download audio...');
            
            // Try with yt-dlp first
            let audioPath;
            try {
              audioPath = await downloadYouTubeAudio(videoId);
            } catch (ytdlpError) {
              console.log('Error with yt-dlp, trying Puppeteer approach...');
              try {
                audioPath = await downloadYouTubeAudioWithPuppeteer(videoId);
              } catch (puppeteerError) {
                console.log('Error with Puppeteer, trying proxy approach...');
                audioPath = await downloadYouTubeAudioWithProxy(videoId);
              }
            }
            
            // Transcribe the audio
            transcription = await transcribeAudio(audioPath);
            
            // Clean up the audio file
            try {
              await fs.promises.unlink(audioPath);
            } catch (cleanupError) {
              console.error('Error cleaning up audio file:', cleanupError);
            }
          } catch (downloadError) {
            console.error('Error downloading or transcribing audio:', downloadError);
            throw new Error('Failed to process YouTube video. YouTube may be blocking automated access. Please try a different video or try again later.');
          }
        }
      }
    }
    
    // If we don't have a transcription at this point, we need to inform the user
    if (!transcription) {
      throw new Error("Could not retrieve or generate a transcript for this video. Please try a different video.");
    }
    
    // Process the transcription based on output type
    if (outputType === "summary") {
      const summaryOptions = options.summaryOptions || {};
      const summary = await summarizeText(transcription, summaryOptions);
      
      return {
        videoId,
        title: videoTitle,
        summary,
        transcription: options.includeTranscription ? transcription : undefined
      };
    } else if (outputType === "questions") {
      return await generateQuestions(transcription, options);
    } else {
      return {
        videoId,
        title: videoTitle,
        transcription
      };
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
  downloadYouTubeAudioWithPuppeteer,
  downloadYouTubeAudioWithProxy,
  getSupadataTranscript
}; 
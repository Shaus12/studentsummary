import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  processYouTube,
  transcribeAudio, 
  summarizeText,
  processUploadedFile,
  generatePDF
} from './Transcribe_and_summarize/index.js';
import { unlink } from 'fs/promises';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import PDFDocument from 'pdfkit';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { processAudioFile } from './Transcribe_and_summarize/audio.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors({
  origin: ['http://207.154.192.212', 'http://207.154.192.212:5001'],
  credentials: true
}));

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
}

// Serve static files from the temp directory
app.use('/files', express.static(path.join(__dirname, 'temp')));

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize Deepgram client
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || '2a60d94169738ee178d20bb606126fdd56c85710';
const deepgram = createClient(deepgramApiKey);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

try {
  await db.connect();
  console.log('Connected to PostgreSQL');
} catch (err) {
  console.error('Database connection error:', err);
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'temp'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload_' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer with increased file size limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept audio and video files
    if (file.mimetype.startsWith('audio/') || 
        file.mimetype.startsWith('video/') ||
        file.originalname.match(/\.(mp3|wav|m4a|flac|ogg|mp4|mov|avi|wmv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and video files are allowed!'), false);
    }
  }
});

// Configure Express to handle larger payloads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Update the checkAndUpdateUsage function
const checkAndUpdateUsage = async (userEmail) => {
  try {
    // For now, just allow all users
    return { allowed: true };
  } catch (error) {
    console.error('Error checking usage:', error);
    // If there's an error, allow the user to proceed
    return { allowed: true };
  }
};

// Simplified setup function
const setupMembershipColumn = async () => {
  try {
    // Create enum type if it doesn't exist
    await db.query(`
      DO $$ BEGIN
        CREATE TYPE membership_status AS ENUM ('free', 'premium');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add only membership_type column
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS membership_type membership_status DEFAULT 'free'
    `);
    
    console.log('Membership column added to users table');
  } catch (error) {
    console.error('Error setting up membership column:', error);
  }
};

// Simplified upgrade endpoint
app.post("/api/upgrade-membership", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Simple upgrade to premium
    await db.query(`
      UPDATE users 
      SET membership_type = 'premium'
      WHERE email = $1
      RETURNING *
    `, [userEmail]);

    res.json({ message: "Membership upgraded successfully" });
  } catch (error) {
    console.error('Error upgrading membership:', error);
    res.status(500).json({ 
      message: "Error upgrading membership",
      error: error.message 
    });
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.query(
      "INSERT INTO users (email, password, first_name, last_name, membership_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [email, hashedPassword, firstName, lastName, 'free']
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;

    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "משתמש לא קיים" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "סיסמה שגויה" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        membershipType: user.membership_type
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

app.post("/api/google-login", async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    // Check if user exists in database
    let result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [payload.email]
    );

    let user = result.rows[0];

    // If user doesn't exist, create new user
    if (!user) {
      result = await db.query(
        `INSERT INTO users (email, first_name, last_name, google_id, password, membership_type) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          payload.email, 
          payload.given_name, 
          payload.family_name, 
          payload.sub,
          'GOOGLE_USER', // placeholder password for Google users
          'free'         // default membership type
        ]
      );
      user = result.rows[0];
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        membershipType: user.membership_type
      }
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

app.post("/api/process-youtube", async (req, res) => {
  try {
    console.log('Processing YouTube video request received');
    console.log('Full request:', {
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    // Use let instead of const for youtubeUrl so we can reassign it
    let youtubeUrl = req.body.youtubeUrl || req.body.url || req.query.youtubeUrl;
    console.log('YouTube URL:', youtubeUrl);
    
    // Check if the URL might be in a different property
    if (!youtubeUrl) {
      console.log('Checking other possible properties in request body...');
      for (const key in req.body) {
        console.log(`Property ${key}:`, req.body[key]);
        if (typeof req.body[key] === 'string' && 
            (req.body[key].includes('youtube.com') || req.body[key].includes('youtu.be'))) {
          console.log(`Found YouTube URL in property ${key}`);
          youtubeUrl = req.body[key];
          break;
        }
      }
    }
    
    // Validate YouTube URL
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      console.error('Invalid YouTube URL:', youtubeUrl);
      return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube URL.' });
    }
    
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.error('No authorization token provided');
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      console.error('Invalid token:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get output type from request
    const outputType = req.body.outputType || 'summary';
    
    // Get summary options from request
    const summaryOptions = req.body.summaryOptions || {};
    
    // Check if user is allowed to process videos
    const usageCheck = await checkAndUpdateUsage(userEmail);
    if (!usageCheck.allowed) {
      return res.status(403).json({ error: 'Usage limit exceeded' });
    }
    
    // Process the YouTube video
    const result = await processYouTube(youtubeUrl, outputType, summaryOptions);
    
    // Save the result to the database
    const insertResult = await db.query(
      `INSERT INTO summaries (user_email, video_url, summary, pdf_path, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [userEmail, youtubeUrl, result.summary, result.pdfPath]
    );
    
    const summaryId = insertResult.rows[0].id;
    
    // Return the result
    res.json({
      id: summaryId,
      summary: result.summary,
      pdfPath: result.pdfPath ? `/files/${path.basename(result.pdfPath)}` : null,
      method: result.method
    });
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ 
      error: 'Error processing YouTube video', 
      details: error.message 
    });
  }
});

app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    console.log('Audio upload request received');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    console.log('File uploaded:', req.file);
    
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get output type from request
    const outputType = req.body.outputType || 'summary';
    
    // Check if user is allowed to process audio
    const usageCheck = await checkAndUpdateUsage(userEmail);
    if (!usageCheck.allowed) {
      // Clean up the uploaded file
      await unlink(req.file.path);
      return res.status(403).json({ error: 'Usage limit exceeded' });
    }
    
    // Process the uploaded file
    const result = await processUploadedFile(req.file.path, outputType);
    
    // Clean up the uploaded file
    await unlink(req.file.path);
    
    // Save the result to the database
    const insertResult = await db.query(
      `INSERT INTO summaries (user_email, file_name, summary, pdf_path, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [userEmail, req.file.originalname, result.summary, result.pdfPath]
    );
    
    const summaryId = insertResult.rows[0].id;
    
    // Return the result
    res.json({
      id: summaryId,
      summary: result.summary,
      pdfPath: result.pdfPath ? `/files/${path.basename(result.pdfPath)}` : null
    });
  } catch (error) {
    console.error('Error processing audio file:', error);
    
    // Clean up the uploaded file if it exists
    if (req.file) {
      try {
        await unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      error: 'Error processing audio file', 
      details: error.message 
    });
  }
});

// Add this middleware to debug authentication issues
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(`Request to ${req.path}, Auth header: ${authHeader ? 'Present' : 'Missing'}`);
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`Token verified for user: ${decoded.email}`);
    } catch (error) {
      console.error(`Token verification failed: ${error.message}`);
    }
  }
  
  next();
});

// Add or update the summaries endpoint
app.get('/api/summaries', async (req, res) => {
  try {
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('No token provided for /api/summaries');
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
      console.log(`Getting summaries for user: ${userEmail}`);
    } catch (error) {
      console.error('Invalid token:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get summaries for the user
    const result = await db.query(
      `SELECT id, video_url, file_name, summary, pdf_path, created_at, title
       FROM summaries
       WHERE user_email = $1
       ORDER BY created_at DESC`,
      [userEmail]
    );
    
    console.log(`Found ${result.rows.length} summaries for user ${userEmail}`);
    
    // Format the results
    const summaries = result.rows.map(row => ({
      id: row.id,
      source: row.video_url || row.file_name || row.title || 'Unknown source',
      summary: row.summary,
      pdfPath: row.pdf_path ? `/files/${path.basename(row.pdf_path)}` : null,
      createdAt: row.created_at
    }));
    
    // Return an empty array if no summaries found
    res.json(summaries || []);
  } catch (error) {
    console.error('Error getting summaries:', error);
    res.status(500).json({ 
      error: 'Error getting summaries', 
      details: error.message 
    });
  }
});

app.get('/api/summary/:id', async (req, res) => {
  try {
    const summaryId = req.params.id;
    
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get the summary
    const result = await db.query(
      `SELECT id, video_url, file_name, summary, pdf_path, created_at, title
       FROM summaries
       WHERE id = $1 AND user_email = $2`,
      [summaryId, userEmail]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Summary not found' });
    }
    
    const summary = result.rows[0];
    
    res.json({
      id: summary.id,
      source: summary.video_url || summary.file_name || summary.title || 'Unknown source',
      summary: summary.summary,
      pdfPath: summary.pdf_path ? `/files/${path.basename(summary.pdf_path)}` : null,
      createdAt: summary.created_at
    });
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({ 
      error: 'Error getting summary', 
      details: error.message 
    });
  }
});

app.delete('/api/summary/:id', async (req, res) => {
  try {
    const summaryId = req.params.id;
    
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get the summary to check if it exists and belongs to the user
    const checkResult = await db.query(
      `SELECT id, pdf_path
       FROM summaries
       WHERE id = $1 AND user_email = $2`,
      [summaryId, userEmail]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Summary not found' });
    }
    
    const summary = checkResult.rows[0];
    
    // Delete the PDF file if it exists
    if (summary.pdf_path) {
      try {
        await unlink(summary.pdf_path);
      } catch (unlinkError) {
        console.error('Error deleting PDF file:', unlinkError);
      }
    }
    
    // Delete the summary from the database
    await db.query(
      `DELETE FROM summaries
       WHERE id = $1`,
      [summaryId]
    );
    
    res.json({ message: 'Summary deleted successfully' });
  } catch (error) {
    console.error('Error deleting summary:', error);
    res.status(500).json({ 
      error: 'Error deleting summary', 
      details: error.message 
    });
  }
});

// Add this middleware function to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

// Also, fix the pool reference in the usage-status endpoint
app.get('/api/usage-status', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    
    // Get the user from the database (using db instead of pool)
    const user = await db.query(
      'SELECT membership_type, usage_count FROM users WHERE email = $1',
      [email]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user.rows[0];
    
    // Define usage limits based on membership level
    const limits = {
      free: 5,
      basic: 20,
      premium: 100,
      unlimited: Infinity
    };
    
    // Get the user's membership level (default to 'free' if not set)
    const membershipLevel = userData.membership_type || 'free';
    const usageCount = userData.usage_count || 0;
    const usageLimit = limits[membershipLevel] || limits.free;
    
    // Calculate remaining usage
    const remainingUsage = Math.max(0, usageLimit - usageCount);
    
    // Return the usage status
    res.json({
      membership: membershipLevel,
      usageCount: usageCount,
      usageLimit: usageLimit === Infinity ? 'unlimited' : usageLimit,
      remainingUsage: usageLimit === Infinity ? 'unlimited' : remainingUsage,
      canUseService: usageLimit === Infinity || usageCount < usageLimit
    });
    
  } catch (error) {
    console.error('Error getting usage status:', error);
    res.status(500).json({ error: 'Failed to get usage status' });
  }
});

// Add this endpoint to your Express app
app.post('/api/transcribe/upload', authenticateToken, upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    console.log(`Audio file uploaded: ${req.file.path}`);
    console.log(`Original filename: ${req.file.originalname}`);
    console.log(`File size: ${req.file.size} bytes`);
    
    // Get processing options from request body
    const options = {
      outputType: req.body.outputType || 'transcription',
      includeTranscription: req.body.includeTranscription === 'true',
      language: req.body.language || 'en',
      summaryOptions: req.body.summaryOptions ? JSON.parse(req.body.summaryOptions) : {}
    };
    
    console.log('Processing options:', options);
    
    // Process the uploaded file
    const result = await processAudioFile(req.file.path, options);
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    // Return the result
    res.json(result);
  } catch (error) {
    console.error('Error processing uploaded audio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update your audio processing endpoint
app.post('/api/process-audio', upload.single('audioFile'), async (req, res) => {
  try {
    console.log('Audio file upload request received');
    
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file uploaded',
        success: false
      });
    }
    
    console.log(`Audio file uploaded: ${req.file.path}`);
    console.log(`Original filename: ${req.file.originalname}`);
    console.log(`File size: ${req.file.size} bytes`);
    
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get processing options from request body
    const options = {
      outputType: req.body.outputType || 'summary',
      includeTranscription: req.body.includeTranscription === 'true',
      language: 'he', // Default to Hebrew
      summaryOptions: req.body.summaryOptions ? 
        (typeof req.body.summaryOptions === 'string' ? 
          JSON.parse(req.body.summaryOptions) : req.body.summaryOptions) : 
        { language: 'he', style: 'detailed', format: 'bullets' }
    };
    
    console.log('Processing options:', options);
    
    // Process the uploaded file
    const { processAudioFile } = await import('./Transcribe_and_summarize/audio.js');
    const result = await processAudioFile(req.file.path, options);
    
    // Save the result to the database
    const insertResult = await db.query(
      `INSERT INTO summaries (user_email, file_name, summary, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [userEmail, req.file.originalname, result.summary || result.transcription]
    );
    
    const summaryId = insertResult.rows[0].id;
    
    // Return the result
    res.json({
      id: summaryId,
      summary: result.summary || result.transcription,
      success: true
    });
  } catch (error) {
    console.error('Error processing uploaded audio:', error);
    res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
});

// Add a route to handle larger file uploads through chunking if needed
app.post('/api/upload-large-file', (req, res) => {
  const busboy = require('busboy');
  const bb = busboy({ headers: req.headers });
  
  let filePath = '';
  let fileName = '';
  
  bb.on('file', (name, file, info) => {
    fileName = info.filename;
    filePath = path.join(__dirname, 'temp', `upload_${Date.now()}_${fileName}`);
    file.pipe(fs.createWriteStream(filePath));
  });
  
  bb.on('finish', async () => {
    try {
      console.log(`Large file uploaded: ${filePath}`);
      
      // Process the file
      const { processAudioFile } = await import('./Transcribe_and_summarize/audio.js');
      const result = await processAudioFile(filePath, {
        outputType: 'summary',
        summaryOptions: { language: 'he' }
      });
      
      res.json({
        ...result,
        success: true
      });
    } catch (error) {
      console.error('Error processing large file:', error);
      res.status(500).json({ 
        error: error.message,
        success: false
      });
    }
  });
  
  req.pipe(bb);
});

// Create a chunked file upload endpoint
app.post('/api/upload-chunk', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    // Get chunk information from headers
    const chunkIndex = parseInt(req.headers['x-chunk-index']);
    const totalChunks = parseInt(req.headers['x-total-chunks']);
    const fileName = req.headers['x-file-name'];
    const fileId = req.headers['x-file-id'] || uuidv4();
    
    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for file ${fileName} (ID: ${fileId})`);
    
    // Create directory for chunks if it doesn't exist
    const chunksDir = path.join(__dirname, 'temp', 'chunks', fileId);
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    // Save the chunk
    const chunkPath = path.join(chunksDir, `${chunkIndex}`);
    fs.writeFileSync(chunkPath, req.body);
    
    // Check if all chunks have been uploaded
    if (chunkIndex === totalChunks - 1) {
      // All chunks received, combine them
      const outputPath = path.join(__dirname, 'temp', `${fileId}_${fileName}`);
      const outputStream = fs.createWriteStream(outputPath);
      
      // Combine chunks in order
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunksDir, `${i}`);
        const chunkData = fs.readFileSync(chunkPath);
        outputStream.write(chunkData);
      }
      
      outputStream.end();
      
      // Wait for the file to be fully written
      await new Promise(resolve => outputStream.on('finish', resolve));
      
      console.log(`All chunks combined into ${outputPath}`);
      
      // Clean up chunks
      for (let i = 0; i < totalChunks; i++) {
        fs.unlinkSync(path.join(chunksDir, `${i}`));
      }
      fs.rmdirSync(chunksDir);
      
      // Return the file ID and path for processing
      res.json({
        fileId,
        fileName,
        filePath: outputPath,
        success: true,
        complete: true
      });
    } else {
      // More chunks expected
      res.json({
        fileId,
        success: true,
        complete: false,
        chunksReceived: chunkIndex + 1,
        totalChunks
      });
    }
  } catch (error) {
    console.error('Error handling chunk upload:', error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// Add an endpoint to process the uploaded file
app.post('/api/process-chunked-file', async (req, res) => {
  try {
    const { fileId, fileName, filePath } = req.body;
    
    if (!fileId || !fileName || !filePath) {
      return res.status(400).json({
        error: 'Missing file information',
        success: false
      });
    }
    
    console.log(`Processing chunked file: ${fileName} (ID: ${fileId})`);
    
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Process the file
    const { processAudioFile } = await import('./Transcribe_and_summarize/audio.js');
    const result = await processAudioFile(filePath, {
      outputType: 'summary',
      language: 'he',
      summaryOptions: { language: 'he' }
    });
    
    // Save the result to the database
    const insertResult = await db.query(
      `INSERT INTO summaries (user_email, file_name, summary, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [userEmail, fileName, result.summary || result.transcription]
    );
    
    const summaryId = insertResult.rows[0].id;
    
    // Clean up the file
    fs.unlinkSync(filePath);
    
    // Return the result
    res.json({
      id: summaryId,
      summary: result.summary || result.transcription,
      success: true
    });
  } catch (error) {
    console.error('Error processing chunked file:', error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// Client-side chunked upload function
async function uploadLargeFile(file) {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);
  const fileId = Date.now().toString(); // Simple unique ID
  
  console.log(`Uploading file: ${file.name}, size: ${file.size} bytes, chunks: ${totalChunks}`);
  
  // Upload each chunk
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);
    
    console.log(`Uploading chunk ${i + 1}/${totalChunks}, size: ${chunk.size} bytes`);
    
    const token = localStorage.getItem('token'); // Or however you store your auth token
    
    try {
      const response = await fetch('/api/upload-chunk', {
        method: 'POST',
        body: chunk,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Chunk-Index': i.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-File-Name': file.name,
          'X-File-Id': fileId,
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chunk upload failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      // If this was the last chunk, process the file
      if (result.complete) {
        console.log('All chunks uploaded, processing file...');
        
        const processResponse = await fetch('/api/process-chunked-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileId,
            fileName: file.name,
            filePath: result.filePath
          })
        });
        
        if (!processResponse.ok) {
          const errorText = await processResponse.text();
          throw new Error(`File processing failed: ${processResponse.status} ${errorText}`);
        }
        
        return await processResponse.json();
      }
    } catch (error) {
      console.error(`Error uploading chunk ${i + 1}:`, error);
      throw error;
    }
  }
}

// Add a usage status endpoint
app.get('/api/usage-status', async (req, res) => {
  try {
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    let userEmail;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userEmail = decoded.email;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get user information
    const userResult = await db.query(
      `SELECT membership_type FROM users WHERE email = $1`,
      [userEmail]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const membershipType = userResult.rows[0].membership_type;
    
    // Get usage statistics
    const usageResult = await db.query(
      `SELECT COUNT(*) as total_summaries FROM summaries WHERE user_email = $1`,
      [userEmail]
    );
    
    const totalSummaries = parseInt(usageResult.rows[0].total_summaries) || 0;
    
    // Define limits based on membership type
    const limits = {
      free: {
        maxSummaries: 5,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        features: ['basic_summaries']
      },
      premium: {
        maxSummaries: 100,
        maxFileSize: 500 * 1024 * 1024, // 500MB
        features: ['basic_summaries', 'advanced_summaries', 'pdf_export']
      }
    };
    
    const userLimits = limits[membershipType] || limits.free;
    
    // Return usage information
    res.json({
      membershipType,
      usage: {
        summaries: totalSummaries,
        remainingSummaries: Math.max(0, userLimits.maxSummaries - totalSummaries)
      },
      limits: userLimits,
      success: true
    });
  } catch (error) {
    console.error('Error getting usage status:', error);
    res.status(500).json({ 
      error: 'Error getting usage status', 
      details: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set up membership column
  setupMembershipColumn();
});
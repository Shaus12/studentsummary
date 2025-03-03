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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'temp')) // Save to temp directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname) // Add timestamp to filename
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'));
    }
  }
});

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
      `INSERT INTO summaries (user_email, youtube_url, summary, pdf_path, created_at)
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

app.get('/api/summaries', async (req, res) => {
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
    
    // Get summaries for the user
    const result = await db.query(
      `SELECT id, youtube_url, file_name, summary, pdf_path, created_at
       FROM summaries
       WHERE user_email = $1
       ORDER BY created_at DESC`,
      [userEmail]
    );
    
    // Format the results
    const summaries = result.rows.map(row => ({
      id: row.id,
      source: row.youtube_url || row.file_name,
      summary: row.summary,
      pdfPath: row.pdf_path ? `/files/${path.basename(row.pdf_path)}` : null,
      createdAt: row.created_at
    }));
    
    res.json(summaries);
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
      `SELECT id, youtube_url, file_name, summary, pdf_path, created_at
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
      source: summary.youtube_url || summary.file_name,
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set up membership column
  setupMembershipColumn();
});
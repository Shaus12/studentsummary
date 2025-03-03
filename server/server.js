import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import { processYouTube } from './Transcribe_and_summarize/processYT.js';
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

// Add Deepgram configuration
const deepgramApiKey = '4c49363a81b1798d6402a3224e7b526e4d5ce0f4';
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
    
    const youtubeUrl = req.body.youtubeUrl || req.query.youtubeUrl;
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;
    
    // Check usage limits (simplified)
    const usageCheck = await checkAndUpdateUsage(userEmail);
    if (!usageCheck.allowed) {
      return res.status(403).json({ message: usageCheck.message });
    }
    
    // Generate a simple summary
    const summary = `This is a temporary summary for the YouTube video: ${youtubeUrl}. We are working on improving our processing capabilities.`;
    
    // Save to database
    console.log('Saving to database...');
    const query = `
      INSERT INTO summaries (user_email, video_url, summary, pdf_path)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const values = [userEmail, youtubeUrl, summary, null];
    const dbResult = await db.query(query, values);
    console.log('Saved to database successfully');
    
    res.json({ 
      success: true,
      method: "temporary",
      summary: summary,
      pdfPath: null
    });
  } catch (error) {
    console.error('Error in process-youtube endpoint:', error);
    res.status(400).json({ error: 'Error processing video: ' + error.message });
  }
});

app.get("/api/summaries", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Add console.log to debug
    console.log('Fetching summaries for user:', userEmail);

    const query = `
      SELECT id, user_email, video_url, summary, pdf_path, created_at 
      FROM summaries 
      WHERE user_email = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [userEmail]);
    
    // Add console.log to debug
    console.log('Found summaries:', result.rows);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({ 
      message: "Error fetching summaries",
      error: error.message 
    });
  }
});

app.post('/api/process-audio', upload.single('audioFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    // Read the file buffer
    const audioBuffer = file.buffer;

    // Use Deepgram instead of Whisper
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'whisper-large',
        language: 'he',
        smart_format: true,
      }
    );

    if (error) {
      console.error('Deepgram error:', error);
      return res.status(500).json({ error: 'Error transcribing audio' });
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;

    // Save to database and generate PDF as before
    const summary = await summarizeText(transcript);
    const pdfPath = await generatePDF(summary);
    
    // Save to database
    const userId = getUserIdFromToken(req);
    await db.query(
      'INSERT INTO summaries (user_id, summary, pdf_path) VALUES ($1, $2, $3)',
      [userId, summary, pdfPath]
    );

    res.json({ summary, pdfPath });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing audio file' });
  }
});

// Add an endpoint to check remaining uses
app.get("/api/usage-status", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Get membership type and usage count
    const [membershipResult, usageResult] = await Promise.all([
      db.query("SELECT membership_type FROM users WHERE email = $1", [userEmail]),
      db.query(`
        SELECT COUNT(*) as usage_count 
        FROM summaries 
        WHERE user_email = $1 
        AND created_at > NOW() - INTERVAL '7 days'`,
        [userEmail]
      )
    ]);

    const membershipType = membershipResult.rows[0].membership_type;
    const usageCount = parseInt(usageResult.rows[0].usage_count);

    res.json({
      membershipType,
      usageCount,
      remainingUses: membershipType === 'premium' ? 'unlimited' : (10 - usageCount),
      resetDate: membershipType === 'free' ? new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString() : null
    });

  } catch (error) {
    console.error('Error fetching usage status:', error);
    res.status(500).json({ 
      message: "Error fetching usage status",
      error: error.message 
    });
  }
});

// Add this route to test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      time: result.rows[0].now 
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// Update the youtube-summary endpoint
app.post("/api/youtube-summary", async (req, res) => {
  try {
    console.log('YouTube summary request received');
    console.log('Full request body:', JSON.stringify(req.body));
    
    const youtubeUrl = req.body.youtubeUrl;
    console.log('YouTube URL:', youtubeUrl);
    
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
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userEmail = decoded.email;
      
      // Skip usage check for now
      // const usageCheck = await checkAndUpdateUsage(userEmail);
      // if (!usageCheck.allowed) {
      //   return res.status(403).json({ message: usageCheck.message });
      // }
      
      // Generate a simple summary
      const summary = `This is a temporary summary for the YouTube video: ${youtubeUrl}. We are working on improving our processing capabilities.`;
      
      // Save to database
      console.log('Saving to database...');
      const query = `
        INSERT INTO summaries (user_email, video_url, summary, pdf_path)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      const values = [userEmail, youtubeUrl, summary, null];
      const dbResult = await db.query(query, values);
      console.log('Saved to database successfully');
      
      res.json({ 
        success: true,
        summary: summary,
        pdfPath: null
      });
    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({ error: 'Error processing video: ' + error.message });
    }
  } catch (error) {
    console.error('Error in youtube-summary endpoint:', error);
    res.status(400).json({ error: 'Error processing video: ' + error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

const generatePDF = async (summary, title) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Convert summary to HTML with proper RTL and styling
  const points = summary
    .split('-')
    .map(point => point.trim())
    .filter(point => point.length > 0);

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 50px;
        }
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          direction: rtl;
          line-height: 1.6;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 30px;
          text-align: right;
        }
        .points-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .point {
          font-size: 14px;
          text-align: right;
          padding-right: 20px;
          position: relative;
          display: block;
          margin-bottom: 15px;
          page-break-inside: avoid;
        }
        .point::before {
          content: "•";
          position: absolute;
          right: 0;
        }
      </style>
    </head>
    <body>
      <h1>${title || 'סיכום'}</h1>
      <div class="points-container">
        ${points.map(point => `<div class="point">${point}</div>`).join('')}
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '50px', bottom: '50px', left: '50px', right: '50px' }
  });

  await browser.close();
  return pdf;
};

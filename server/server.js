import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import { unlink } from 'fs/promises';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Import the working audio processing functions
import { transcribeAudio, summarizeText, generatePDF } from './Transcribe_and_summarize/audioProcessing.js';

// Define cleanupFile function
async function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await unlink(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error);
  }
}

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
    const { youtubeUrl } = req.body;
    
    if (!youtubeUrl) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
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
    
    // Process the YouTube video using the imported function
    const result = await processYouTube(youtubeUrl, 'summary', { language: 'he' });
    
    // Save the result to the database
    const insertResult = await db.query(
      `INSERT INTO summaries (user_email, video_url, summary, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [userEmail, youtubeUrl, result.summary]
    );
    
    const summaryId = insertResult.rows[0].id;
    
    // Return the result
    res.json({
      id: summaryId,
      summary: result.summary,
      success: true
    });
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
});

app.post('/api/upload-audio', upload.single('audioFile'), async (req, res) => {
  try {
    console.log('Audio processing request received');
    console.log('Files:', req.file);
    console.log('Body:', req.body);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    console.log('File uploaded for processing:', req.file);
    console.log('Starting to process file:', req.file.path);
    
    // Process the uploaded file using the working implementation
    const transcript = await transcribeAudio(req.file.path);
    console.log(`Transcript received, length: ${transcript.length}`);
    
    const summary = await summarizeText(transcript);
    console.log(`Summary generated, length: ${summary.length}`);
    
    // Generate PDF if requested
    let pdfPath = null;
    if (req.body.outputType === 'pdf') {
      pdfPath = await generatePDF(summary);
    }
    
    const result = {
      summary,
      pdfPath,
      method: 'upload'
    };
    
    console.log('File processed successfully');
    
    // Get user ID from req.user (set by auth middleware)
    const userId = req.user.id;
    
    // Save the result to the database
    console.log('Saving result to database');
    const summaryResult = await db.query(
      `INSERT INTO summaries (user_id, summary, created_at, file_name)
       VALUES ($1, $2, NOW(), $3)
       RETURNING id`,
      [userId, result.summary, req.file.originalname]
    );
    
    const summaryId = summaryResult.rows[0].id;
    console.log('Summary saved with ID:', summaryId);
    
    // Clean up the uploaded file
    await cleanupFile(req.file.path);
    
    // Send the response
    res.json({
      success: true,
      summary: result.summary,
      pdfPath: result.pdfPath,
      method: 'upload'
    });
  } catch (error) {
    console.error('Error processing audio file:', error);
    
    // Clean up the uploaded file if it exists
    if (req.file && req.file.path) {
      await cleanupFile(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to process audio file', 
      details: error.message 
    });
  }
});

// Update the process-audio endpoint to accept any field name
app.post('/api/process-audio', upload.any(), async (req, res) => {
  try {
    console.log('Audio processing request received');
    console.log('Files:', req.files);
    console.log('Body:', req.body);
    
    // Check if any files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    // Use the first uploaded file
    const uploadedFile = req.files[0];
    console.log('File uploaded for processing:', uploadedFile);
    
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
    
    // Check if user is allowed to process audio
    const usageCheck = await checkAndUpdateUsage(userEmail);
    if (!usageCheck.allowed) {
      // Clean up the uploaded file
      await cleanupFile(uploadedFile.path);
      return res.status(403).json({ error: 'Usage limit exceeded' });
    }
    
    // Process the uploaded file
    try {
      console.log('Starting to process file:', uploadedFile.path);
      
      // Process the uploaded file using the working implementation
      const transcript = await transcribeAudio(uploadedFile.path);
      const summary = await summarizeText(transcript);
      
      // Generate PDF if requested
      let pdfPath = null;
      if (req.body.outputType === 'pdf') {
        pdfPath = await generatePDF(summary);
      }
      
      const result = {
        summary,
        pdfPath,
        method: 'upload'
      };
      
      console.log('File processed successfully');
      
      // Save the result to the database
      const summaryId = await db.query(
        `INSERT INTO summaries (user_email, summary, created_at, file_name)
         VALUES ($1, $2, NOW(), $3)
         RETURNING id`,
        [userEmail, result.summary, uploadedFile.originalname]
      );
      
      // Send the response
      res.json({
        success: true,
        summary: result.summary,
        pdfPath: result.pdfPath,
        method: 'upload'
      });
    } catch (error) {
      console.error('Error in processing file:', error);
      // Clean up the uploaded file
      await cleanupFile(uploadedFile.path);
      throw error;
    }
  } catch (error) {
    console.error('Error processing audio file:', error);
    res.status(500).json({ 
      error: 'Failed to process audio file', 
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Setup membership column
  setupMembershipColumn();
});
import express from "express";
import bcrypt from "bcrypt";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import processYouTubeVideo from './Transcribe_and_summarize/processYouTube.js';
import { transcribeAudio, summarizeText, createSummaryPDF } from './Transcribe_and_summarize/processYouTube.js';
import { unlink } from 'fs/promises';
import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

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

// Add this helper function at the top of your file
const checkAndUpdateUsage = async (userEmail) => {
  try {
    // First check membership type
    const membershipResult = await db.query(
      "SELECT membership_type FROM users WHERE email = $1",
      [userEmail]
    );
    
    if (membershipResult.rows[0].membership_type === 'premium') {
      return { allowed: true };
    }

    // For free users, check their usage in the last 7 days
    const usageResult = await db.query(`
      SELECT COUNT(*) as usage_count 
      FROM summaries 
      WHERE user_email = $1 
      AND created_at > NOW() - INTERVAL '7 days'`,
      [userEmail]
    );

    const usageCount = parseInt(usageResult.rows[0].usage_count);
    
    if (usageCount >= 10) {
      return {
        allowed: false,
        message: "You have reached your weekly limit of 10 transcriptions. Upgrade to premium for unlimited use!"
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking usage:', error);
    throw error;
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
  const { email, password } = req.body;

  try {
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

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "Internal Server Error" });
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
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const result = await processYouTubeVideo(youtubeUrl);
    
    // Save to database with title
    const query = `
      INSERT INTO summaries (user_email, video_url, summary, pdf_path, title)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    await db.query(query, [
      userEmail,
      youtubeUrl,
      result.summary,
      result.pdfPath,
      result.title
    ]);

    res.json(result);
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ 
      message: "Error processing video",
      error: error.message 
    });
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

app.post("/api/process-audio", upload.single('audioFile'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Check usage limits
    const usageCheck = await checkAndUpdateUsage(userEmail);
    if (!usageCheck.allowed) {
      return res.status(403).json({ message: usageCheck.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    
    // Process the audio file using the same functions as YouTube videos
    const transcription = await transcribeAudio(filePath);
    const summary = await summarizeText(transcription);
    const pdfPath = path.join(path.dirname(filePath), 'summary.pdf');
    await createSummaryPDF(summary, pdfPath);

    // Save to database
    const query = `
      INSERT INTO summaries (user_email, file_name, summary, pdf_path)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      userEmail,
      req.file.originalname,
      summary,
      '/files/summary.pdf'
    ];

    const dbResult = await db.query(query, values);

    // Clean up the original audio file using the promise version
    await unlink(filePath);

    res.json({
      summary: summary,
      pdfPath: '/files/summary.pdf'
    });

  } catch (error) {
    console.error('Error processing audio file:', error);
    res.status(500).json({ 
      message: "Error processing audio file",
      error: error.message 
    });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

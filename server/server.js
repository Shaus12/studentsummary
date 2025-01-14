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
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
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
      'your_jwt_secret',
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
    console.log('Result from processYouTubeVideo:', result); // Debug log

    // Save to database with title
    const query = `
      INSERT INTO summaries (user_email, video_url, summary, pdf_path, title)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      userEmail,
      youtubeUrl,
      result.summary,
      result.pdfPath,
      result.title // Make sure this matches the property name from processYouTubeVideo
    ];

    console.log('Inserting with values:', values); // Debug log
    
    const dbResult = await db.query(query, values);
    console.log('Database insert result:', dbResult.rows[0]); // Debug log

    res.json({
      summary: result.summary,
      pdfPath: result.pdfPath,
      title: result.title // Make sure to send title back to frontend
    });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

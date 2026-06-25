const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'referral_portal_jwt_secret_998877';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static front-end files

// Database setup: PostgreSQL or JSON Fallback
const isPostgres = !!process.env.DATABASE_URL;
let pool = null;

const DB_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const REFERRALS_FILE = path.join(DB_DIR, 'referrals.json');

if (isPostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Initialize PostgreSQL tables
  pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at VARCHAR(255) NOT NULL
    );
  `).then(() => {
    return pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        company VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        linkedin VARCHAR(255),
        job_link VARCHAR(255),
        status VARCHAR(50) DEFAULT 'contacted',
        applied_email VARCHAR(255),
        message TEXT NOT NULL,
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL
      );
    `);
  }).then(() => {
    console.log('PostgreSQL tables initialized successfully.');
  }).catch(err => {
    console.error('Error initializing PostgreSQL tables:', err);
  });
} else {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(REFERRALS_FILE)) {
    fs.writeFileSync(REFERRALS_FILE, JSON.stringify([]));
  }
}

// JSON Database Helpers (used in fallback mode)
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readReferrals() {
  try {
    return JSON.parse(fs.readFileSync(REFERRALS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeReferrals(referrals) {
  fs.writeFileSync(REFERRALS_FILE, JSON.stringify(referrals, null, 2));
}

// Generate UUID helper
function generateUUID() {
  return 'db-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

// Mappers to ensure uniform response objects
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at
  };
}

function mapReferralRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    company: row.company,
    name: row.name,
    linkedin: row.linkedin || '',
    jobLink: row.job_link || '',
    status: row.status,
    appliedEmail: row.applied_email || '',
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Database Abstraction Layer
async function getUserByEmail(email) {
  const emailLower = email.trim().toLowerCase();
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [emailLower]);
    return mapUserRow(res.rows[0]);
  } else {
    const users = readUsers();
    return users.find(u => u.email === emailLower) || null;
  }
}

async function createUser(user) {
  if (isPostgres) {
    await pool.query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
      [user.id, user.email, user.passwordHash, user.createdAt]
    );
  } else {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
  }
}

async function getUserReferrals(userId) {
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM referrals WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows.map(mapReferralRow);
  } else {
    const referrals = readReferrals();
    return referrals.filter(r => r.userId === userId);
  }
}

async function createReferral(referral) {
  if (isPostgres) {
    await pool.query(
      `INSERT INTO referrals (id, user_id, company, name, linkedin, job_link, status, applied_email, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        referral.id,
        referral.userId,
        referral.company,
        referral.name,
        referral.linkedin,
        referral.jobLink,
        referral.status,
        referral.appliedEmail,
        referral.message,
        referral.createdAt,
        referral.updatedAt
      ]
    );
  } else {
    const referrals = readReferrals();
    referrals.push(referral);
    writeReferrals(referrals);
  }
}

async function createReferralsBatch(newReferrals) {
  if (newReferrals.length === 0) return;
  if (isPostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of newReferrals) {
        await client.query(
          `INSERT INTO referrals (id, user_id, company, name, linkedin, job_link, status, applied_email, message, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            r.id,
            r.userId,
            r.company,
            r.name,
            r.linkedin,
            r.jobLink,
            r.status,
            r.appliedEmail,
            r.message,
            r.createdAt,
            r.updatedAt
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    const referrals = readReferrals();
    referrals.push(...newReferrals);
    writeReferrals(referrals);
  }
}

async function updateReferral(id, userId, updates) {
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM referrals WHERE id = $1 AND user_id = $2', [id, userId]);
    if (res.rows.length === 0) return null;
    const current = mapReferralRow(res.rows[0]);
    const updated = {
      ...current,
      company: updates.company !== undefined ? updates.company.trim() : current.company,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      linkedin: updates.linkedin !== undefined ? updates.linkedin.trim() : current.linkedin,
      jobLink: updates.jobLink !== undefined ? updates.jobLink.trim() : current.jobLink,
      status: updates.status !== undefined ? updates.status : current.status,
      appliedEmail: updates.appliedEmail !== undefined ? updates.appliedEmail : current.appliedEmail,
      message: updates.message !== undefined ? updates.message.trim() : current.message,
      updatedAt: new Date().toISOString()
    };
    await pool.query(
      `UPDATE referrals
       SET company = $1, name = $2, linkedin = $3, job_link = $4, status = $5, applied_email = $6, message = $7, updated_at = $8
       WHERE id = $9 AND user_id = $10`,
      [
        updated.company,
        updated.name,
        updated.linkedin,
        updated.jobLink,
        updated.status,
        updated.appliedEmail,
        updated.message,
        updated.updatedAt,
        id,
        userId
      ]
    );
    return updated;
  } else {
    const referrals = readReferrals();
    const index = referrals.findIndex(r => r.id === id && r.userId === userId);
    if (index === -1) return null;
    const currentRef = referrals[index];
    const updatedRef = {
      ...currentRef,
      company: updates.company !== undefined ? updates.company.trim() : currentRef.company,
      name: updates.name !== undefined ? updates.name.trim() : currentRef.name,
      linkedin: updates.linkedin !== undefined ? updates.linkedin.trim() : currentRef.linkedin,
      jobLink: updates.jobLink !== undefined ? updates.jobLink.trim() : currentRef.jobLink,
      status: updates.status !== undefined ? updates.status : currentRef.status,
      appliedEmail: updates.appliedEmail !== undefined ? updates.appliedEmail : currentRef.appliedEmail,
      message: updates.message !== undefined ? updates.message.trim() : currentRef.message,
      updatedAt: new Date().toISOString()
    };
    referrals[index] = updatedRef;
    writeReferrals(referrals);
    return updatedRef;
  }
}

async function deleteReferral(id, userId) {
  if (isPostgres) {
    const res = await pool.query('DELETE FROM referrals WHERE id = $1 AND user_id = $2', [id, userId]);
    return res.rowCount > 0;
  } else {
    const referrals = readReferrals();
    const index = referrals.findIndex(r => r.id === id && r.userId === userId);
    if (index === -1) return false;
    referrals.splice(index, 1);
    writeReferrals(referrals);
    return true;
  }
}

// ----------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------

// User Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const emailLower = email.trim().toLowerCase();
    const existingUser = await getUserByEmail(emailLower);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = {
      id: generateUUID(),
      email: emailLower,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    };
    
    await createUser(newUser);
    
    // Create Token
    const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.status(201).json({ token, email: newUser.email });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Sign In
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const emailLower = email.trim().toLowerCase();
    const user = await getUserByEmail(emailLower);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.status(200).json({ token, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// Auth Middleware
// ----------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ----------------------------------------------------
// Referrals Endpoints (Protected)
// ----------------------------------------------------

// Get User Referrals
app.get('/api/referrals', authenticateToken, async (req, res) => {
  try {
    const userReferrals = await getUserReferrals(req.user.userId);
    res.status(200).json(userReferrals);
  } catch (err) {
    console.error('Get referrals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Referral
app.post('/api/referrals', authenticateToken, async (req, res) => {
  try {
    const { company, name, linkedin, jobLink, status, appliedEmail, message } = req.body;
    
    if (!company || !name || !message) {
      return res.status(400).json({ error: 'Company, referrer name, and message are required' });
    }
    
    const newReferral = {
      id: generateUUID(),
      userId: req.user.userId,
      company: company.trim(),
      name: name.trim(),
      linkedin: (linkedin || '').trim(),
      jobLink: (jobLink || '').trim(),
      status: status || 'contacted',
      appliedEmail: appliedEmail || '',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await createReferral(newReferral);
    
    res.status(201).json(newReferral);
  } catch (err) {
    console.error('Create referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch Sync Referrals (used for first-time migration from LocalStorage)
app.post('/api/referrals/sync', authenticateToken, async (req, res) => {
  try {
    const localReferrals = req.body;
    
    if (!Array.isArray(localReferrals)) {
      return res.status(400).json({ error: 'Expected an array of referrals' });
    }
    
    const newReferrals = [];
    localReferrals.forEach(r => {
      if (r.company && r.name && r.message) {
        newReferrals.push({
          id: generateUUID(),
          userId: req.user.userId,
          company: r.company.trim(),
          name: r.name.trim(),
          linkedin: (r.linkedin || '').trim(),
          jobLink: (r.jobLink || '').trim(),
          status: r.status || 'contacted',
          appliedEmail: r.appliedEmail || '',
          message: r.message.trim(),
          createdAt: r.createdAt || new Date().toISOString(),
          updatedAt: r.updatedAt || new Date().toISOString()
        });
      }
    });
    
    if (newReferrals.length > 0) {
      await createReferralsBatch(newReferrals);
    }
    
    res.status(201).json(newReferrals);
  } catch (err) {
    console.error('Sync referrals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Referral
app.put('/api/referrals/:id', authenticateToken, async (req, res) => {
  try {
    const { company, name, linkedin, jobLink, status, appliedEmail, message } = req.body;
    const updatedRef = await updateReferral(req.params.id, req.user.userId, {
      company,
      name,
      linkedin,
      jobLink,
      status,
      appliedEmail,
      message
    });
    
    if (!updatedRef) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    res.status(200).json(updatedRef);
  } catch (err) {
    console.error('Update referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Referral
app.delete('/api/referrals/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await deleteReferral(req.params.id, req.user.userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    res.status(200).json({ message: 'Referral deleted successfully' });
  } catch (err) {
    console.error('Delete referral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'referral_portal_jwt_secret_998877';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static front-end files

// Database Directories and Setup
const DB_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const REFERRALS_FILE = path.join(DB_DIR, 'referrals.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(REFERRALS_FILE)) {
  fs.writeFileSync(REFERRALS_FILE, JSON.stringify([]));
}

// Database Helpers
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

// ----------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------

// User Sign Up
app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const emailLower = email.trim().toLowerCase();
  const users = readUsers();
  
  const existingUser = users.find(u => u.email === emailLower);
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
  
  users.push(newUser);
  writeUsers(users);
  
  // Create Token
  const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '30d' });
  
  res.status(201).json({ token, email: newUser.email });
});

// User Sign In
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const emailLower = email.trim().toLowerCase();
  const users = readUsers();
  
  const user = users.find(u => u.email === emailLower);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  
  res.status(200).json({ token, email: user.email });
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
app.get('/api/referrals', authenticateToken, (req, res) => {
  const referrals = readReferrals();
  const userReferrals = referrals.filter(r => r.userId === req.user.userId);
  res.status(200).json(userReferrals);
});

// Create Referral
app.post('/api/referrals', authenticateToken, (req, res) => {
  const { company, name, linkedin, jobLink, status, appliedEmail, message } = req.body;
  
  if (!company || !name || !message) {
    return res.status(400).json({ error: 'Company, referrer name, and message are required' });
  }
  
  const referrals = readReferrals();
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
  
  referrals.push(newReferral);
  writeReferrals(referrals);
  
  res.status(201).json(newReferral);
});

// Batch Sync Referrals (used for first-time migration from LocalStorage)
app.post('/api/referrals/sync', authenticateToken, (req, res) => {
  const localReferrals = req.body;
  
  if (!Array.isArray(localReferrals)) {
    return res.status(400).json({ error: 'Expected an array of referrals' });
  }
  
  const referrals = readReferrals();
  const syncedReferrals = [];
  
  localReferrals.forEach(r => {
    // Basic verification of structure
    if (r.company && r.name && r.message) {
      const newRef = {
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
      };
      referrals.push(newRef);
      syncedReferrals.push(newRef);
    }
  });
  
  if (syncedReferrals.length > 0) {
    writeReferrals(referrals);
  }
  
  res.status(201).json(syncedReferrals);
});

// Update Referral
app.put('/api/referrals/:id', authenticateToken, (req, res) => {
  const { company, name, linkedin, jobLink, status, appliedEmail, message } = req.body;
  const referrals = readReferrals();
  
  const index = referrals.findIndex(r => r.id === req.params.id && r.userId === req.user.userId);
  if (index === -1) {
    return res.status(404).json({ error: 'Referral not found' });
  }
  
  const currentRef = referrals[index];
  const updatedRef = {
    ...currentRef,
    company: company !== undefined ? company.trim() : currentRef.company,
    name: name !== undefined ? name.trim() : currentRef.name,
    linkedin: linkedin !== undefined ? linkedin.trim() : currentRef.linkedin,
    jobLink: jobLink !== undefined ? jobLink.trim() : currentRef.jobLink,
    status: status !== undefined ? status : currentRef.status,
    appliedEmail: appliedEmail !== undefined ? appliedEmail : currentRef.appliedEmail,
    message: message !== undefined ? message.trim() : currentRef.message,
    updatedAt: new Date().toISOString()
  };
  
  referrals[index] = updatedRef;
  writeReferrals(referrals);
  
  res.status(200).json(updatedRef);
});

// Delete Referral
app.delete('/api/referrals/:id', authenticateToken, (req, res) => {
  const referrals = readReferrals();
  
  const index = referrals.findIndex(r => r.id === req.params.id && r.userId === req.user.userId);
  if (index === -1) {
    return res.status(404).json({ error: 'Referral not found' });
  }
  
  referrals.splice(index, 1);
  writeReferrals(referrals);
  
  res.status(200).json({ message: 'Referral deleted successfully' });
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');

// Load environment variables
require('dotenv').config();

console.log('Environment check:', {
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID ? 'Loaded' : 'Not loaded',
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET ? 'Loaded' : 'Not loaded',
});

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const twitchRoutes = require('./src/api/twitchRoutes');
const compilationRoutes = require('./src/api/compilationRoutes');
const editorRoutes = require('./src/api/editorRoutes');
const path = require('path');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Serve static files with proper headers for video
app.use('/downloads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Accept-Ranges', 'bytes');
  
  // Set proper Content-Type for video files
  if (req.path.endsWith('.mp4')) {
    res.header('Content-Type', 'video/mp4');
  } else if (req.path.endsWith('.webm')) {
    res.header('Content-Type', 'video/webm');
  } else if (req.path.endsWith('.avi')) {
    res.header('Content-Type', 'video/x-msvideo');
  }
  
  next();
}, express.static(path.join(__dirname, 'temp')));

app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Accept-Ranges', 'bytes');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/twitch', twitchRoutes);
app.use('/api/compilations', compilationRoutes);
app.use('/api/editor', editorRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
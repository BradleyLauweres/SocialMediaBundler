// setup.js - Run this from the root directory with: node setup.js
const fs = require('fs');
const path = require('path');

// Create directory structure
const directories = [
  'backend/src/api',
  'backend/src/config',
  'backend/src/controllers',
  'backend/src/middleware',
  'backend/src/models',
  'backend/src/services',
  'backend/src/utils',
  'backend/uploads',
  'backend/outros',
  'database/migrations',
  'database/seeds',
];

directories.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  fs.mkdirSync(fullPath, { recursive: true });
  console.log(`Created directory: ${dir}`);
});

// Create .env.example
const envExample = `# Database
DATABASE_URL=postgresql://username:password@localhost:5432/social_media_automation
REDIS_URL=redis://localhost:6379

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# TikTok API
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret

# Instagram API
INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000

# File Storage
UPLOAD_DIR=./uploads
OUTRO_DIR=./outros
MAX_FILE_SIZE=500MB
`;

fs.writeFileSync(path.join(__dirname, '.env.example'), envExample);
console.log('Created .env.example');

// Create .gitignore
const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/

# Misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Editor directories and files
.idea
.vscode
*.swp
*.swo

# Backend specific
backend/uploads/*
backend/outros/*
!backend/uploads/.gitkeep
!backend/outros/.gitkeep

# Frontend specific
frontend/.next/
frontend/out/

# Database
*.sqlite
*.sqlite3

# OS files
Thumbs.db
`;

fs.writeFileSync(path.join(__dirname, '.gitignore'), gitignore);
console.log('Created .gitignore');

// Create .gitkeep files
fs.writeFileSync(path.join(__dirname, 'backend/uploads/.gitkeep'), '');
fs.writeFileSync(path.join(__dirname, 'backend/outros/.gitkeep'), '');

// Create basic server.js
const serverCode = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;

fs.writeFileSync(path.join(__dirname, 'backend/server.js'), serverCode);
console.log('Created backend/server.js');

// Create README.md
const readme = `# Social Media Automation Tool

An all-in-one social media automation tool focused on YouTube Shorts and TikTok, with optional support for Instagram Reels.

## Features
- Twitch Clip Compilation
- TikTok Video Editor
- Auto-Scheduling and Uploading
- Outro Support

## Setup Instructions

1. Install dependencies:
   \`\`\`bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your credentials
   \`\`\`

3. Set up the database:
   \`\`\`bash
   # Make sure PostgreSQL is running
   cd backend
   npm run db:create
   npm run db:migrate
   \`\`\`

4. Run the development servers:
   \`\`\`bash
   # Backend (in one terminal)
   cd backend
   npm run dev
   
   # Frontend (in another terminal)
   cd frontend
   npm run dev
   \`\`\`

The application will be available at http://localhost:3000
`;

fs.writeFileSync(path.join(__dirname, 'README.md'), readme);
console.log('Created README.md');

console.log('\n✅ Setup complete! Next steps:');
console.log('1. cd backend && npm install');
console.log('2. cd ../frontend && npm install');
console.log('3. Copy .env.example to .env and add your API credentials');
console.log('4. Set up PostgreSQL and run migrations');
console.log('5. Start the development servers');
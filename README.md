# Social Media Automation Tool

An all-in-one social media automation tool focused on YouTube Shorts and TikTok, with optional support for Instagram Reels.

## Features
- Twitch Clip Compilation
- TikTok Video Editor
- Auto-Scheduling and Uploading
- Outro Support

## Setup Instructions

1. Install dependencies:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Set up the database:
   ```bash
   # Make sure PostgreSQL is running
   cd backend
   npm run db:create
   npm run db:migrate
   ```

4. Run the development servers:
   ```bash
   # Backend (in one terminal)
   cd backend
   npm run dev
   
   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

The application will be available at http://localhost:3000

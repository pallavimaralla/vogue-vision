# 🎭 Vogue Vision

A real-time fashion analysis application built for a fashion-tech hackathon. Uses Vonage Video API for live video capture and Google's Gemini AI to deliver sarcastic, witty fashion verdicts.

## 📋 Project Overview

**Vogue Vision** captures a live video feed from your camera, lets you freeze a moment, sends it to the Gemini AI with a sarcastic fashion judge prompt, and displays a hilarious fashion verdict on screen.

**Deadline:** < 2 hours (hackathon)  
**Status:** STAGE 3 Complete ✅ (Core functionality working)

---

## ✅ Completed Stages

### STAGE 1: Live Video Feed with Vonage Video API ✅
- **Backend:** Node.js/Express server with Vonage SDK
- **Frontend:** Plain HTML/JS with Vonage client SDK
- **What works:**
  - Application ID + private key authentication
  - Creates Vonage Video sessions
  - Generates JWT tokens for clients
  - Live video rendering in browser
  - Status shows "✅ Camera active" when connected

### STAGE 2: Capture Video Frame as Base64 ✅
- Implemented canvas snapshot on button click
- Captures current video frame as JPEG base64
- Console logs confirm capture: `📸 ✓ Captured image: XXXXX bytes`
- Ready to send to backend

### STAGE 3: Gemini API Analysis ✅
- Backend `/api/analyze` endpoint
- Sends captured image to Gemini 3.8 Flash AI
- Prompt: Sarcastic fashion judge with trend name + verdict + score
- Response appears below video feed with animation
- Full error handling and logging

---

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Backend** | Node.js + Express | Latest |
| **Video API** | Vonage Video SDK | 3.30.1 |
| **Video Client** | Vonage Client SDK | 2.29.2 |
| **AI** | Google Generative AI (Gemini 3.8 Flash) | @google/generative-ai |
| **Frontend** | Plain HTML/JS (no frameworks) | - |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Vonage Video API credentials (Application ID + private key)
- Google Gemini API key

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure `.env`:**
   ```env
   # Vonage Video API
   VONAGE_APPLICATION_ID=your-app-id-here
   VONAGE_PRIVATE_KEY_PATH=keys/private.key

   # Google Gemini API
   GEMINI_API_KEY=your-gemini-key-here

   # Server
   PORT=3000
   ```

3. **Add private key:**
   - Save your Vonage private key to `keys/private.key`

4. **Start server:**
   ```bash
   node server.js
   ```
   Or:
   ```bash
   npm start
   ```

5. **Open browser:**
   ```
   http://localhost:3000
   ```

---

## 📁 Project Structure

```
vogue-vision/
├── server.js              # Express backend + Vonage + Gemini API
├── public/
│   └── index.html         # Frontend (video + capture button)
├── keys/
│   └── private.key        # Vonage private key (not in git)
├── .env                   # Environment variables (not in git)
├── package.json
└── README.md             # This file
```

---

## 🎯 How It Works

### User Flow

```
1. User opens http://localhost:3000
   ↓
2. Browser fetches /api/token
   ↓
3. Server generates Vonage session + JWT token
   ↓
4. Browser connects to Vonage Video session
   ↓
5. Live camera feed appears on screen
   ↓
6. User clicks "📸 Capture Look"
   ↓
7. Browser captures video frame as base64 JPEG
   ↓
8. Browser sends image to POST /api/analyze
   ↓
9. Server sends image to Gemini 3.8 Flash
   ↓
10. Gemini returns sarcastic verdict:
    - Made-up trend name (e.g., "unemployed art teacher core")
    - Funny but specific fashion comment
    - Score out of 10
   ↓
11. Browser displays verdict below video with animation
```

### API Endpoints

#### `GET /api/token`
Returns Vonage Video session credentials for client.

**Response:**
```json
{
  "applicationId": "uuid",
  "sessionId": "vonage-session-id",
  "token": "jwt-token-for-client"
}
```

#### `POST /api/analyze`
Analyzes fashion in uploaded image using Gemini AI.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
}
```

**Response:**
```json
{
  "verdict": "'Thrifted chaos theory' — Your outfit screams 'I wore everything I found on the floor.' The color coordination is *chef's kiss* if the chef only uses primary colors. 7/10 for boldness."
}
```

#### `GET /vendor/opentok.js`
Serves Vonage Video client SDK from node_modules (not CDN, for offline reliability).

---

## 🎮 User Interface

### Main Page
- **Video Container:** Black box showing live camera feed
- **Status Text:** Shows connection state ("Connecting...", "✅ Camera active", etc.)
- **Capture Button:** "📸 Capture Look" - triggers fashion analysis
- **Verdict Section:** Appears below video with animation after analysis

### Console Logs (Developer Mode)
Press **F12** → **Console** to see:
- 🎥 Video initialization steps
- 📸 Capture events
- 🤖 Gemini API calls
- Full error traces

---

## 🔍 Detailed Logging

The app has extensive console logging for debugging:

**Frontend logs (browser console):**
- `🎥 === INIT VIDEO START ===` - Session initialization
- `📸 Capturing image...` - Frame capture
- `🤖 Analyzing with Gemini...` - API call start

**Backend logs (terminal):**
- `🔧 VONAGE CONFIG` - Credentials on startup
- `📺 Creating new Vonage session...` - Session creation
- `🤖 GEMINI REQUEST` - Image analysis request
- `🤖 Gemini response:` - AI verdict returned

---

## 🛠️ Key Implementation Details

### Authentication (Vonage)
- Uses **Application ID + Private Key** (JWT-based, not API Key/Secret)
- JWT generated server-side only (private key never sent to client)
- Token expires in 4 hours

### Image Processing
- Canvas-based capture from `<video>` element
- Converted to base64 JPEG automatically
- Typical size: 70-80 KB per frame

### Gemini AI
- Model: `gemini-3.8-flash` (latest as of Sept 2026)
- Supports: Text + Image input
- Image format: Base64-encoded JPEG
- Response: Plain text (under 40 words as per prompt)

### Frontend (No Framework)
- Pure HTML/CSS/JavaScript
- Vonage SDK loaded from `/vendor/opentok.js`
- Async/await for API calls
- Event listeners for capture button

---

## 🚧 TODO / Future Stages

### STAGE 4: Enhanced UI (Planned)
- [ ] Display trend name in larger/colored text
- [ ] Make score visually prominent (big number, color coding)
- [ ] Add reveal animation
- [ ] Mobile-responsive design

### STRETCH GOAL: Multi-person Battle Mode
- [ ] Allow second participant to join same session
- [ ] Each person's look gets analyzed separately
- [ ] Use Vonage Signal API to broadcast verdicts to both
- [ ] Real-time "runway battle" scoreboard

---

## 🐛 Troubleshooting

### "Camera active" but video doesn't appear
- Check browser permissions (allow camera access)
- Ensure webcam is working in other apps
- Try a different browser

### "publishMessageInvalidChannel" error
- **FIXED:** Was caused by `audioSource: null` and `videoSource: null` in publisher init
- Removed these lines - SDK now auto-detects sources

### Gemini returns 404 error
- **FIXED:** Old models (gemini-1.5-flash, gemini-2.0-flash) are shutdown
- Using `gemini-3.8-flash` (current as of Sept 2026)
- Ensure API key is valid at https://aistudio.google.com/apikey

### "Invalid API key or secret" (Vonage)
- Verify Application ID matches the one in Vonage Dashboard
- Ensure private key file is from the SAME Application
- Check that Video capability is enabled on the Application

---

## 📝 Environment Variables

Required in `.env`:

```env
# Vonage Video API (from dashboard.vonage.com)
VONAGE_APPLICATION_ID=your-application-uuid
VONAGE_PRIVATE_KEY_PATH=keys/private.key

# Google Generative AI (from aistudio.google.com)
GEMINI_API_KEY=your-api-key

# Server
PORT=3000
```

---

## 🧹 Code Quality

- **Logging:** Extensive emoji-prefixed logs for easy debugging
- **Error Handling:** Try/catch blocks with user-friendly messages
- **No dependencies clutter:** Only essential packages
- **Plain JavaScript:** No build tools or frameworks needed
- **Responsive:** Works on desktop and mobile (video auto-scales)

---

## 📊 Performance Notes

- Vonage session creation: ~1-2 seconds
- Camera access prompt: ~1 second
- Video connection: ~2-3 seconds
- Gemini analysis: ~2-5 seconds (depends on API latency)
- **Total startup to first capture:** ~5-10 seconds

---

## 🤝 For Your Teammate

### To understand the flow:
1. Read the "How It Works" section above
2. Open `server.js` and read the comments
3. Open `public/index.html` and follow the JavaScript flow

### To test:
1. Run `npm install` and `node server.js`
2. Open http://localhost:3000
3. Press F12 to see detailed logs
4. Click "Capture Look" and watch the console

### To debug:
- Server logs show Vonage and Gemini API calls
- Browser console shows all frontend steps
- Both are emoji-prefixed for easy scanning

---

## 📞 Support

If something breaks:
1. Check `.env` has correct credentials
2. Check terminal for server errors (emoji logs)
3. Check browser console (F12) for frontend errors
4. Restart server: `pkill -f "node server.js" && node server.js`
5. Refresh browser and try again

---

**Built for:** Fashion-tech hackathon  
**Time constraint:** < 2 hours  
**Status:** MVP complete, core features working ✅

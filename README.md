# Vogue Vision

**Your outfit. Your moment. Live AR effects tailored by AI.**

Vogue Vision turns your mirror into a runway. Point your camera and let Gemini read your vibe. Get a verdict on your fit, a style name, a tip to level it up, and a live AR scene to match. Then broadcast it.

The moment someone opens your link, they watch your AR aura in real time. No setup and no separate viewer page, just the same URL.

## What it does

- **AI fashion judge**: Gemini analyzes your outfit and writes a verdict, covering occasion, style name, reaction, tip, and score.
- **Live AR effects**: 3D balloon letters, emoji particles, trails, confetti, flames, prisms, and wings anchored to your body.
- **Real occlusion**: The effects sit behind you and your body cuts in front. No flat stickers.
- **Vonage broadcast**: Your AR stream goes live. Viewers see the effects, not your raw camera.
- **One screen**: Same URL for you and everyone watching, so there is no separate app and no viewer page.

## Quick start

```bash
npm install
cp .env.example .env
# Add GEMINI_API_KEY from https://aistudio.google.com/apikey
# (Optional) Add VONAGE_APPLICATION_ID and VONAGE_PRIVATE_KEY for broadcast
npm run dev
# Open http://localhost:5173 in Chrome
```

Allow camera access. The app reads your pose, asks Gemini what you're wearing, gets back a styled response, and renders the effects live. Automatic reactions repeat roughly every 12 seconds. Toggle **Live reactions** to pause analysis.

Send the link to anyone. They watch your AR aura stream live on the same page.

## How it works

```mermaid
sequenceDiagram
    participant Camera as Your camera
    participant Worker as Pose worker (MediaPipe)
    participant App as Vogue Vision (Three.js)
    participant Server as Express server
    participant Gemini
    participant Vonage
    participant Viewer

    Camera->>App: video frame
    App->>Worker: frame
    Worker-->>App: 33 pose landmarks + segmentation mask
    Note over App: Every ~12s while a person is in frame
    App->>Server: POST /api/judge { image, previousScene }
    Server->>Gemini: image + system instructions + verdict schema
    Gemini-->>Server: JSON verdict
    Server->>Server: validate with Zod
    Server-->>App: verdict (title, reaction, tip, score, scene, effects)
    App->>App: render effects behind person, masked person, effects in front
    App->>Vonage: publish composited canvas stream
    Vonage-->>Viewer: live AR broadcast
```

**Tracking**: MediaPipe gets 33 pose landmarks and a person segmentation mask every frame, running in a Web Worker so the render thread never blocks.

**Judgment**: When you're in frame, Vogue Vision sends a snapshot to Gemini with a prompt asking for occasion, a style name, a warm reaction, a tip, and an AR effect list. Gemini returns JSON, and Zod validates it on the server.

**Rendering**: Three.js draws in three passes: effects behind the person, the masked person, then effects in front, so your body occludes the AR naturally. Effects scale to shoulder span, so they track distance automatically.

**Broadcasting**: The Vonage Video API manages the session and publisher. The local Three.js canvas streams its frames to viewers in real time through Vonage. Viewers get the full AR composite, not the raw camera.

## Tech

| Layer | Technology |
|---|---|
| AI judge | Google Gemini 3.6 Flash, structured JSON output with schema validation |
| Live video | Vonage Video API (`@vonage/server-sdk` on the server, `@vonage/client-sdk-video` in the browser) |
| Pose tracking | MediaPipe Tasks Vision, 33-point pose and segmentation mask in a Web Worker |
| Rendering | Three.js, WebGL with custom GLSL shaders for the person cutout and AR effects |
| Backend | Node.js (ESM) + Express, for Gemini calls, Vonage session tokens, and status |
| Frontend | Vite + vanilla JS, no framework |
| Tests | `node:test` for API validation and coordinate math, plus a Playwright script for full browser flows |

## Environment variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key. Required. |
| `GEMINI_MODEL` | *(optional)* Gemini model name, defaults to `gemini-3.6-flash`. |
| `VONAGE_APPLICATION_ID` | *(optional)* Vonage Application ID, needed to broadcast. |
| `VONAGE_PRIVATE_KEY` | *(optional)* Vonage Application private key, needed to broadcast. |
| `VONAGE_SESSION_ID` | *(optional)* reuse a fixed session instead of creating one per boot. |
| `PORT` | *(optional)* server port, defaults to `5173`. |

```env
# Required
GEMINI_API_KEY=your-key-from-aistudio.google.com

# Optional (needed to broadcast)
VONAGE_APPLICATION_ID=your-vonage-app-id
VONAGE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Optional (change default port)
PORT=5173
```

> **Never commit `.env` or your Vonage private key.** Both are secrets. `.env` and `keys/` are already git-ignored.

## API reference

### `GET /api/status`
Reports whether Gemini and Vonage are configured.

```json
{ "configured": true, "keyCount": 1, "model": "gemini-3.6-flash", "provider": "gemini", "video": true }
```

### `GET /api/token`
Creates (or reuses) a Vonage session and returns a fresh publisher token.

```json
{ "applicationId": "uuid", "sessionId": "...", "token": "..." }
```

### `POST /api/judge`
Sends a captured frame to Gemini and returns its verdict.

**Request**
```json
{ "image": "data:image/jpeg;base64,...", "previousScene": "galaxy" }
```

**Response**
```json
{
  "visible": true,
  "title": "Thrifted chaos theory",
  "reaction": "Your color coordination is chef's kiss if the chef only owns primary colors.",
  "tip": "Add one neutral piece to ground the palette.",
  "score": 7,
  "palette": "lime",
  "scene": "galaxy",
  "energy": 2,
  "occasion": "Everyday",
  "formats": ["glints", "prisms", "stickers"],
  "effects": [{ "emoji": "✨", "anchor": "shoulders", "animation": "orbit" }]
}
```

### `GET /vendor/opentok.js`
Serves the Vonage client SDK from `node_modules` so the browser doesn't depend on an external CDN.

## Project structure

```
vogue-vision/
├── index.html            # App shell, mounts src/main.js
├── server/
│   ├── index.js           # Boots Express with Vite middleware (dev) or dist/ (production)
│   └── app.js              # Gemini judge endpoint, Vonage tokens, status
├── shared/
│   └── verdict.js          # Zod schemas and preview verdicts shared by client and server
├── src/
│   ├── main.js             # UI shell, camera, capture loop, Vonage publish/subscribe
│   ├── effects.js          # Three.js rendering: person mask, AR effects, scenes
│   ├── pose-layout.js       # Maps pose landmarks to effect anchors and scale
│   └── style.css
├── public/
│   ├── mediapipe/          # Downloaded MediaPipe wasm + model (git-ignored, see below)
│   └── pose-worker.js       # MediaPipe pose tracking in a Web Worker
├── scripts/
│   └── setup-assets.js      # postinstall: copies MediaPipe assets, downloads the pose model
├── test/
│   ├── api.test.js          # node:test coverage for /api/judge and /api/token
│   ├── layout.test.js       # node:test coverage for pose-to-effect coordinate math
│   └── browser.mjs          # Playwright script exercising the full UI flow
├── package.json
└── .env                    # not committed
```

## Run

- `npm run dev` — start the dev server on http://localhost:5173
- `npm test` — run the `node:test` suite (API validation, concurrency, coordinate math)
- `npm run build` — build for production with Vite
- `npm start` — serve the built app from `dist/`

## Browser

Chrome is the target. Camera access requires localhost or HTTPS. Mobile works in Chrome's full-screen mode.

## Security

- Never commit `.env` or `keys/private.key`. Both are secrets. `.env` and `keys/` are already git-ignored.
- If a key or token is ever accidentally committed, treat it as compromised and rotate it immediately in the Vonage or Google dashboard, rather than relying on removing it from a future commit.
- Avoid logging full API keys or tokens. The current backend only logs a truncated preview, which is fine.

## Limits

This is a proof of concept. Body tracking and masking are approximate and may lag during fast motion. Face exclusion follows pose landmarks, so brief tracking errors remain. The server binds to localhost and includes no production auth or hosting setup.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Status shows the app is ready but no video | Check browser camera permissions, or try a different browser |
| Pose tracking never reports "BODY TRACKED" | Confirm `public/mediapipe/` was populated by the postinstall script; rerun `node scripts/setup-assets.js` if not |
| Gemini request 404s | Confirm `GEMINI_MODEL` in `.env` is still valid and available for your API key |
| "Invalid API key or secret" (Vonage) | Confirm the Application ID and private key belong to the same Application, and that Video is enabled on it |

## Roadmap / stretch ideas

- Two-person "runway battle" mode, using a shared Vonage session and the Signal API to broadcast both verdicts.
- Virtual try-on or outfit swap using Gemini image generation.
- Recorded highlight reel of the best verdicts from a session.

---

Built for **Runway to Reality: AI Fashion Hackathon**, Google Developer Groups and Vonage, at LUMA Studios NYC.

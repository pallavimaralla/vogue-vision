import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { Auth } from "@vonage/auth";
import { Vonage } from "@vonage/server-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const app = express();
const PORT = process.env.PORT || 3000;

let vonageClient;
let cachedSessionId;

function initVonage() {
  const applicationId = process.env.VONAGE_APPLICATION_ID;
  const privateKeyPath = process.env.VONAGE_PRIVATE_KEY_PATH;

  console.log("🔧 VONAGE CONFIG");
  console.log("  applicationId:", applicationId);
  console.log("  privateKeyPath:", privateKeyPath);

  if (!applicationId || !privateKeyPath) {
    throw new Error("Missing VONAGE_APPLICATION_ID or VONAGE_PRIVATE_KEY_PATH in .env");
  }

  let privateKey;
  try {
    privateKey = readFileSync(privateKeyPath, "utf8");
    console.log("  ✓ Private key loaded, length:", privateKey.length);
  } catch (err) {
    throw new Error(`Could not read private key at ${privateKeyPath}: ${err.message}`);
  }

  return new Vonage(new Auth({ applicationId, privateKey }));
}

async function getSessionId() {
  if (process.env.VONAGE_SESSION_ID) {
    console.log("📺 Using env SESSION_ID:", process.env.VONAGE_SESSION_ID);
    return process.env.VONAGE_SESSION_ID;
  }

  if (!cachedSessionId) {
    console.log("📺 Creating new Vonage session...");
    try {
      const session = await vonageClient.video.createSession();
      cachedSessionId = session.sessionId;
      console.log("✓ Session created:", cachedSessionId.slice(0, 40) + "...");
    } catch (err) {
      console.error("✗ Session creation failed:", err.message);
      throw err;
    }
  }

  return cachedSessionId;
}

function createToken(sessionId, name = "User") {
  return vonageClient.video.generateClientToken(sessionId, {
    role: "publisher",
    expireTime: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
    data: `name=${name}`,
  });
}

// Initialize Vonage on startup
try {
  vonageClient = initVonage();
  console.log("Vonage client initialized");
} catch (err) {
  console.error(`\n${err.message}\n`);
  process.exit(1);
}

app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));

// Serve Vonage client SDK from node_modules
const clientSdkPath = join(
  dirname(require.resolve("@vonage/client-sdk-video")),
  "opentok.min.js"
);

app.get("/vendor/opentok.js", (req, res) => {
  res.sendFile(clientSdkPath);
});

// Get session + token for the client
app.get("/api/token", async (req, res) => {
  try {
    console.log("\n🎬 /api/token REQUEST");
    const sessionId = await getSessionId();
    console.log("🎬 Generating token for session:", sessionId.slice(0, 40) + "...");

    const token = createToken(sessionId, "Fashion Judge");
    console.log("🎬 Token generated, length:", token.length);

    // Decode token to inspect claims
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        console.log("🎬 Token Claims:");
        console.log("    scope:", payload.scope);
        console.log("    session_id:", payload.session_id.slice(0, 40) + "...");
        console.log("    role:", payload.role);
        console.log("    application_id:", payload.application_id);
        console.log("    exp:", payload.exp);
      } catch (e) {
        console.error("🎬 Could not decode token:", e.message);
      }
    }

    console.log("🎬 Sending response to client\n");
    res.json({
      applicationId: process.env.VONAGE_APPLICATION_ID,
      sessionId: sessionId,
      token: token,
    });
  } catch (error) {
    console.error("🎬 ✗ Token error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Analyze outfit with Gemini
app.post("/api/analyze", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    console.log("\n🤖 GEMINI REQUEST");
    console.log("   Image size:", imageBase64.length, "bytes");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("🤖 Using Gemini API key:", process.env.GEMINI_API_KEY.slice(0, 10) + "...");
    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

    // Remove data URI prefix if present
    const base64Data = imageBase64.split(",")[1] || imageBase64;

    const prompt = `You are a savage, hilarious runway judge with zero filter. Look at this outfit and respond with exactly two things: (1) a made-up, punchy trend name for the look in quotes, like a fake fashion microtrend (e.g. 'unemployed art teacher core'), and (2) a one-sentence verdict that's funny but specific about what you see (colors, fit, vibe). Then give a score out of 10. Keep the whole thing under 40 words total.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ]);

    const verdict = result.response.text();
    console.log("🤖 Gemini response:", verdict);
    console.log("🤖 Response length:", verdict.length, "bytes\n");

    res.json({ verdict });
  } catch (error) {
    console.error("🤖 ✗ Gemini error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nVogue Vision running on http://localhost:${PORT}\n`);
});

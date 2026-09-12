const express = require('express');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const VONAGE_API_KEY = process.env.VONAGE_API_KEY;
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET;

app.use(express.static('public'));
app.use(express.json());

// Generate Vonage session and token
app.get('/api/token', (req, res) => {
  const OpenTok = require('opentok');
  const opentok = new OpenTok(VONAGE_API_KEY, VONAGE_API_SECRET);

  const sessionId = uuidv4().slice(0, 8);

  opentok.createSession({ mediaMode: 'routed' }, (err, session) => {
    if (err) {
      console.error('Session creation error:', err);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    const token = session.generateToken();
    res.json({
      sessionId: session.sessionId,
      token: token,
      apiKey: VONAGE_API_KEY
    });
  });
});

app.listen(PORT, () => {
  console.log(`Vogue Vision backend running on http://localhost:${PORT}`);
});

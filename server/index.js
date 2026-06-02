
// Load environment variables from .env when present
try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5174;

// Basic Mistral proxy integration (reads API key from env; do NOT commit keys)
app.post('/api/ai', async (req, res) => {
  try {
    const { message, role } = req.body || {};
    console.log('Incoming AI request:', { role });

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    const model = process.env.MISTRAL_MODEL || 'open-mistral-7b';
    const apiUrl = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions';

    if (!apiKey) {
      return res.status(500).json({ error: 'MISTRAL_API_KEY not configured in environment' });
    }

    // Build a simple system + user messages tailored for YKS Mentor (chat completions format)
    const systemPrompt = `Sen YKS Mentor asistanısın. Sadece YKS ile ilgili sorulara odaklan. Cevapları Türkçe ver, emin değilsen "Bilmiyorum" de ve yanlış yönlendirmeden kaçın.`;
    const safeRole = (role === 'system' || role === 'assistant') ? role : 'user';
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: safeRole, content: message },
    ];

    // Call Mistral Chat Completions API (expects { model, messages })
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    // Debug: read raw text first to avoid crashes on invalid JSON
    const raw = await resp.text();
    console.log('Mistral status:', resp.status);
    console.log('Mistral raw response (trim):', raw && raw.slice(0, 1000));
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (parseErr) {
      console.error('Failed to parse Mistral JSON:', parseErr.message);
      body = { raw };
    }

    // Try to extract a reasonable text reply from common response shapes
    let reply = null;
    if (body.output && typeof body.output === 'string') reply = body.output;
    else if (body.outputs && Array.isArray(body.outputs) && body.outputs[0]) {
      // some providers return outputs[].generated_text or outputs[].data.text
      const out = body.outputs[0];
      reply = out.generated_text || (out.data && out.data[0] && out.data[0].text) || JSON.stringify(out);
    } else if (body.choices && Array.isArray(body.choices) && body.choices[0]) {
      reply = body.choices[0].text || body.choices[0].message?.content;
    } else if (body.result) reply = body.result;

    if (resp.status >= 400) {
      return res.status(resp.status).json({ error: 'Mistral error', status: resp.status, body });
    }

    if (!reply) {
      // fallback: stringify part of the response for debugging (trimmed)
      reply = JSON.stringify(body).slice(0, 1000);
    }

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`AI proxy server listening on http://localhost:${PORT}`);
});

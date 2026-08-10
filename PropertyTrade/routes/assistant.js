import { Router } from 'express';

/**
 * Lightweight proxy to the DeepSeek API (OpenAI-compatible).
 * Set DEEPSEEK_API_KEY in Render — unset, the route is dormant.
 */
export default function assistantRoutes(dataDir) {
  const r = Router();

  r.post('/api/assistant', async (req, res) => {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return res.status(503).json({ error: 'DEEPSEEK_API_KEY not configured.' });
    }

    const { messages, model } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    try {
      const apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages,
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      const data = await apiRes.json();

      if (!apiRes.ok) {
        return res.status(apiRes.status).json({
          error: data.error?.message || `DeepSeek API error (${apiRes.status}).`,
        });
      }

      res.json(data);
    } catch (err) {
      res.status(502).json({ error: 'Could not reach the DeepSeek API.' });
    }
  });

  return r;
}
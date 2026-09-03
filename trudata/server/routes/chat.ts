import { Router } from 'express';

const router = Router();

const DEEPSEEK_SYSTEM_PROMPT = `You are the TruData support assistant. TruData is a South African data marketplace that helps businesses find verified market data.

Our products:
- Vehicle Market Value Reports (R29) — live pricing from AutoTrader and Cars.co.za for any vehicle in the TransUnion catalogue
- Property Suburb Comps (R29) — median asking prices from Property24 and Private Property
- Business Website Audits (R3/result) — find businesses in any city, get their contact details and website health score
- TransUnion Bureau Reports (R49/lookup) — official vehicle valuation, registration checks, and accident history

Pricing: Per-lead pricing. You only pay for results we find. 1-10 leads = R3/lead, 11-25 = R2.50/lead, 26-50 = R2/lead, 51+ = R1.50/lead.

Be helpful, honest, and concise. If you don't know something, say so. Never make up data or pricing.`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

router.post('/', async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    return res.json({
      reply: 'Chat is currently offline. Email us at intelligence@tru-saas.com for help.',
      offline: true,
    });
  }

  const { message, history = [] } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Build message array with system prompt + conversation history
  const messages: ChatMessage[] = [
    { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
    ...history.slice(-10).map((m: any) => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: String(m.content || ''),
    })),
    { role: 'user', content: message.slice(0, 1000) }, // Cap input length
  ];

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('[Chat] DeepSeek API error:', response.status);
      return res.json({
        reply: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        offline: true,
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

    res.json({ reply, offline: false });
  } catch (err: any) {
    console.error('[Chat] Error:', err?.message || err);
    res.json({
      reply: 'Chat is temporarily unavailable. Email us at intelligence@tru-saas.com.',
      offline: true,
    });
  }
});

export default router;

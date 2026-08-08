// TURN servers — Google's free STUN plus a hosted TURN for NAT traversal.
// Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_API_KEY + TWILIO_API_SECRET
// to generate ephemeral TURN credentials. Unset = STUN-only (works on most networks,
// fails behind symmetric NATs).
export function getIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  }

  return servers;
}

// Simple in-memory rate limiter — max requests per window per IP.
const buckets = new Map();

export function rateLimit(opts = {}) {
  const { windowMs = 60_000, max = 20 } = opts;

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const entry = buckets.get(key) || { count: 0, reset: now + windowMs };

    if (now > entry.reset) {
      entry.count = 1;
      entry.reset = now + windowMs;
    } else {
      entry.count++;
    }

    buckets.set(key, entry);

    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many requests. Slow down.' });
    }

    // Periodic cleanup
    if (Math.random() < 0.01) {
      for (const [k, v] of buckets) {
        if (now > v.reset) buckets.delete(k);
      }
    }

    next();
  };
}

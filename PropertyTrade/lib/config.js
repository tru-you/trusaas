const buckets = new Map();

export function rateLimit(opts = {}) {
  const { windowMs = 60_000, max = 60 } = opts;

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

    if (Math.random() < 0.01) {
      for (const [k, v] of buckets) {
        if (now > v.reset) buckets.delete(k);
      }
    }

    next();
  };
}

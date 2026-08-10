function parsePositiveInt(v, cap) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return cap ? Math.min(n, cap) : n;
}

export function paginate(req, res, items) {
  const limit = parsePositiveInt(req.query.limit, 500);
  if (limit === null) return items;
  const offset = parsePositiveInt(req.query.offset) ?? 0;
  res.set('X-Total-Count', String(items.length));
  return items.slice(offset, offset + limit);
}

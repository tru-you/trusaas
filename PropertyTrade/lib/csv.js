export function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvBuild(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}

/** Native contact helpers for the desktop manager portal.
 *
 * These open the operating system's own dialer, mail client, or WhatsApp —
 * TruInspect never sends on the dealer's behalf, it hands off to the tool the
 * dealer already uses. Every function is a no-op-safe URL builder plus an
 * opener; callers pass whatever contact detail they have.
 */

/** Strip a phone number down to digits, keeping a leading country code.
 *  SA numbers entered as 082… are normalised to 2782… for WhatsApp/wa.me. */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) return n.slice(1);
  if (n.startsWith('0')) return '27' + n.slice(1); // SA local → international
  return n;
}

export function telHref(phone: string): string {
  const n = (phone || '').replace(/[^\d+]/g, '');
  return `tel:${n}`;
}

export function mailtoHref(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  return `mailto:${email}${qs ? '?' + qs : ''}`;
}

export function whatsappHref(phone: string, message?: string): string {
  const n = normalizePhone(phone);
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${n}${q}`;
}

/** Open a link the way the platform expects — WhatsApp/mail in a new tab so the
 *  manager keeps their place; tel: in the same frame so the dialer takes over. */
export function openContact(href: string, newTab = true) {
  if (typeof window === 'undefined') return;
  if (href.startsWith('tel:')) { window.location.href = href; return; }
  window.open(href, newTab ? '_blank' : '_self', 'noopener,noreferrer');
}

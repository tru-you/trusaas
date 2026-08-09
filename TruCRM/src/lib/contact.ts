// Real "straight to phone" communication: dialler, WhatsApp, mail client.
// These work on any device without a backend — no accounts, no API keys.

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`;
}

export function waHref(phone: string, message?: string): string {
  const clean = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${clean}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function openMailTo(email: string, subject: string, body: string) {
  window.open(
    `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    '_blank'
  );
}

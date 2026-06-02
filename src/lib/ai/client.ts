const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:5174';

function sanitizeText(raw: unknown, maxLen = 800) {
  let text = '';
  if (typeof raw === 'string') text = raw;
  else if (raw == null) text = '';
  else text = String(raw);

  // Remove markdown links but keep link text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  // Remove headings and leading hashes
  text = text.replace(/^#+\s*/gm, '');
  // Remove list markers at line starts
  text = text.replace(/^[\-\*\+]\s+/gm, '');
  // Remove blockquote markers
  text = text.replace(/^>\s+/gm, '');
  // Remove code fences/backticks
  text = text.replace(/`+/g, '');
  // Drop any lines that look like tables (contain | separators)
  text = text
    .split(/\r?\n/)
    .filter((l) => !/\|/.test(l))
    .join('\n');
  // Remove remaining markdown characters that are purely formatting
  text = text.replace(/[\#\*\|]/g, '');
  // Collapse consecutive newlines and whitespace into single space
  text = text.replace(/\s*\n\s*/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').trim();

  const full = text;
  let truncated = full;
  if (truncated.length > maxLen) truncated = truncated.slice(0, maxLen).trim() + '...';

  return { full, truncated };
}

export async function sendMessageToAi(message: string, role = 'student') {
  const url = `${API_BASE}/api/ai`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, role }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json();
  const rawReply = data?.reply ?? '';
  const { full, truncated } = sanitizeText(rawReply, 800);
  return { reply: truncated, fullReply: full };
}

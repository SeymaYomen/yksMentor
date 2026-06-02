const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:5174';

export async function sendMessageToAi(message: string, role = 'student') {
  const url = `${API_BASE}/api/ai`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, role }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  return res.json();
}

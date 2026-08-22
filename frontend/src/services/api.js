// All requests go to /api/* which Vite proxies to localhost:3001

export async function speechToText(audioBlob, languageCode = 'hi-IN') {
  const fd = new FormData();
  fd.append('audio', audioBlob, 'recording.webm');
  fd.append('language_code', languageCode);

  const res = await fetch('/api/stt', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.detail || data.error || 'Speech-to-text failed');
  // Return both transcript and detected language
  return { transcript: data.transcript, languageCode: data.language_code || languageCode };
}

export async function ocrImage(imageFile) {
  const fd = new FormData();
  fd.append('image', imageFile);

  const res = await fetch('/api/ocr', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || 'OCR failed');
  return data.text || '';
}

export async function parseBill(transcript, catalog = {}) {
  const res = await fetch('/api/parse-bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, catalog }),
  });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Parse failed');
  return data; // { items, subtotal, unclear }
}

export async function chatWithAdvisor(message, businessContext, history = []) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, businessContext, history }),
  });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Chat failed');
  return data.reply;
}

// Dịch tự động text tiếng Việt sang ngôn ngữ đích qua MyMemory API (miễn phí, không cần key).
// Có cache localStorage để chỉ gọi mạng 1 lần cho mỗi chuỗi. Text dài tự cắt khúc 450 ký tự.

const API = 'https://api.mymemory.translated.net/get';

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const memCache = new Map();

function getCached(text, lang) {
  const k = `lh_tr_${lang}_${hash(text)}`;
  if (memCache.has(k)) return memCache.get(k);
  try {
    const v = localStorage.getItem(k);
    if (v) { memCache.set(k, v); return v; }
  } catch {}
  return null;
}

function setCached(text, lang, translated) {
  const k = `lh_tr_${lang}_${hash(text)}`;
  memCache.set(k, translated);
  try { localStorage.setItem(k, translated); } catch {}
}

async function translateChunk(text, lang) {
  const hit = getCached(text, lang);
  if (hit) return hit;
  const url = `${API}?q=${encodeURIComponent(text)}&langpair=vi|${lang}`;
  const res = await fetch(url);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  // MyMemory trả về cảnh báo khi hết quota / text quá dài → coi như thất bại
  if (out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(out)) {
    setCached(text, lang, out);
    return out;
  }
  throw new Error('translate-failed');
}

function chunk(text, size = 450) {
  const parts = [];
  let cur = '';
  for (const sentence of text.split(/(?<=[.!?。！？…])\s+/)) {
    if ((cur + sentence).length > size && cur) { parts.push(cur); cur = sentence; }
    else cur += (cur ? ' ' : '') + sentence;
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : [text];
}

/** Dịch text tiếng Việt sang lang ('en'|'zh'|'ko'). Thất bại → trả về text gốc. */
export async function translateText(text, lang) {
  if (!text || lang === 'vi') return text || '';
  try {
    const parts = chunk(text);
    const out = await Promise.all(parts.map((p) => translateChunk(p, lang)));
    return out.join(' ');
  } catch {
    return text;
  }
}

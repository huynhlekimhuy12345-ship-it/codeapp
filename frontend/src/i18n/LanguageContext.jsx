import { createContext, useContext, useState, useEffect } from 'react';
import vi from './translations/vi';
import en from './translations/en';
import zh from './translations/zh';
import ko from './translations/ko';

const dicts = { vi, en, zh, ko };

export const LANGS = [
  { code: 'vi', label: 'Tiếng Việt', short: 'VI', flag: '🇻🇳' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'zh', label: '中文', short: '中文', flag: '🇨🇳' },
  { code: 'ko', label: '한국어', short: 'KO', flag: '🇰🇷' },
];

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

const LangContext = createContext({ lang: 'vi', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('leatherhouse_lang');
      return dicts[saved] ? saved : 'vi';
    } catch { return 'vi'; }
  });

  const setLang = (l) => {
    if (!dicts[l]) return;
    setLangState(l);
    try { localStorage.setItem('leatherhouse_lang', l); } catch {}
    document.documentElement.lang = l;
  };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = (key, vars) => {
    let s = get(dicts[lang], key);
    if (s === undefined) s = get(vi, key);
    if (s === undefined) return key;
    if (vars && typeof s === 'string') {
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

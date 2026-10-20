// Ready for Hindi and regional languages: UI text is written in English and looked up here.
// Add a dictionary (e.g. `hi`) with the English sentence as key; missing keys fall back to English.
type Dict = Record<string, string>;

const dictionaries: Record<string, Dict> = {
  en: {},
};

export const LANGUAGES = [
  { code: 'en', name: 'English', ready: true },
  { code: 'hi', name: 'हिन्दी (Hindi)', ready: false },
  { code: 'ml', name: 'മലയാളം (Malayalam)', ready: false },
  { code: 'ta', name: 'தமிழ் (Tamil)', ready: false },
  { code: 'te', name: 'తెలుగు (Telugu)', ready: false },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', ready: false },
  { code: 'mr', name: 'मराठी (Marathi)', ready: false },
  { code: 'bn', name: 'বাংলা (Bengali)', ready: false },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)', ready: false },
];

let lang = 'en';
try {
  lang = localStorage.getItem('sm.lang') ?? 'en';
} catch {
  // storage blocked
}

export function t(text: string, vars?: Record<string, string | number>): string {
  const s = dictionaries[lang]?.[text] ?? text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

import CN from "./cn";
import EN from "./en";
import TW from "./tw";
import ES from "./es";
import IT from "./it";
import TR from "./tr";
import JP from "./jp";
import DE from "./de";

export type { LocaleType } from "./cn";

export const AllLangs = [
  "en",
  "cn",
  "tw",
  "es",
  "it",
  "tr",
  "jp",
  "de",
] as const;

export type Lang = (typeof AllLangs)[number];
export const AllPaddleSpeech = ["ysg", "wjh"] as const;
type PaddleSpeech = (typeof AllPaddleSpeech)[number];

const LANG_KEY = "lang";
const DEFAULT_LANG = "en";
const VOICE_KEY = "voice";
const PADDLESPEECH_KEY = "paddleSpeech";

function getItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function getLanguage() {
  try {
    return navigator.language.toLowerCase();
  } catch {
    console.log("[Lang] failed to detect user lang.");
    return DEFAULT_LANG;
  }
}

export function getLang(): Lang {
  const savedLang = getItem(LANG_KEY);

  if (AllLangs.includes((savedLang ?? "") as Lang)) {
    return savedLang as Lang;
  }

  const lang = getLanguage();

  for (const option of AllLangs) {
    if (lang.includes(option)) {
      return option;
    }
  }

  return DEFAULT_LANG;
}

export function changeLang(lang: Lang) {
  setItem(LANG_KEY, lang);
  location.reload();
}

export function getVoice(): any {
  return getItem(VOICE_KEY);
}

export function changeVoice(voice: any) {
  setItem(VOICE_KEY, voice);
  location.reload();
}

export function getPaddleSpeech(): PaddleSpeech {
  const savedPaddleSpeech = getItem(PADDLESPEECH_KEY);

  if (AllPaddleSpeech.includes((savedPaddleSpeech ?? "") as PaddleSpeech)) {
    return savedPaddleSpeech as PaddleSpeech;
  }
  return "ysg";
}

export function changePaddleSpeech(paddleSpeech: PaddleSpeech) {
  setItem(PADDLESPEECH_KEY, paddleSpeech);
  location.reload();
}

export default {
  en: EN,
  cn: CN,
  tw: TW,
  es: ES,
  it: IT,
  tr: TR,
  jp: JP,
  de: DE,
}[getLang()] as typeof CN;

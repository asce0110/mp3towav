// 支持的语言列表 - 确保所有语言都有对应的消息文件
export const locales = ['en', 'zh-CN', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'ru'] as const;

// 默认语言
export const defaultLocale = 'en' as const;

// 语言详细信息
export const localesInfo = [
  {
    code: 'en',
    label: 'English',
    icon: '🇺🇸',
    dir: 'ltr',
  },
  {
    code: 'zh-CN',
    label: '简体中文',
    icon: '🇨🇳',
    dir: 'ltr',
  },
  {
    code: 'ja',
    label: '日本語',
    icon: '🇯🇵',
    dir: 'ltr',
  },
  {
    code: 'ko',
    label: '한국어',
    icon: '🇰🇷',
    dir: 'ltr',
  },
  {
    code: 'de',
    label: 'Deutsch',
    icon: '🇩🇪',
    dir: 'ltr',
  },
  {
    code: 'es',
    label: 'Español',
    icon: '🇪🇸',
    dir: 'ltr',
  },
  {
    code: 'pt',
    label: 'Português',
    icon: '🇧🇷',
    dir: 'ltr',
  },
  {
    code: 'fr',
    label: 'Français',
    icon: '🇫🇷',
    dir: 'ltr',
  },
  {
    code: 'ru',
    label: 'Русский',
    icon: '🇷🇺',
    dir: 'ltr',
  },
];

// 获取指定语言代码的详细信息
export function getLocaleInfo(code: string) {
  return localesInfo.find(locale => locale.code === code) || localesInfo[0];
}

export const pathnames = {
  '/': '/',
  '/history': '/history'
};

export const localeNames = {
  en: 'English',
  'zh-CN': '中文',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  ru: 'Русский'
} as const; 
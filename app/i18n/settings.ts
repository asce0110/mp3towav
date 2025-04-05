export const DEFAULT_LOCALE = 'en';

// 支持的语言列表
export const LOCALES = ['en', 'zh-CN', 'ja', 'ko', 'de', 'es', 'pt', 'fr', 'ru'];

// 语言显示名称
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-CN': '中文',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  ru: 'Русский',
};

// 语言方向
export const LANGUAGE_DIRECTIONS: Record<string, 'ltr' | 'rtl'> = {
  en: 'ltr',
  'zh-CN': 'ltr',
  ja: 'ltr',
  ko: 'ltr',
  de: 'ltr',
  es: 'ltr',
  pt: 'ltr',
  fr: 'ltr',
  ru: 'ltr',
};

// 语言切换配置
export const LANGUAGE_CONFIG = {
  defaultLocale: DEFAULT_LOCALE,
  locales: LOCALES,
}; 
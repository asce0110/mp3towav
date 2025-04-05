import { localesList, defaultLocale } from './i18n.config';

// 获取当前URL的本地化版本
export function getLocalizedUrl(pathname: string, locale: string): string {
  // 移除所有现有的语言前缀
  let cleanPath = pathname;
  
  // 检查是否已有语言前缀
  for (const loc of localesList) {
    if (pathname.startsWith(`/${loc}/`)) {
      cleanPath = pathname.substring(loc.length + 1);
      break;
    }
  }
  
  // 如果是默认语言，返回无前缀的URL
  if (locale === defaultLocale) {
    return cleanPath;
  }
  
  // 否则，添加语言前缀
  return `/${locale}${cleanPath}`;
}

// 获取语言切换的URL
export function getLanguageSwitcherUrl(pathname: string, locale: string): string {
  // 如果已经是在根路径
  if (pathname === '/' || pathname === '') {
    return locale === defaultLocale ? '/' : `/${locale}`;
  }
  
  return getLocalizedUrl(pathname, locale);
} 
// 导出 Link 组件
export { default as Link } from 'next/link';

// 导出基本导航功能
export { 
  usePathname,
  useRouter,
  redirect
} from 'next/navigation';

// 导入i18n配置
import { defaultLocale, localesList } from './i18n.config';

/**
 * 获取本地化URL
 */
export function getLocalizedUrl(path: string, locale: string): string {
  // 清除开头的斜杠并分割路径
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const pathParts = cleanPath.split('/');
  
  // 检查第一部分是否是有效的语言代码
  if (pathParts[0] && localesList.includes(pathParts[0])) {
    // 移除当前语言代码
    pathParts.shift();
  }
  
  // 重新组合剩余路径部分
  const newPath = pathParts.join('/');
  
  // 默认语言使用根路径
  if (locale === defaultLocale) {
    return newPath ? `/${newPath}` : '/';
  }
  
  // 其他语言添加前缀
  return newPath ? `/${locale}/${newPath}` : `/${locale}`;
}

/**
 * 获取语言切换后的URL
 */
export function getLanguageSwitcherUrl(currentPath: string, newLocale: string): string {
  // 直接处理默认语言情况
  if (newLocale === defaultLocale) {
    // 默认语言直接返回根路径
    return '/';
  }
  
  // 从当前路径中移除语言部分
  const pathWithoutLocale = currentPath.replace(
    new RegExp(`^/(${localesList.join('|')})(/|$)`), 
    '/'
  );
  
  // 非根路径情况
  if (pathWithoutLocale !== '/' && pathWithoutLocale !== '') {
    return `/${newLocale}${pathWithoutLocale}`;
  }
  
  // 根路径情况
  return `/${newLocale}`;
} 
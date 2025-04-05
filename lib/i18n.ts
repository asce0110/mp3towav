// 从i18n.config导入所有配置
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { defaultLocale, localesList, locales, getLocaleInfo } from './i18n.config';

// 重新导出，确保其他模块可以从这里导入
export { defaultLocale, localesList, locales, getLocaleInfo };

// 国际化配置
export default getRequestConfig(async ({ locale }) => {
  // 确保locale有效且为字符串类型
  if (!locale || !localesList.includes(locale as string)) {
    notFound();
  }

  try {
    // 动态加载对应语言的消息
    const messages = (await import(`../messages/${locale}/index.json`)).default;
    
    return {
      // 确保返回的locale是有效的字符串
      locale: locale as string,
      messages,
      // 添加默认的时区和日期时间设置
      timeZone: 'Asia/Shanghai',
      now: new Date()
    };
  } catch (error) {
    console.error(`Could not load messages for locale "${locale}"`, error);
    // 如果找不到指定语言的文件，使用默认语言
    const messages = (await import(`../messages/${defaultLocale}/index.json`)).default;
    
    return {
      locale: locale as string,
      messages,
      timeZone: 'Asia/Shanghai',
      now: new Date()
    };
  }
}); 
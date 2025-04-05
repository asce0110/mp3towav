import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { defaultLocale, locales } from '@/lib/i18n.config';

// 通过请求头检测语言
export default getRequestConfig(async ({ locale }) => {
  console.log(`[Messages] 解析国际化消息，传入locale: "${locale || '未定义'}"`);
  console.log(`[Messages] 当前URL路径: ${process.env.NODE_ENV === 'development' ? '(无法在服务端获取完整URL)' : ''}`);
  
  // 确保locale有效，如果无效则使用默认语言
  let currentLocale = locale || defaultLocale;
  
  console.log(`[Messages] 初始locale: "${currentLocale}", 默认语言: "${defaultLocale}"`);
  console.log(`[Messages] 支持的语言列表:`, locales);
  
  // 验证语言是否支持
  const localesList = Array.isArray(locales) ? locales : [];
  
  if (!localesList.includes(currentLocale as any)) {
    console.warn(`[Messages] 警告: 请求的语言 "${currentLocale}" 不受支持，将使用默认语言 "${defaultLocale}"`);
    currentLocale = defaultLocale;
  } else {
    console.log(`[Messages] 确认: 语言 "${currentLocale}" 在支持列表中`);
  }

  try {
    // 动态加载对应语言的消息
    console.log(`[Messages] 正在加载 ${currentLocale} 语言消息文件...`);
    const messages = (await import(`../../messages/${currentLocale}/index.json`)).default;
    console.log(`[Messages] 成功加载 ${currentLocale} 语言消息文件`);
    
    return {
      locale: currentLocale as string,
      messages,
      timeZone: 'Asia/Shanghai',
      now: new Date()
    };
  } catch (error) {
    console.error(`[Messages] 错误: 无法加载 "${currentLocale}" 语言消息文件`, error);
    
    // 如果找不到指定语言的文件，使用默认语言
    console.log(`[Messages] 尝试回退到默认语言: ${defaultLocale}`);
    
    try {
      const defaultMessages = (await import(`../../messages/${defaultLocale}/index.json`)).default;
      console.log(`[Messages] 成功加载默认语言消息作为回退`);
      
      return {
        locale: currentLocale as string, // 保持请求的语言不变
        messages: defaultMessages, // 但使用默认语言的消息
        timeZone: 'Asia/Shanghai',
        now: new Date()
      };
    } catch (defaultError) {
      console.error(`[Messages] 严重错误: 默认语言消息也无法加载`, defaultError);
      notFound();
    }
  }
}); 
"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocale } from 'next-intl';
import { locales, localeNames } from '@/lib/i18n.config';

// 语言标志的颜色配置
const LANGUAGE_FLAG_COLORS = {
  'en': 'bg-gradient-to-r from-blue-600 via-white to-red-600',
  'zh-CN': 'bg-gradient-to-r from-red-600 via-red-600 to-yellow-400',
  'ja': 'bg-gradient-to-r from-white via-red-600 to-white',
  'ko': 'bg-gradient-to-r from-blue-100 via-red-600 to-blue-100',
  'de': 'bg-gradient-to-r from-black via-red-600 to-yellow-400',
  'es': 'bg-gradient-to-r from-red-600 via-yellow-500 to-red-600',
  'fr': 'bg-gradient-to-r from-blue-600 via-white to-red-600',
  'pt': 'bg-gradient-to-r from-green-600 via-yellow-500 to-green-600',
  'ru': 'bg-gradient-to-r from-white via-blue-600 to-red-600'
};

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  // 生成链接根据当前路径和目标语言
  function getLocalizedPath(targetLocale: string) {
    // 从路径中移除当前语言前缀
    let cleanPath = pathname;
    
    // 如果当前路径有语言前缀，则移除
    for (const locale of locales) {
      if (pathname.startsWith(`/${locale}/`)) {
        cleanPath = pathname.substring(locale.length + 1);
        break;
      } else if (pathname === `/${locale}`) {
        cleanPath = '/';
        break;
      }
    }
    
    // 确保cleanPath以'/'开始
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    // 添加目标语言前缀（如果不是默认语言）
    if (targetLocale === 'en') {
      return cleanPath;
    } else {
      return `/${targetLocale}${cleanPath}`;
    }
  }

  function switchToLocale(locale: string) {
    const localizedPath = getLocalizedPath(locale);
    router.push(localizedPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-2 py-2">
          <div className={`w-6 h-4 rounded-sm ${LANGUAGE_FLAG_COLORS[currentLocale as keyof typeof LANGUAGE_FLAG_COLORS] || 'bg-gray-500'}`} />
          <span className="ml-2">{localeNames[currentLocale as keyof typeof localeNames]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {locales.map((locale) => (
          <DropdownMenuItem 
            key={locale}
            onClick={() => switchToLocale(locale)}
            className="flex items-center gap-2"
          >
            <div className={`w-6 h-4 rounded-sm ${LANGUAGE_FLAG_COLORS[locale as keyof typeof LANGUAGE_FLAG_COLORS] || 'bg-gray-500'}`} />
            <span>{localeNames[locale as keyof typeof localeNames]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
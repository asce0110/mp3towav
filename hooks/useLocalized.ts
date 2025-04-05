"use client";

import { useRouter as useNextRouter, usePathname as useNextPathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { getLocalizedUrl } from '@/lib/navigation-utils';
import { localesList } from '@/lib/i18n.config';

// 使用Next.js的router，但添加本地化功能
export function useRouter() {
  const nextRouter = useNextRouter();
  const currentLocale = useLocale();

  return {
    ...nextRouter,
    push: (href: string, options?: any) => {
      const localizedHref = getLocalizedUrl(href, currentLocale);
      return nextRouter.push(localizedHref, options);
    },
    replace: (href: string, options?: any) => {
      const localizedHref = getLocalizedUrl(href, currentLocale);
      return nextRouter.replace(localizedHref, options);
    },
    prefetch: (href: string) => {
      const localizedHref = getLocalizedUrl(href, currentLocale);
      return nextRouter.prefetch(localizedHref);
    }
  };
}

// 使用Next.js的pathname，但提供获取非本地化路径的能力
export function usePathname() {
  const pathname = useNextPathname();
  
  // 移除语言前缀
  for (const loc of localesList) {
    if (pathname.startsWith(`/${loc}/`)) {
      return pathname.substring(loc.length + 1);
    }
  }
  
  return pathname;
}

// 重定向函数 - 返回本地化的URL字符串
export function redirect(href: string, locale?: string) {
  const targetLocale = locale || useLocale();
  return getLocalizedUrl(href, targetLocale);
} 
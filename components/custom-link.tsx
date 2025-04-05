"use client";

import { ReactNode } from 'react';
import NextLink from 'next/link';
import { useLocale } from 'next-intl';
import { getLocalizedUrl } from '@/lib/navigation-utils';

// 创建Link组件
export function Link({ 
  href, 
  locale,
  children, 
  ...rest 
}: { 
  href: string; 
  locale?: string;
  children: ReactNode;
  [key: string]: any;
}) {
  const currentLocale = useLocale();
  const targetLocale = locale || currentLocale;

  // 获取本地化后的路径
  const path = getLocalizedUrl(href, targetLocale);

  return (
    <NextLink href={path} {...rest}>
      {children}
    </NextLink>
  );
} 
"use client";

import { MP3toWAVConverter } from "@/components/mp3-to-wav-converter"
import { SiteHeader } from "@/components/site-header"
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { locales, defaultLocale } from "@/lib/i18n.config"
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

export interface LocalizedHomeProps {
  params: {
    locale: string;
  }
}

// 定义locales的类型
type LocaleType = typeof locales[number];

export default function LocalizedHome() {
  const params = useParams();
  const [locale, setLocale] = useState<string>(params.locale as string || defaultLocale);
  const pathname = usePathname();
  const t = useTranslations('converter');
  const appT = useTranslations('app');
  
  useEffect(() => {
    const extractedLocale = pathname.split('/')[1];
    const localesList = locales;
    
    if (extractedLocale && localesList.includes(extractedLocale as LocaleType)) {
      setLocale(extractedLocale);
    } else {
      setLocale(defaultLocale);
    }
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sr-only">{appT('title')}</div>
      <SiteHeader />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4 text-center">{t('title')}</h1>
        <h2 className="text-xl font-medium mb-8 text-center text-gray-600 dark:text-gray-400">
          {t('subtitle')}
        </h2>
        <MP3toWAVConverter />
      </main>
    </div>
  );
} 
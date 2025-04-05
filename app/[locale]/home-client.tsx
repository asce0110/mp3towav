"use client";

import { MP3toWAVConverter } from "@/components/mp3-to-wav-converter"
import { SiteHeader } from "@/components/site-header"
import { useTranslations } from 'next-intl'

// 纯客户端组件，处理MP3转换器的渲染
export function HomeClient() {
  const t = useTranslations('converter');
  const appT = useTranslations('app');

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
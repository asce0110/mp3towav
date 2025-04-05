'use client'

import { useEffect, useState } from 'react'
import { HistoryList } from '@/components/history-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { loadHistory, cleanupHistory, clearHistory, HistoryItem } from '@/lib/history-service'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, RefreshCw, Trash2, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { usePathname } from 'next/navigation'
import { locales, defaultLocale } from "@/lib/i18n.config"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"

// 定义locales的类型
type LocaleType = typeof locales[number];

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [locale, setLocale] = useState<string>(defaultLocale);
  const pathname = usePathname();
  const { toast } = useToast()
  const t = useTranslations('history');
  const commonT = useTranslations('common');

  // 检测当前语言
  useEffect(() => {
    const extractedLocale = pathname.split('/')[1];
    if (extractedLocale && locales.includes(extractedLocale as LocaleType)) {
      setLocale(extractedLocale);
    } else {
      setLocale(defaultLocale);
    }
  }, [pathname]);

  // 加载历史记录并清理过期项
  useEffect(() => {
    cleanupHistory()
    const historyItems = loadHistory()
    setHistory(historyItems)
  }, [])
  
  // 清空历史记录
  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
    toast({
      title: t('toast.cleared.title'),
      description: t('toast.cleared.description'),
    })
  }
  
  // 刷新历史记录
  const refreshHistory = () => {
    cleanupHistory()
    const historyItems = loadHistory()
    setHistory(historyItems)
    toast({
      title: t('toast.refreshed.title'),
      description: t('toast.refreshed.description'),
    })
  }

  // 获取首页链接（根据当前语言）
  const getHomeLink = () => {
    return locale === defaultLocale ? '/' : `/${locale}`;
  };

  // FAQ数据
  const faqs = [
    {
      question: t('faq.storage.question'),
      answer: t('faq.storage.answer')
    },
    {
      question: t('faq.disappear.question'),
      answer: t('faq.disappear.answer')
    },
    {
      question: t('faq.download.question'),
      answer: t('faq.download.answer')
    },
    {
      question: t('faq.delete.question'),
      answer: t('faq.delete.answer')
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sr-only">{t('metaTitle')}</div>
      <SiteHeader />
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={getHomeLink()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshHistory} className="flex gap-1 items-center">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearHistory} className="flex gap-1 items-center">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear History
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('card.title')}</CardTitle>
            <CardDescription>
              {t('card.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <HistoryList historyItems={history} onUpdated={refreshHistory} />
            ) : (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <RefreshCw className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mb-2">{t('empty.title')}</p>
                <p className="text-sm">{t('empty.description')}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* FAQ部分 */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('faq.title')}</h2>
          </div>
          <Separator className="mb-4" />
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
} 
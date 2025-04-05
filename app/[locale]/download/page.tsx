"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { 
  Download, 
  Search,
  FileAudio, 
  HelpCircle,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { SiteHeader } from '@/components/site-header'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function DownloadPage() {
  const router = useRouter()
  const t = useTranslations('download')
  const commonT = useTranslations('common')
  
  const [downloadId, setDownloadId] = useState('')
  const [isValidId, setIsValidId] = useState(false)
  
  // 验证用户输入的下载ID
  const validateDownloadId = (id: string) => {
    // ID应该是字母数字字符，通常长度在8-32之间
    const idPattern = /^[a-zA-Z0-9_-]{8,32}$/
    const isValid = idPattern.test(id)
    setIsValidId(isValid)
    return isValid
  }
  
  // 处理用户输入下载ID
  const handleDownloadIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value.trim()
    setDownloadId(id)
    validateDownloadId(id)
  }
  
  // 根据ID打开下载页面
  const handleAccessDownload = () => {
    if (!downloadId) {
      toast({
        title: t('error.emptyId.title'),
        description: t('error.emptyId.description'),
        variant: "destructive"
      })
      return
    }
    
    if (isValidId) {
      router.push(`/download/${downloadId}`)
    } else {
      toast({
        title: t('error.invalidId.title'),
        description: t('error.invalidId.description'),
        variant: "destructive"
      })
    }
  }
  
  // 从URL中提取ID
  const handleExtractIdFromUrl = () => {
    try {
      let url = downloadId.trim()
      
      // 检查是否是有效URL
      if (!url.startsWith('http')) {
        // 尝试作为纯URL处理
        url = `https://${url}`
      }
      
      // 创建URL对象
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      
      // 检查是否是分享URL
      if (pathname.includes('/share/') || pathname.includes('/download/')) {
        // 提取最后一个路径部分作为ID
        const parts = pathname.split('/')
        const id = parts[parts.length - 1]
        
        if (id && validateDownloadId(id)) {
          setDownloadId(id)
          // 自动打开下载页面
          router.push(`/download/${id}`)
        } else {
          throw new Error('无效的ID格式')
        }
      } else {
        throw new Error('URL不包含有效的下载或分享路径')
      }
    } catch (error) {
      console.error('从URL提取ID失败:', error)
      toast({
        title: t('error.invalidUrl.title'),
        description: t('error.invalidUrl.description'),
        variant: "destructive"
      })
    }
  }
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="container max-w-5xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">{t('pageTitle')}</h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
            {t('pageDescription')}
          </p>
          
          <Card className="w-full max-w-2xl mx-auto mb-12">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="h-5 w-5 mr-2 text-blue-500" />
                {t('accessDownloads')}
              </CardTitle>
              <CardDescription>
                {t('enterIdInstructions')}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="relative">
                    <Input
                      placeholder={t('idPlaceholder')}
                      value={downloadId}
                      onChange={handleDownloadIdChange}
                      className="pr-20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAccessDownload()
                        }
                      }}
                    />
                    <Button
                      className="absolute right-1 top-1 h-8"
                      size="sm"
                      disabled={!isValidId && downloadId.length > 0}
                      onClick={handleAccessDownload}
                    >
                      {t('goButton')}
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gray-500"
                    onClick={handleExtractIdFromUrl}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {t('extractIdFromUrl')}
                  </Button>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="border-t px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 w-full">
                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{t('downloadExpiration')}</span>
              </div>
            </CardFooter>
          </Card>
          
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center mb-4">
              <HelpCircle className="h-5 w-5 mr-2 text-blue-500" />
              <h2 className="text-xl font-bold">{t('faq.title')}</h2>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>{t('faq.whereIsId.question')}</AccordionTrigger>
                <AccordionContent>
                  <p>{t('faq.whereIsId.answer')}</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2">
                <AccordionTrigger>{t('faq.howLongAvailable.question')}</AccordionTrigger>
                <AccordionContent>
                  <p>{t('faq.howLongAvailable.answer')}</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3">
                <AccordionTrigger>{t('faq.convertAnother.question')}</AccordionTrigger>
                <AccordionContent>
                  <p>
                    {t('faq.convertAnother.answer')}
                    <Link href="/" className="text-blue-500 hover:underline ml-1">
                      {t('faq.convertAnother.link')}
                    </Link>
                  </p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4">
                <AccordionTrigger>{t('faq.fileSize.question')}</AccordionTrigger>
                <AccordionContent>
                  <p>{t('faq.fileSize.answer')}</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5">
                <AccordionTrigger>{t('faq.sharing.question')}</AccordionTrigger>
                <AccordionContent>
                  <p>{t('faq.sharing.answer')}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>
    </>
  )
} 
"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Download, 
  Link2, 
  ArrowLeft,
  Copy,
  Check,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { toast } from '@/components/ui/use-toast'
import Link from 'next/link'

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('share')
  const commonT = useTranslations('common')
  
  const [shareData, setShareData] = useState<{ 
    shareId: string; 
    fileId: string; 
    fileUrl: string;
    fileName: string;
    originalName: string;
    expiresAt?: string;
    isLocalFile?: boolean; 
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    timeString: ''
  })
  
  useEffect(() => {
    const fetchShareData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const shareId = params.id as string
        const response = await fetch(`/api/share/${shareId}`)
        if (!response.ok) {
          // 尝试解析错误消息
          let errorMessage = await response.text()
          try {
            const errorData = JSON.parse(errorMessage)
            errorMessage = errorData.message || errorData.error || t('error')
          } catch {
            // 如果不是JSON，使用原始文本或默认错误
            errorMessage = errorMessage || t('error')
          }
          
          throw new Error(errorMessage)
        }
        
        const data = await response.json()
        setShareData(data)
        
        if (data.expiresAt) {
          updateTimeLeft(new Date(data.expiresAt).getTime())
        }
        
        setIsLoading(false)
      } catch (err: any) {
        console.error('获取分享数据失败:', err)
        setError(err.message || t('error'))
        setIsLoading(false)
        
        // 显示错误toast
        toast({
          title: t('failed'),
          description: err.message || t('error'),
          variant: "destructive",
        })
      }
    }
    
    if (params.id) {
      fetchShareData()
    }
  }, [params.id, t])
  
  // 在加载数据时显示本地文件警告
  useEffect(() => {
    if (shareData?.isLocalFile) {
      toast({
        title: t('localFileWarning'),
        description: t('localFileDescription'),
        variant: "warning",
        duration: 6000,
      })
    }
  }, [shareData, t])
  
  // 更新剩余时间
  const updateTimeLeft = useCallback((expireTime: number) => {
    const now = Date.now()
    const diff = expireTime - now
    
    if (diff <= 0) {
      setTimeLeft({ 
        hours: 0, 
        minutes: 0, 
        seconds: 0, 
        timeString: t('expired') 
      })
      return
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    let timeString = ''
    
    if (hours > 0) {
      timeString = `${hours}${t('hours')} ${minutes}${t('minutes')} ${seconds}${t('seconds')}`
    } else if (minutes > 0) {
      timeString = `${minutes}${t('minutes')} ${seconds}${t('seconds')}`
    } else {
      timeString = `${seconds}${t('seconds')}`
    }
    
    setTimeLeft({ hours, minutes, seconds, timeString })
  }, [t])
  
  useEffect(() => {
    if (!shareData?.expiresAt) return
    
    const expireTime = new Date(shareData.expiresAt).getTime()
    
    // 立即更新一次
    updateTimeLeft(expireTime)
    
    // 设置定时器每秒更新
    const timer = setInterval(() => {
      updateTimeLeft(expireTime)
    }, 1000)
    
    // 清理定时器
    return () => {
      clearInterval(timer)
    }
  }, [shareData?.expiresAt, updateTimeLeft])
  
  const handleCopyLink = () => {
    if (!shareData) return
    
    // 创建完整的访问URL (网站地址 + 分享路径)
    const origin = window.location.origin
    const shareUrl = `${origin}/${params.locale}/share/${shareData.shareId}`
    
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopied(true)
        toast({
          title: t('copied.title'),
          description: t('copied.description'),
        })
        setTimeout(() => setCopied(false), 3000)
      })
      .catch(err => {
        console.error('复制失败:', err)
        toast({
          title: t('copied.failed'),
          description: t('copied.error'),
          variant: "destructive",
        })
      })
  }
  
  const handleDownload = () => {
    if (!shareData) return
    
    try {
      // 重定向到下载页面而不是直接下载
      const fileId = shareData.fileId
      const fileName = shareData.originalName || shareData.fileName || `${shareData.fileId}.wav`
      const downloadUrl = shareData.fileUrl
      
      // 将下载信息保存到 sessionStorage
      const downloadData = {
        fileId: fileId,
        fileName: fileName,
        url: downloadUrl,
        shareId: shareData.shareId,
        expiresAt: shareData.expiresAt
      }
      
      // 使用文件ID作为存储键
      sessionStorage.setItem(`download_${fileId}`, JSON.stringify(downloadData))
      
      // 重定向到下载页面
      router.push(`/${params.locale}/download/${fileId}`)
      
      // 记录下载操作
      console.log(`重定向到下载页面: /${params.locale}/download/${fileId}`)
    } catch (err) {
      console.error('准备下载过程中出错:', err)
      toast({
        title: t('download.failed'),
        description: t('download.error'),
        variant: "destructive",
      })
    }
  }
  
  const handleBack = () => {
    router.push(`/${params.locale}`)
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SiteHeader />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBack} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {commonT('back')}
          </Button>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        
        <Card className="w-full bg-white dark:bg-slate-800 shadow-lg">
          <CardHeader className="bg-[#2A6FDB] text-white">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <Link2 className="h-5 w-5" />
              {t('title')}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-10">
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">{commonT('loading')}</p>
              </div>
            ) : error ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-medium mb-2">{t('failed')}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                <Button onClick={handleBack}>
                  {t('notFound.button')}
                </Button>
              </div>
            ) : shareData ? (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-1">{t('success.title')}</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-400">{t('success.description')}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-1">{t('file.title')}</h3>
                  <div className="flex items-center gap-2 justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                      {shareData.fileName || shareData.originalName || 'unnamed.wav'}
                    </div>
                    <div className="flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDownload}
                        className="whitespace-nowrap bg-white dark:bg-gray-700"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        {t('file.download')}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium">{t('link.title')}</h3>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4 mr-1" />
                      {timeLeft.timeString}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex">
                      <Input 
                        value={`${window.location.origin}/${params.locale}/share/${shareData.shareId}`}
                        readOnly 
                        className="flex-1 bg-gray-100 dark:bg-gray-800"
                      />
                      <Button 
                        variant="outline" 
                        className="ml-2 min-w-[100px]"
                        onClick={handleCopyLink}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            {t('link.copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            {t('link.copy')}
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md">
                      <div className="w-5 h-5 mr-2 flex-shrink-0 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800">
                        <Clock className="h-3 w-3 text-amber-600 dark:text-amber-300" />
                      </div>
                      <div>
                        <strong>{t('expiry')}</strong>{" "}
                        {timeLeft.timeString && `(${timeLeft.timeString})`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-medium mb-2">{t('notFound.title')}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{t('notFound.description')}</p>
                <Button onClick={handleBack}>
                  {t('notFound.button')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 
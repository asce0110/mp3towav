"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Download, 
  Check, 
  Share, 
  ArrowLeft,
  HomeIcon,
  Clock
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { toast } from '@/components/ui/use-toast'

interface DownloadData {
  fileId: string
  fileName: string
  url: string
  shareId?: string
  expiresAt?: string
}

export default function DownloadPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('converter')
  const commonT = useTranslations('common')
  const downloadT = useTranslations('download')
  
  const [fileName, setFileName] = useState<string>('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [shareId, setShareId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [previousPageUrl, setPreviousPageUrl] = useState<string | null>(null)
  
  // 计算剩余时间
  const calculateTimeLeft = () => {
    if (!expiresAt) return ''
    
    const expireTime = new Date(expiresAt).getTime()
    const now = new Date().getTime()
    const difference = expireTime - now
    
    if (difference <= 0) {
      return downloadT('expired')
    }
    
    // 计算剩余的小时和分钟
    const hours = Math.floor(difference / (1000 * 60 * 60))
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
    
    // 格式化输出
    if (hours > 0) {
      return `${hours}${downloadT('hours')} ${minutes}${downloadT('minutes')}`
    } else {
      return `${minutes}${downloadT('minutes')}`
    }
  }
  
  useEffect(() => {
    if (typeof window === 'undefined' || !params.id) return
    
    try {
      const fileId = params.id.toString()
      
      // 尝试多种存储键格式
      const downloadDataStr = 
        sessionStorage.getItem(`download_${fileId}`) || 
        sessionStorage.getItem(`download_file_${fileId}`)
      
      if (downloadDataStr) {
        const downloadData = JSON.parse(downloadDataStr) as DownloadData
        setFileName(downloadData.fileName)
        setDownloadUrl(downloadData.url)
        setShareId(downloadData.shareId || null)
        setExpiresAt(downloadData.expiresAt || null)
        setIsLoading(false)
      } else {
        // 如果找不到下载数据，返回首页
        toast({
          title: downloadT('notFound.title'),
          description: downloadT('notFound.description'),
          variant: "destructive",
        })
        setTimeout(() => router.push('/'), 2000)
      }
    } catch (error) {
      console.error("获取下载数据出错:", error)
      toast({
        title: downloadT('error.title'),
        description: downloadT('error.description'),
        variant: "destructive",
      })
      setTimeout(() => router.push('/'), 2000)
    }
  }, [params.id, router, downloadT])
  
  // 计算并更新剩余时间
  useEffect(() => {
    if (!expiresAt) return
    
    const timeLeft = calculateTimeLeft()
    setTimeLeft(timeLeft)
    
    // 每分钟更新一次
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)
    }, 60 * 1000)
    
    return () => {
      clearInterval(timer)
    }
  }, [expiresAt])
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // 检查是否有上一页的URL
    const prevPage = sessionStorage.getItem('previous_page')
    if (prevPage) {
      setHasPreviousPage(true)
      setPreviousPageUrl(prevPage)
    }
  }, [])
  
  const handleDownload = () => {
    if (!downloadUrl) return
    
    try {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      a.target = '_blank' // 在新窗口打开
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      setDownloaded(true)
      
      toast({
        title: downloadT('success.title'),
        description: downloadT('success.description'),
        variant: "success",
      })
    } catch (error) {
      console.error("下载过程中出错:", error)
      toast({
        title: downloadT('error.title'),
        description: downloadT('error.description'),
        variant: "destructive",
      })
    }
  }
  
  const handleBackToHome = () => {
    router.push('/')
  }
  
  const handleBackToBatch = () => {
    if (previousPageUrl) {
      router.push(previousPageUrl)
    } else {
      router.push('/batch-upload')
    }
  }
  
  const handleShare = async () => {
    if (!shareId) return
    
    try {
      // 创建分享链接
      const origin = window.location.origin
      const shareUrl = `${origin}/share/${shareId}`
      
      if (navigator.share && navigator.canShare && navigator.canShare({ url: shareUrl })) {
        // 如果浏览器支持 Web Share API
        await navigator.share({
          title: downloadT('share.title'),
          text: downloadT('share.text'),
          url: shareUrl
        })
      } else {
        // 如果不支持，复制分享链接到剪贴板
        navigator.clipboard.writeText(shareUrl)
        toast({
          title: downloadT('share.copied.title'),
          description: downloadT('share.copied.description'),
        })
      }
    } catch (error) {
      console.error('分享文件失败:', error)
      toast({
        title: downloadT('share.error.title'),
        description: downloadT('share.error.description'),
        variant: "destructive",
      })
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SiteHeader />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBackToHome} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {commonT('back')}
          </Button>
          {hasPreviousPage && (
            <Button variant="outline" onClick={handleBackToBatch} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {downloadT('backToBatch')}
            </Button>
          )}
          <h1 className="text-2xl font-bold">{downloadT('title')}</h1>
        </div>
        
        <Card className="w-full bg-white dark:bg-slate-800 shadow-lg">
          <CardHeader className="bg-[#2A6FDB] text-white">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <Download className="h-5 w-5" />
              {downloadT('title')}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="text-center py-10 space-y-6">
              {isLoading ? (
                <div className="text-center">
                  <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {commonT('loading')}
                  </p>
                </div>
              ) : downloadUrl ? (
                <>
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                    <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-medium mb-1">{downloadT('readyToDownload')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {fileName}
                    </p>
                    
                    {timeLeft && (
                      <div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 mb-6">
                        <Clock className="h-4 w-4 mr-1" />
                        {downloadT('expiresIn')}: {timeLeft}
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button 
                        className="bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 text-white px-8" 
                        size="lg"
                        onClick={handleDownload}
                      >
                        <Download className="h-5 w-5 mr-2" />
                        {downloaded ? downloadT('downloadAgain') : downloadT('downloadNow')}
                      </Button>
                      
                      {shareId && (
                        <Button 
                          variant="outline" 
                          size="lg"
                          onClick={handleShare}
                        >
                          <Share className="h-5 w-5 mr-2" />
                          {commonT('share')}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {downloaded && (
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg">
                      <h4 className="font-medium mb-2">{downloadT('whatNext')}</h4>
                      <p className="text-sm mb-4">
                        {downloadT('convertMore')}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={handleBackToHome}
                          className="bg-white dark:bg-slate-800"
                        >
                          <HomeIcon className="h-4 w-4 mr-2" />
                          {downloadT('backToHome')}
                        </Button>
                        
                        {hasPreviousPage && (
                          <Button
                            variant="outline"
                            onClick={handleBackToBatch}
                            className="bg-white dark:bg-slate-800"
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {downloadT('backToBatch')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    {downloadT('fileNotFound')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 
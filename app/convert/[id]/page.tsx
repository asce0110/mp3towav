"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Head from 'next/head'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { MP3Converter } from '@/components/mp3-converter' // 我们将创建一个单独的转换组件
import { Volume2, ArrowLeft } from 'lucide-react'

interface FileInfo {
  name: string
  size: number
  type: string
  duration: number
}

interface FileData {
  info: FileInfo
  data: string // base64 数据
}

export default function ConvertPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('converter')
  const commonT = useTranslations('common')

  const [fileData, setFileData] = useState<FileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 从会话存储中获取文件数据
    const id = params.id as string
    const fileDataString = sessionStorage.getItem(`file_${id}`)

    if (fileDataString) {
      try {
        const parsedData = JSON.parse(fileDataString)
        setFileData(parsedData)
      } catch (e) {
        setError('无法加载文件数据')
        toast({
          title: '错误',
          description: '无法加载文件数据，请返回首页重新上传。',
          variant: 'destructive'
        })
      }
    } else {
      setError('未找到文件数据')
      toast({
        title: '错误',
        description: '未找到文件数据，请返回首页上传文件。',
        variant: 'destructive'
      })
    }

    setIsLoading(false)
  }, [params.id])

  const handleBack = () => {
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">{commonT('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !fileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">{error || '发生错误'}</h2>
          <p className="mb-4">请返回首页重新上传文件</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {commonT('back')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto bg-gray-50 dark:bg-slate-900 rounded-xl p-6">
        <div className="mb-6 flex items-center w-full">
          <Button variant="ghost" onClick={handleBack} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {commonT('back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {fileData.info.name} - {(fileData.info.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>

        <Card className="w-full max-w-3xl bg-white dark:bg-white shadow-lg mb-8">
          <CardHeader className="bg-[#2A6FDB] text-white">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Volume2 className="h-6 w-6" />
              {t('title')}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {/* 引入转换组件，传递文件数据 */}
            <MP3Converter fileData={fileData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
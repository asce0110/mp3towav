"use client"

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Upload, 
  Download, 
  Settings, 
  Play, 
  ChevronUp, 
  ChevronDown, 
  Volume2, 
  AlertTriangle, 
  Loader2, 
  ArrowLeft 
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SiteHeader } from '@/components/site-header'
import { FileUpload } from '@/components/file-upload'
import { AudioWaveform } from '@/components/audio-waveform'

// 转换设置接口
interface ConversionSettings {
  volume: number
  sampleRate: string
  channels: string
  bitDepth: string
  trimStart: number
  trimEnd: number
}

interface UploadedFileInfo {
  name: string
  size: number
  type: string
  lastModified: number
}

export default function UploadPage() {
  const router = useRouter()
  const t = useTranslations('converter')
  const commonT = useTranslations('common')
  
  // 状态变量
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [fileId, setFileId] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [originalName, setOriginalName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null)
  
  // 转换设置
  const [settings, setSettings] = useState<ConversionSettings>({
    volume: 100,
    sampleRate: "44100",
    channels: "stereo",
    bitDepth: "16",
    trimStart: 0,
    trimEnd: 100,
  })
  
  // 引用
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // 从 sessionStorage 获取之前存储的文件
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 获取存储的文件信息
        const fileInfoStr = sessionStorage.getItem(`upload_file`);
        const objectUrl = sessionStorage.getItem(`upload_url`);
        
        if (fileInfoStr && objectUrl) {
          const fileInfo = JSON.parse(fileInfoStr) as UploadedFileInfo;
          setOriginalName(fileInfo.name);
          setFileObjectUrl(objectUrl);
          
          // 加载音频
          if (audioRef.current) {
            audioRef.current.src = objectUrl;
            
            audioRef.current.onloadedmetadata = () => {
              if (audioRef.current) {
                setAudioDuration(audioRef.current.duration);
                setSettings(prev => ({
                  ...prev,
                  trimStart: 0,
                  trimEnd: audioRef.current ? audioRef.current.duration : 100,
                }));
                
                // 生成波形
                generateWaveform(objectUrl);
                setIsSettingsOpen(true);
              }
            };
            
            audioRef.current.onerror = (e) => {
              console.error("Error loading audio:", e);
              toast({
                title: t('status.conversionFailed'),
                description: t('status.audioLoadError'),
                variant: "destructive",
              });
              setErrorMessage(t('status.audioLoadError'));
            };
          }
        }
      } catch (error) {
        console.error("Error retrieving file from sessionStorage:", error);
      }
    }
    
    // 清理函数
    return () => {
      if (fileObjectUrl) {
        URL.revokeObjectURL(fileObjectUrl);
      }
    };
  }, [t]);
  
  // 验证文件类型
  const isValidMP3File = (file: File): boolean => {
    console.log("Validating file:", file.name, file.type)
    
    // 检查MIME类型
    const isMimeValid = file.type === "audio/mpeg"
    
    // 检查文件扩展名
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const isExtensionValid = fileExtension === 'mp3'
    
    const isValid = isMimeValid || isExtensionValid
    console.log("File validation result:", isValid, "MIME:", isMimeValid, "Extension:", isExtensionValid)
    
    return isValid
  }
  
  // 处理拖放
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) {
      console.error("No file detected during drop")
      toast({
        title: t('status.conversionFailed'),
        description: "Please drop a valid MP3 file.",
        variant: "destructive",
      })
      return
    }
    
    console.log("Dropped file:", droppedFile.name, droppedFile.type)
    
    if (!isValidMP3File(droppedFile)) {
      console.error("File type invalid:", droppedFile.type, droppedFile.name)
      toast({
        title: t('status.conversionFailed'),
        description: t('status.audioLoadError'),
        variant: "destructive",
      })
      
      setErrorMessage(t('status.audioLoadError'))
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }
    
    if (droppedFile.size > 500 * 1024 * 1024) {
      console.error("File too large:", droppedFile.size)
      toast({
        title: t('status.conversionFailed'),
        description: t('dropzone.hint'),
        variant: "destructive",
      })
      
      setErrorMessage(t('dropzone.hint'))
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    handleFileSelected(droppedFile)
  }
  
  // 处理文件选择
  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile)
    setIsSettingsOpen(true)
    setDownloadUrl(null)

    // 创建临时URL
    const audioUrl = URL.createObjectURL(selectedFile)
    setFileObjectUrl(audioUrl)
    
    if (audioRef.current) {
      audioRef.current.src = audioUrl
      
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration)
          setSettings(prev => ({
            ...prev,
            trimStart: 0,
            trimEnd: audioRef.current ? audioRef.current.duration : 100,
          }))
          generateWaveform(audioUrl)
        }
      }
      
      audioRef.current.onerror = (e) => {
        console.error("Error loading audio:", e)
        toast({
          title: t('status.conversionFailed'),
          description: t('status.audioLoadError'),
          variant: "destructive",
        })
        setFile(null)
      }
    }
  }
  
  // 处理从文件上传组件选择的文件
  const handleNewFileSelected = (files: File[]) => {
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  }
  
  // 生成波形
  const generateWaveform = (audioUrl: string) => {
    // 创建模拟波形数据
    const mockWaveform = Array.from({ length: 200 }, (_, i) => {
      return (Math.sin(i * 0.1) * 0.3 + 0.5) * 0.8 + Math.random() * 0.2
    })
    
    setWaveformData(mockWaveform)
    // 实际项目中应添加绘制波形的代码
  }
  
  // 处理转换
  const handleConvert = async () => {
    if (!originalName && !file) return
    
    // 在实际项目中实现文件转换功能
    setIsConverting(true)
    setProgress(0)
    
    // 模拟转换过程
    let progress = 0
    const interval = setInterval(() => {
      progress += 5
      setProgress(progress)
      
      if (progress >= 100) {
        clearInterval(interval)
        setIsConverting(false)
        
        // 存储转换后的文件信息到sessionStorage
        const fileName = (originalName || file?.name || 'audio').replace(/\.mp3$/i, '.wav');
        const downloadData = {
          fileName: fileName,
          url: URL.createObjectURL(new Blob([], {type: 'audio/wav'}))
        }
        
        sessionStorage.setItem(`download_file`, JSON.stringify(downloadData))
        
        // 转换完成后跳转到固定的下载页面
        router.push(`/download`)
      }
    }, 200)
  }
  
  // 返回主页
  const handleBack = () => {
    router.push('/')
  }
  
  // 格式化时间为 mm:ss 格式
  function formatTime(seconds: number): string {
    if (isNaN(seconds)) return '00:00'
    
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
              <Upload className="h-5 w-5" />
              {t('dropzone.title')}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6">
            <audio ref={audioRef} className="hidden" />
            
            {!originalName && !file ? (
              <FileUpload 
                className="w-full" 
                onChange={handleNewFileSelected}
                maxSize={500}
                accept=".mp3,audio/mpeg"
              />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{originalName || file?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {file ? (file.size / (1024 * 1024)).toFixed(2) : ''} MB • {audioDuration.toFixed(2)}s
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (audioRef.current) {
                        try {
                          audioRef.current.pause()
                          audioRef.current.removeAttribute('src')
                          audioRef.current.load()
                        } catch (e) {
                          console.log("清理音频出错:", e)
                        }
                      }
                      
                      if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d')
                        if (ctx) {
                          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                        }
                      }
                      
                      if (fileObjectUrl) {
                        URL.revokeObjectURL(fileObjectUrl)
                      }
                      
                      setFile(null)
                      setOriginalName(null)
                      setFileObjectUrl(null)
                      setWaveformData([])
                      setAudioDuration(0)
                      setSettings({
                        volume: 100,
                        sampleRate: "44100",
                        channels: "stereo",
                        bitDepth: "16",
                        trimStart: 0,
                        trimEnd: 100,
                      })
                    }} 
                    disabled={isConverting}
                    className="rounded-full h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <span className="text-gray-500 text-lg font-medium">×</span>
                  </Button>
                </div>

                <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="border rounded-lg dark:border-gray-700">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between p-4 dark:hover:bg-slate-800 text-gray-800">
                      <div className="flex items-center">
                        <Settings className="h-5 w-5 mr-2" />
                        <span>{t('settings.title')}</span>
                      </div>
                      {isSettingsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="p-4 space-y-4 border-t dark:border-gray-700">
                    <div className="space-y-2">
                      <Label htmlFor="volume">{t('settings.volume')} ({settings.volume}%)</Label>
                      <Slider
                        id="volume"
                        min={0}
                        max={200}
                        step={1}
                        value={[settings.volume]}
                        onValueChange={(value) => {
                          setSettings({ ...settings, volume: value[0] })
                        }}
                        disabled={isConverting}
                        className="dark:bg-gray-700"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sample-rate">{t('settings.sampleRate')}</Label>
                      <Select
                        value={settings.sampleRate}
                        onValueChange={(value) => setSettings({ ...settings, sampleRate: value })}
                        disabled={isConverting}
                      >
                        <SelectTrigger id="sample-rate">
                          <SelectValue placeholder={t('settings.sampleRate')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22050">22050 Hz</SelectItem>
                          <SelectItem value="32000">32000 Hz</SelectItem>
                          <SelectItem value="44100">44100 Hz</SelectItem>
                          <SelectItem value="48000">48000 Hz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('settings.channels')}</Label>
                      <RadioGroup
                        value={settings.channels}
                        onValueChange={(value) => setSettings({ ...settings, channels: value })}
                        className="flex space-x-4"
                        disabled={isConverting}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mono" id="mono" />
                          <Label htmlFor="mono">{t('settings.mono')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="stereo" id="stereo" />
                          <Label htmlFor="stereo">{t('settings.stereo')}</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bit-depth">{t('settings.bitDepth')}</Label>
                      <Select
                        value={settings.bitDepth}
                        onValueChange={(value) => setSettings({ ...settings, bitDepth: value })}
                        disabled={isConverting}
                      >
                        <SelectTrigger id="bit-depth">
                          <SelectValue placeholder={t('settings.bitDepth')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16">16-bit</SelectItem>
                          <SelectItem value="24">24-bit</SelectItem>
                          <SelectItem value="32">32-bit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between mb-2">
                      <Label>{t('settings.trim')}</Label>
                      <div className="text-sm text-gray-500">
                        {formatTime(settings.trimStart)} - {formatTime(settings.trimEnd)}
                      </div>
                    </div>
                    
                    {fileObjectUrl && (
                      <AudioWaveform
                        audioUrl={fileObjectUrl}
                        trimStart={settings.trimStart}
                        trimEnd={settings.trimEnd}
                        onTrimChange={(start, end) => {
                          setSettings(prev => ({
                            ...prev,
                            trimStart: start,
                            trimEnd: end
                          }))
                        }}
                        disabled={isConverting}
                        className="w-full"
                      />
                    )}
                  </div>

                  {!isConverting ? (
                    <Button 
                      className="w-full bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 text-white" 
                      size="lg"
                      onClick={handleConvert}
                    >
                      {t('buttons.convert')}
                    </Button>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="relative w-24 h-24 mx-auto">
                        <svg className="w-24 h-24" viewBox="0 0 100 100">
                          <circle
                            className="text-gray-200"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="42"
                            cx="50"
                            cy="50"
                          />
                          <circle
                            className="text-[#2A6FDB]"
                            strokeWidth="8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="42"
                            cx="50"
                            cy="50"
                            strokeDasharray={264}
                            strokeDashoffset={264 - (progress / 100) * 264}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-medium">{progress}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">{t('status.converting')}...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 
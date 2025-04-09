"use client"

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast, ToastVariants } from '@/components/ui/use-toast'
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
  ArrowLeft,
  Zap
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SiteHeader } from '@/components/site-header'
import { FileUpload } from '@/components/file-upload'
import { AudioWaveform } from '@/components/audio-waveform'
import { saveFile } from '@/lib/file-storage'
import { generateUniqueId } from '@/lib/utils'
import { uploadToR2 } from '@/lib/r2-client'
import { addHistoryItem } from '@/lib/history-service'
import { createWavFile, AudioSettings } from './wav-generator'

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
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('converter')
  const commonT = useTranslations('common')
  
  // 状态变量
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
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
  const [convertedFile, setConvertedFile] = useState<{ fileName: string; url: string; blob: Blob } | null>(null)
  
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
    if (typeof window !== 'undefined' && params.id) {
      const uploadId = params.id.toString();
      
      try {
        // 获取存储的文件信息
        const fileInfoStr = sessionStorage.getItem(`upload_file_${uploadId}`);
        const objectUrl = sessionStorage.getItem(`upload_url_${uploadId}`);
        
        if (fileInfoStr && objectUrl) {
          const fileInfo = JSON.parse(fileInfoStr) as UploadedFileInfo;
          setOriginalName(fileInfo.name);
          setFileObjectUrl(objectUrl);
          
          // 加载音频
          if (audioRef.current) {
            try {
              // 先清除之前可能的事件监听器，避免重复绑定
              audioRef.current.onloadedmetadata = null;
              audioRef.current.onerror = null;
              
              // 直接加载音频，不使用fetch验证
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
                // 详细记录错误信息
                const errorDetails = {
                  message: audioRef.current?.error?.message || '未知错误',
                  code: audioRef.current?.error?.code || 'UNKNOWN',
                  name: (e as any)?.name || 'Error'
                };
                
                console.error("音频加载失败:", errorDetails);
                toast({
                  title: t('status.conversionFailed'),
                  description: `${t('status.audioLoadError')} (${errorDetails.code})`,
                  variant: "destructive",
                });
                setErrorMessage(t('status.audioLoadError'));
                
                // 清除无效数据
                sessionStorage.removeItem(`upload_file_${uploadId}`);
                sessionStorage.removeItem(`upload_url_${uploadId}`);
                
                // 重置状态
                setOriginalName(null);
                setFileObjectUrl(null);
              };
            } catch (audioError) {
              console.error("设置音频源时出错:", audioError);
              toast({
                title: t('status.conversionFailed'),
                description: t('status.genericError'),
                variant: "destructive",
              });
            }
          }
        } else {
          console.log(`未找到上传ID ${uploadId} 的文件数据`);
        }
      } catch (error) {
        console.error("从sessionStorage检索文件时出错:", error);
        toast({
          title: t('status.conversionFailed'),
          description: t('status.genericError'),
          variant: "destructive",
        });
      }
    }
    
    // 清理函数
    return () => {
      if (audioRef.current) {
        audioRef.current.onloadedmetadata = null;
        audioRef.current.onerror = null;
        audioRef.current.src = '';
      }
      
      if (fileObjectUrl) {
        URL.revokeObjectURL(fileObjectUrl);
      }
    };
  }, [params.id, t]);
  
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
      // 清除之前的事件处理器
      audioRef.current.onloadedmetadata = null;
      audioRef.current.onerror = null;
      
      // 设置新的音频源
      try {
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
          // 详细记录错误信息
          const errorDetails = {
            message: audioRef.current?.error?.message || '未知错误',
            code: audioRef.current?.error?.code || 'UNKNOWN',
            name: (e as any)?.name || 'Error'
          };
          
          console.error("音频加载失败:", errorDetails);
          toast({
            title: t('status.conversionFailed'),
            description: `${t('status.audioLoadError')} (${errorDetails.code})`,
            variant: "destructive",
          })
          
          // 释放URL资源
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
          
          setFile(null)
          setFileObjectUrl(null)
        }
      } catch (audioError) {
        console.error("设置音频源时出错:", audioError);
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        setFile(null)
        setFileObjectUrl(null)
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
  
  // 创建WAV文件Blob的辅助函数
  const createWavFile = (audioData: Float32Array, options: { sampleRate: number, channels: number, bitDepth: string | number }) => {
    const { sampleRate, channels } = options;
    const bitDepth = typeof options.bitDepth === 'string' ? parseInt(options.bitDepth) : options.bitDepth;
    
    // WAV文件格式头部
    const dataLength = audioData.length * (bitDepth / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    // "RIFF" 标识
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    
    // 文件长度
    view.setUint32(4, 32 + dataLength, true);
    
    // "WAVE" 标识
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    
    // "fmt " 子块
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    
    // 子块长度: 16
    view.setUint32(16, 16, true);
    
    // 音频格式: 1表示PCM
    view.setUint16(20, 1, true);
    
    // 声道数
    view.setUint16(22, channels, true);
    
    // 采样率
    view.setUint32(24, sampleRate, true);
    
    // 字节率 = 采样率 * 每个样本字节数
    view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
    
    // 块对齐 = 声道数 * 每个样本字节数
    view.setUint16(32, channels * (bitDepth / 8), true);
    
    // 每个样本位数
    view.setUint16(34, bitDepth, true);
    
    // "data" 子块
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    
    // 数据长度
    view.setUint32(40, dataLength, true);
    
    // 写入样本数据
    const volume = settings.volume / 100;
    const offset = 44;
    const bufferLength = audioData.length;
    
    if (bitDepth === 16) {
      for (let i = 0; i < bufferLength; i++) {
        const index = offset + i * 2;
        const sample = Math.max(-1, Math.min(1, audioData[i] * volume)) * 0x7FFF;
        view.setInt16(index, sample, true);
      }
    } else if (bitDepth === 24) {
      for (let i = 0; i < bufferLength; i++) {
        const index = offset + i * 3;
        const sample = Math.max(-1, Math.min(1, audioData[i] * volume)) * 0x7FFFFF;
        view.setUint8(index, sample & 0xFF);
        view.setUint8(index + 1, (sample >> 8) & 0xFF);
        view.setUint8(index + 2, (sample >> 16) & 0xFF);
      }
    } else if (bitDepth === 32) {
      for (let i = 0; i < bufferLength; i++) {
        const index = offset + i * 4;
        const sample = Math.max(-1, Math.min(1, audioData[i] * volume)) * 0x7FFFFFFF;
        view.setInt32(index, sample, true);
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  };

  // 上传文件到Cloudflare R2存储桶
  const uploadToR2 = async (wavBlob: Blob, fileName: string): Promise<string> => {
    // 首先生成文件的唯一标识符
    const fileKey = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}.wav`;
    console.log(`文件标识符: ${fileKey}, 原始文件名: ${fileName}`);

    // 检查R2是否已存在此文件 - 使用检查API
    try {
      console.log(`检查R2是否已存在相同文件...`);
      const checkResponse = await fetch('/api/check-file-exists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: fileName,
          fileHash: await computeSimpleHash(wavBlob), // 计算文件的简单哈希用于匹配
        })
      });

      if (checkResponse.ok) {
        const data = await checkResponse.json();
        if (data.exists && data.fileUrl) {
          console.log(`文件已存在于R2, 直接使用现有URL: ${data.fileUrl}`);
          return data.fileUrl;
        }
      }
    } catch (checkError) {
      console.warn(`检查文件存在性时出错:`, checkError);
      // 继续上传流程，不阻止上传
    }
    
    // 最大重试次数
    const maxRetries = 2;
    let currentRetry = 0;
    
    while (currentRetry <= maxRetries) {
      try {
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', wavBlob, fileName);
        formData.append('fileKey', fileKey); // 传递文件唯一标识符
        
        // 记录上传开始信息
        console.log(`开始上传文件到R2: ${fileName}, 大小: ${wavBlob.size} 字节, 重试次数: ${currentRetry}`);
        
        // 设置请求超时时间更长一些，大文件可能需要更长时间
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
        
        // 调用API上传文件
        const response = await fetch('/api/proxy-upload-to-r2', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        // 清除超时
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            // 尝试解析JSON错误
            errorData = JSON.parse(errorText);
            console.error('上传失败，服务器返回:', errorData);
          } catch {
            // 如果不是JSON，使用原始文本
            console.error('上传失败，服务器返回:', errorText);
          }
          
          throw new Error(`上传失败: ${errorText}`);
        }
        
        // 解析返回的文件URL
        const data = await response.json();
        console.log(`文件上传成功，返回URL: ${data.fileUrl}`);
        return data.fileUrl;
      } catch (error: any) {
        console.error(`上传到R2失败 (尝试 ${currentRetry+1}/${maxRetries+1}):`, error);
        
        if (error.name === 'AbortError') {
          console.log('上传请求超时');
          
          // 如果是最后一次尝试，抛出超时错误
          if (currentRetry === maxRetries) {
            throw new Error('上传超时，请稍后重试或缩小文件大小');
          }
        } else {
          // 记录详细的错误信息
          console.error('错误类型:', error.constructor.name);
          console.error('错误名称:', error.name);
          console.error('错误消息:', error.message);
          
          // 如果是最后一次尝试，抛出原始错误
          if (currentRetry === maxRetries) {
            throw error;
          }
        }
        
        // 增加重试计数
        currentRetry++;
        
        // 等待一段时间后重试
        const retryDelay = 2000 * (currentRetry); // 逐次增加等待时间
        console.log(`将在 ${retryDelay}ms 后重试上传...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        console.log('开始重试上传...');
      }
    }
    
    // 这段代码不应该被执行到，但为了类型安全
    throw new Error('上传过程中发生了未知错误');
  };

  // 计算文件的简单哈希值用于比较
  const computeSimpleHash = async (blob: Blob): Promise<string> => {
    // 为了效率，我们只取文件的前1MB和后1MB计算哈希
    // 这不是加密级别的哈希，只是为了快速比较文件
    const sampleSize = 1024 * 1024; // 1MB
    let arrayBuffer: ArrayBuffer;
    
    if (blob.size <= sampleSize * 2) {
      // 如果文件小于2MB，使用整个文件
      arrayBuffer = await blob.arrayBuffer();
    } else {
      // 否则，取前1MB和后1MB
      const headBlob = blob.slice(0, sampleSize);
      const tailBlob = blob.slice(blob.size - sampleSize);
      const headBuffer = await headBlob.arrayBuffer();
      const tailBuffer = await tailBlob.arrayBuffer();
      
      // 合并两个部分
      arrayBuffer = new ArrayBuffer(sampleSize * 2);
      const combinedView = new Uint8Array(arrayBuffer);
      combinedView.set(new Uint8Array(headBuffer), 0);
      combinedView.set(new Uint8Array(tailBuffer), sampleSize);
    }
    
    // 计算简单哈希值
    const hashArray = Array.from(new Uint8Array(arrayBuffer))
      .filter((_, i) => i % 256 === 0) // 每256字节取一个样本
      .map(b => b.toString(16).padStart(2, '0'));
    return hashArray.join('') + '-' + blob.size.toString(); // 附加文件大小
  };

  // 生成音频数据
  const generateAudioData = () => {
    const sampleRate = parseInt(settings.sampleRate);
    const channels = settings.channels === "stereo" ? 2 : 1;
    const duration = settings.trimEnd - settings.trimStart;
    
    // 创建音频数据
    const bufferLength = Math.floor(sampleRate * duration * channels);
    const audioData = new Float32Array(bufferLength);
    
    // 生成简单的正弦波
    const frequency = 440; // A4音高
    for (let i = 0; i < bufferLength; i++) {
      const t = i / (sampleRate * channels);
      
      // 生成正弦波
      audioData[i] = Math.sin(2 * Math.PI * frequency * t);
      
      // 为双声道添加稍微不同的波形
      if (channels === 2 && i % 2 === 1) {
        audioData[i] = Math.sin(2 * Math.PI * (frequency + 5) * t);
      }
      
      // 添加淡入淡出效果
      const fadeTime = 0.1; // 淡入淡出时间(秒)
      const fadeSamples = fadeTime * sampleRate * channels;
      
      // 淡入
      if (i < fadeSamples) {
        audioData[i] *= (i / fadeSamples);
      }
      
      // 淡出
      if (i > bufferLength - fadeSamples) {
        audioData[i] *= ((bufferLength - i) / fadeSamples);
      }
    }
    
    return audioData;
  };

  // 处理转换
  const handleConvert = async () => {
    if (!originalName && !file) return
    
    // 在实际项目中实现文件转换功能
    setIsConverting(true)
    setProgress(0)
    
    // 使用当前的uploadId或重新生成一个ID
    const downloadId = params.id || generateUniqueId();
    
    // 模拟转换过程
    let progress = 0
    const interval = setInterval(() => {
      progress += 5
      setProgress(progress)
      
      if (progress >= 100) {
        clearInterval(interval)
        setIsConverting(false)
        
        try {
          // 生成音频数据并创建WAV文件
          const audioData = generateAudioData();
          const wavBlob = createWavFile(audioData, {
            sampleRate: parseInt(settings.sampleRate),
            channels: settings.channels === "stereo" ? 2 : 1,
            bitDepth: settings.bitDepth
          });
          
          // 文件名
          const fileName = (originalName || file?.name || 'audio').replace(/\.mp3$/i, '.wav');
          
          // 存储转换后的文件信息到sessionStorage
          const downloadData = {
            fileName: fileName,
            url: URL.createObjectURL(wavBlob),
            blob: wavBlob // 保存Blob对象以便分享时使用
          }
          
          // 保存到sessionStorage，同时设置到state用于UI显示
          sessionStorage.setItem(`download_file_${downloadId}`, JSON.stringify({
            fileName: downloadData.fileName,
            url: downloadData.url,
            fileId: downloadId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
          }));
          
          // 将音频数据也存储到sessionStorage，供批处理使用
          // 将Float32Array转换为普通数组存储
          try {
            // 对于大文件，只存储元数据，不存储完整的音频数据
            const fileSizeInMB = wavBlob.size / (1024 * 1024);
            
            if (fileSizeInMB > 4) { // 如果文件大于4MB
              sessionStorage.setItem(`file_data_${downloadId}`, JSON.stringify({
                fileName: fileName,
                sampleRate: settings.sampleRate,
                channels: settings.channels,
                bitDepth: settings.bitDepth,
                // 添加状态标记表明这是已转换的数据
                isConverted: true,
                // 对于大文件只存储引用和大小，而不是实际数据
                blobUrl: downloadData.url,
                fileSize: wavBlob.size,
                isLargeFile: true
              }));
            } else {
              // 对于小文件可以继续使用原来的方式
              sessionStorage.setItem(`file_data_${downloadId}`, JSON.stringify({
                audioData: Array.from(audioData),
                fileName: fileName,
                sampleRate: settings.sampleRate,
                channels: settings.channels,
                bitDepth: settings.bitDepth,
                isConverted: true
              }));
            }
          } catch (storageError) {
            console.error("存储音频数据时出错:", storageError);
            // 即使存储失败，也继续设置转换状态
            toast({
              title: "警告",
              description: "由于文件较大，无法在浏览器中保存完整数据，但您仍可下载或分享此文件。",
              variant: "warning",
            });
          }
          
          // 设置转换状态，允许分享和下载
          setDownloadUrl(downloadData.url);
          // 保存文件信息以便分享时使用
          setConvertedFile(downloadData);
          
          // 添加到历史记录
          addHistoryItem({
            id: generateUniqueId(),
            fileId: downloadId,
            originalName: fileName,
            convertedAt: Date.now(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).getTime(),
            storageType: 'local',
            localUrl: downloadData.url,
            fileSize: wavBlob.size,
            settings: {
              sampleRate: settings.sampleRate,
              channels: settings.channels,
              bitDepth: settings.bitDepth,
              volume: settings.volume
            }
          });
          
          toast({
            title: t('status.conversionSuccess'),
            description: t('status.readyToDownload'),
            variant: "success",
          });
        } catch (error: any) {
          console.error("转换过程中出错:", error);
          toast({
            title: t('status.conversionFailed'),
            description: error.message || t('status.conversionError'),
            variant: "destructive",
          });
        }
      }
    }, 200)
  }
  
  // 处理分享功能 - 只在转换完成后可用
  const handleShare = async () => {
    if (!convertedFile) {
      toast({
        title: t('share.error'),
        description: t('share.noFileToShare'),
        variant: "destructive",
      });
      return;
    }
    
    setIsSharing(true);
    setProgress(0);
    
    try {
      // 模拟上传进度
      let progress = 0;
      const interval = setInterval(() => {
        progress += 2;  // 稍微慢一点，给上传预留时间
        setProgress(progress);
        
        if (progress >= 95) {
          clearInterval(interval);
        }
      }, 200);
      
      // 文件信息
      const { blob, fileName } = convertedFile;
      
      // 生成本地URL (用作备份，以防上传失败)
      const localUrl = convertedFile.url;
      
      let fileUrl;
      let useLocal = false;
      
      try {
        // 尝试上传到R2存储
        console.log("开始上传到R2存储...");
        
        // 上传文件
        fileUrl = await uploadToR2(blob, fileName);
        
        console.log("上传成功，获取到URL:", fileUrl);
      } catch (uploadError: any) {
        console.error("R2上传失败:", uploadError);
        
        // 使用本地URL作为备份
        fileUrl = localUrl;
        useLocal = true;
        
        // 显示警告，但继续流程
        toast({
          title: t('share.uploadWarning'),
          description: t('share.usingLocal'),
          variant: "warning" as ToastVariants,
        });
      }
      
      // 清除进度计时器
      clearInterval(interval);
      setProgress(100);
      
      // 生成分享ID
      const shareId = generateUniqueId();
      setShareId(shareId);
      
      // 创建分享请求
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: shareId,
          fileUrl: fileUrl,
          originalName: fileName,
          isLocalFile: useLocal,
          fileKey: fileUrl.split('/').pop(), // 添加fileKey，确保API能找到正确的文件
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("分享API返回错误:", response.status, errorData);
        throw new Error(`分享请求失败: ${response.status} - ${errorData.message || ''}`);
      }
      
      const shareData = await response.json();
      
      // 设置完成状态
      setIsSharing(false);
      
      // 创建完整的分享链接
      const origin = window.location.origin;
      const fullShareUrl = `${origin}/share/${shareData.shareId || shareId}`;
      
      // 导航到分享页面，并在URL参数中传递链接
      router.push(`/share?url=${encodeURIComponent(fullShareUrl)}`);
    } catch (error: any) {
      console.error("分享过程中出错:", error);
      setIsSharing(false);
      setProgress(0);
      
      toast({
        title: t('share.failed'),
        description: error.message || t('share.error'),
        variant: "destructive",
      });
    }
  };
  
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
  
  // 生成唯一ID的辅助函数
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };
  
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
                      <Label htmlFor="sample-rate">{t('settings.sampleRate.label')}</Label>
                      <Select
                        value={settings.sampleRate}
                        onValueChange={(value) => setSettings({ ...settings, sampleRate: value })}
                        disabled={isConverting}
                      >
                        <SelectTrigger id="sample-rate">
                          <SelectValue placeholder={t('settings.sampleRate.label')} />
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
                      <Label>{t('settings.channels.label')}</Label>
                      <RadioGroup
                        value={settings.channels}
                        onValueChange={(value) => setSettings({ ...settings, channels: value })}
                        className="flex space-x-4"
                        disabled={isConverting}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mono" id="mono" />
                          <Label htmlFor="mono">{t('settings.channels.mono')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="stereo" id="stereo" />
                          <Label htmlFor="stereo">{t('settings.channels.stereo')}</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bit-depth">{t('settings.bitDepth.label')}</Label>
                      <Select
                        value={settings.bitDepth}
                        onValueChange={(value) => setSettings({ ...settings, bitDepth: value })}
                        disabled={isConverting}
                      >
                        <SelectTrigger id="bit-depth">
                          <SelectValue placeholder={t('settings.bitDepth.label')} />
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

                  {/* 操作按钮 */}
                  <div className="flex justify-center gap-4 mt-6">
                    {isConverting || isSharing ? (
                      // 转换或分享过程中显示进度
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                          <div 
                            className={`h-2.5 rounded-full ${isSharing ? 'bg-green-600 dark:bg-green-500' : 'bg-blue-600 dark:bg-blue-500'}`}
                            style={{ width: `${progress}%` }}
                          >
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          {isSharing 
                            ? t('share.uploading')
                            : t('status.converting')
                          }...
                        </p>
                      </div>
                    ) : (
                      // 非处理状态
                      <>
                        {/* 转换按钮 - 始终显示 */}
                        <Button 
                          onClick={handleConvert}
                          disabled={!file && !originalName}
                          className="flex-1 max-w-md"
                        >
                          <Zap className="h-5 w-5 mr-2" />
                          {t('buttons.convert')}
                        </Button>
                        
                        {/* 分享和下载按钮 - 仅在有转换结果时显示 */}
                        {convertedFile && (
                          <>
                            <Button 
                              onClick={handleShare}
                              className="flex-1 max-w-md"
                              variant="secondary"
                            >
                              <Upload className="h-5 w-5 mr-2" />
                              {t('buttons.share')}
                            </Button>
                            
                            {downloadUrl && (
                              <Button 
                                asChild
                                variant="outline"
                                className="flex-1 max-w-md"
                              >
                                <a 
                                  href={downloadUrl} 
                                  download={convertedFile.fileName}
                                >
                                  <Download className="h-5 w-5 mr-2" />
                                  {t('buttons.download')}
                                </a>
                              </Button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 
"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from 'next-intl'
import {
  Play,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  Settings,
  AlertTriangle,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "@/components/ui/use-toast"
import { ShareButton } from './share-button'

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

interface ConversionSettings {
  volume: number
  sampleRate: string
  channels: string
  bitDepth: string
  trimStart: number
  trimEnd: number
}

interface MP3ConverterProps {
  fileData: FileData
}

export function MP3Converter({ fileData }: MP3ConverterProps) {
  const t = useTranslations('converter')
  const commonT = useTranslations('common')

  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [audioDuration, setAudioDuration] = useState(fileData.info.duration || 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [fileId, setFileId] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [originalName, setOriginalName] = useState<string | null>(fileData.info.name || null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)
  const [mediaSource, setMediaSource] = useState<MediaElementAudioSourceNode | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [canvasReady, setCanvasReady] = useState(false)
  const [isDraggingTrim, setIsDraggingTrim] = useState({active: false, type: ''})

  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [settings, setSettings] = useState<ConversionSettings>({
    volume: 100,
    sampleRate: "44100",
    channels: "stereo",
    bitDepth: "16",
    trimStart: 0,
    trimEnd: audioDuration || 100,
  })

  // 组件加载时从base64数据创建文件对象
  useEffect(() => {
    if (fileData && fileData.data) {
      // 从base64创建Blob
      const byteString = atob(fileData.data.split(',')[1])
      const mimeType = fileData.data.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      
      const blob = new Blob([ab], { type: mimeType })
      const newFile = new File([blob], fileData.info.name, { type: mimeType })
      
      setFile(newFile)
      setAudioDuration(fileData.info.duration)
      setSettings(prev => ({
        ...prev,
        trimStart: 0,
        trimEnd: fileData.info.duration
      }))
      
      // 创建音频元素
      const audioUrl = URL.createObjectURL(newFile)
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.onloadedmetadata = () => {
          generateWaveform(audioUrl)
        }
      }
    }
  }, [fileData])

  // 添加生成波形数据的函数
  const generateWaveform = (audioUrl: string) => {
    // 创建模拟波形数据
    const mockWaveform = Array.from({ length: 200 }, (_, i) => {
      // 使用正弦函数创建更逼真的波形
      return (Math.sin(i * 0.1) * 0.3 + 0.5) * 0.8 + Math.random() * 0.2
    })
    
    setWaveformData(mockWaveform)
    drawWaveform(mockWaveform)
  }

  // 绘制波形
  const drawWaveform = (data: number[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    // Only proceed if we have data
    if (!data || data.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    
    // 检测当前是否处于深色模式
    const isDarkMode = document.documentElement.classList.contains('dark')
    
    // 根据音量调整波形高度
    const volumeAdjustedData = data.map(value => {
      return value * (settings.volume / 100)
    })

    // 绘制波形
    ctx.fillStyle = isDarkMode ? "#3B82F6" : "#2A6FDB"
    const barWidth = width / data.length
    volumeAdjustedData.forEach((value, index) => {
      const barHeight = value * height
      const x = index * barWidth
      const y = (height - barHeight) / 2
      ctx.fillRect(x, y, barWidth - 1, barHeight)
    })

    // 绘制裁剪区域和标记
    if (audioDuration > 0) {
      const startX = (settings.trimStart / audioDuration) * width
      const endX = (settings.trimEnd / audioDuration) * width
      
      // 半透明背景
      ctx.fillStyle = isDarkMode 
        ? "rgba(59, 130, 246, 0.2)"
        : "rgba(42, 111, 219, 0.1)"
      ctx.fillRect(startX, 0, endX - startX, height)
      
      // 标记宽度
      const markerWidth = 6
      
      // 起始标记(绿色)
      ctx.fillStyle = isDarkMode ? "#4ADE80" : "#4ade80"
      ctx.fillRect(startX - markerWidth/2, 0, markerWidth, height)
      
      // 结束标记(红色)
      ctx.fillStyle = isDarkMode ? "#F87171" : "#ef4444"
      ctx.fillRect(endX - markerWidth/2, 0, markerWidth, height)
      
      // 拖动指示器
      ctx.fillStyle = "#ffffff"
      
      // 起始标记指示器
      ctx.beginPath()
      ctx.arc(startX, height/2, 8, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = isDarkMode ? "#4ADE80" : "#4ade80"
      ctx.beginPath()
      ctx.arc(startX, height/2, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // 结束标记指示器
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(endX, height/2, 8, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = isDarkMode ? "#F87171" : "#ef4444"
      ctx.beginPath()
      ctx.arc(endX, height/2, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 波形更新
  useEffect(() => {
    if (waveformData.length > 0 && file) {
      drawWaveform(waveformData)
    }
  }, [settings.volume, settings.trimStart, settings.trimEnd, waveformData, audioDuration, file, currentTime, isPlaying])

  // 处理音频转换
  const handleConvert = async () => {
    if (!file) return;
    
    setIsConverting(true);
    setProgress(0);
    
    console.log('[转换] 开始处理文件:', file.name, '大小:', file.size);
    
    try {
      await handleClientSideConversion();
    } catch (error) {
      console.error('[转换] 客户端转换失败:', error);
      toast({
        title: t('status.conversionFailed'),
        description: String(error) || t('status.audioLoadError'),
        variant: "destructive",
      });
      setProgress(0);
    } finally {
      setIsConverting(false);
    }
  };

  // 客户端转换实现
  const handleClientSideConversion = async () => {
    if (!file) return;
    
    try {
      setProgress(10);
      
      // 设置原始文件名
      setOriginalName(file.name);
      
      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      setProgress(20);
      
      // 读取文件数据
      const arrayBuffer = await file.arrayBuffer();
      setProgress(30);
      
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setProgress(50);
      
      // 应用修剪和音量调整
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      
      // 计算修剪后的样本
      const startSample = Math.floor(settings.trimStart * sampleRate);
      const endSample = Math.floor(settings.trimEnd * sampleRate);
      const sampleCount = endSample - startSample;
      
      // 创建修剪后的音频缓冲区
      const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        sampleCount,
        sampleRate
      );
      
      // 创建缓冲区源
      const bufferSource = offlineContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      
      // 应用音量调整
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = settings.volume / 100;
      
      // 连接节点
      bufferSource.connect(gainNode);
      gainNode.connect(offlineContext.destination);
      
      // 从修剪点开始播放
      bufferSource.start(0, settings.trimStart, settings.trimEnd - settings.trimStart);
      
      setProgress(60);
      
      // 渲染音频
      const renderedBuffer = await offlineContext.startRendering();
      
      setProgress(70);
      
      // 转换为WAV格式
      const wavBuffer = audioBufferToWav(renderedBuffer);
      
      setProgress(80);
      
      // 创建Blob和URL
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      setProgress(90);
      
      // 生成唯一的文件ID
      const clientFileId = generateUniqueId();
      setFileId(clientFileId);
      
      // 可选：上传到服务器
      try {
        // 创建FormData
        const formData = new FormData();
        formData.append('file', blob, `${originalName || 'converted'}.wav`);
        formData.append('clientFileId', clientFileId);
        
        // 上传到服务器
        const response = await fetch('/api/upload-client-wav', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.shareId) {
            setShareId(data.shareId);
          }
          console.log('Client-converted WAV uploaded successfully:', data);
        } else {
          console.error('上传失败:', response.status, await response.text());
        }
      } catch (uploadError) {
        console.error('Error preparing upload:', uploadError);
      }
      
      setProgress(100);
      
      // 设置下载URL
      setDownloadUrl(url);
      
      // 验证WAV文件
      const tempAudio = new Audio(url);
      tempAudio.preload = 'auto';
      
      // 播放成功完成声音
      try {
        const audio = new Audio("/complete.mp3");
        audio.play().catch(err => console.error("Error playing completion sound:", err));
      } catch (error) {
        console.error("Audio playback error:", error);
      }
      
      // 通知用户
      toast({
        title: t('status.conversionSuccess'),
        description: t('buttons.download'),
      });
      
    } catch (error) {
      console.error("Client-side conversion failed:", error);
      throw error;
    }
  };

  // 生成唯一ID的辅助函数
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  // 音频缓冲区转WAV格式
  function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2; // 16-bit = 2 bytes
    const sampleRate = buffer.sampleRate;
    
    // 创建WAV缓冲区，包括头部(44字节)和数据
    const wavBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(wavBuffer);
    
    // 写入WAV头部
    // RIFF标识符
    writeString(view, 0, 'RIFF');
    // 文件长度
    view.setUint32(4, 36 + length, true);
    // WAVE标识符
    writeString(view, 8, 'WAVE');
    // fmt子块
    writeString(view, 12, 'fmt ');
    // 子块大小
    view.setUint32(16, 16, true);
    // 音频格式(1表示PCM)
    view.setUint16(20, 1, true);
    // 通道数
    view.setUint16(22, numOfChannels, true);
    // 采样率
    view.setUint32(24, sampleRate, true);
    // 字节率(采样率 * 每个样本的字节数)
    view.setUint32(28, sampleRate * numOfChannels * 2, true);
    // 块对齐(每个样本的字节数)
    view.setUint16(32, numOfChannels * 2, true);
    // 位深度
    view.setUint16(34, 16, true);
    // 数据子块头部
    writeString(view, 36, 'data');
    // 数据长度
    view.setUint32(40, length, true);
    
    // 为简化，假设最多两个通道(立体声)
    const channelData = [];
    for (let i = 0; i < numOfChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    // 将样本写入WAV文件
    let offset = 44;
    const volume = 0.8; // 防止削波
    
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        // 将浮点数转换为16位整数
        const sample = Math.max(-1, Math.min(1, channelData[channel][i])) * volume;
        const int = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        
        view.setInt16(offset, int, true);
        offset += 2;
      }
    }
    
    return wavBuffer;
  }

  // 辅助函数：将字符串写入DataView
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // 更新尝听功能实现
  const handlePreviewClip = () => {
    if (!audioRef.current) return;

    // 如果当前正在播放，停止播放
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    try {
      // 设置音频起始位置为裁剪起点
      audioRef.current.currentTime = settings.trimStart;
      
      // 使用Web Audio API处理音量增益
      if (!audioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const gain = ctx.createGain();
        const source = ctx.createMediaElementSource(audioRef.current);
        
        // 音频处理管道: 源 -> 增益节点 -> 输出
        source.connect(gain);
        gain.connect(ctx.destination);
        
        // 保存引用供后续使用
        setAudioContext(ctx);
        setGainNode(gain);
        setMediaSource(source);
      }
      
      // 设置增益值 (volume/100) - 允许值大于1.0
      if (gainNode) {
        gainNode.gain.value = settings.volume / 100;
      }

      // 播放音频
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setCurrentTime(settings.trimStart);
        })
        .catch((err) => {
          console.error("播放错误:", err);
          toast({
            title: t('status.playbackError'),
            description: t('status.audioLoadError'),
            variant: "destructive",
          });
          setIsPlaying(false);
        });

      // 当播放到裁剪终点时停止
      const checkTimeUpdate = () => {
        if (audioRef.current && audioRef.current.currentTime >= settings.trimEnd) {
          audioRef.current.pause();
          setIsPlaying(false);
          audioRef.current.removeEventListener("timeupdate", checkTimeUpdate);
        }
      };

      audioRef.current.addEventListener("timeupdate", checkTimeUpdate);
      
      // 当音频播放结束时清理播放状态
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
      });
    } catch (error) {
      console.error("音频预览错误:", error);
      setIsPlaying(false);
      toast({
        title: t('status.playbackError'),
        description: t('status.audioLoadError'),
        variant: "destructive",
      });
    }
  };

  // 处理下载
  const handleDownload = () => {
    if (!downloadUrl) return;
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${originalName?.replace(/\.[^.]+$/, '') || 'converted'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 确保播放状态在组件初始化时为false
  useEffect(() => {
    setIsPlaying(false);
    
    return () => {
      // 组件卸载时清理
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // 调整Canvas大小并确保坐标系一致
  useEffect(() => {
    if (canvasRef.current && file) {
      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        // 设置画布实际像素与CSS像素一致以解决DPI缩放问题
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        console.log(`Canvas大小已调整: ${canvas.width}x${canvas.height}`);
        
        // 触发一次重绘
        if (waveformData.length > 0) {
          drawWaveform(waveformData);
        }
        
        setCanvasReady(true);
      };
      
      // 立即调整
      resizeCanvas();
      
      // 监听窗口大小变化
      window.addEventListener('resize', resizeCanvas);
      
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [file, waveformData]);

  // 添加拖动处理逻辑
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !file || audioDuration <= 0) return;
    
    // 鼠标按下事件
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = canvas.width;
      
      // 计算标记位置
      const startX = (settings.trimStart / audioDuration) * width;
      const endX = (settings.trimEnd / audioDuration) * width;
      
      // 检测是否点击了标记
      if (Math.abs(x - endX) < 20) {
        setIsDraggingTrim({active: true, type: 'end'});
        e.preventDefault();
      } else if (Math.abs(x - startX) < 20) {
        setIsDraggingTrim({active: true, type: 'start'});
        e.preventDefault();
      }
    };
    
    // 鼠标移动事件
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingTrim.active) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = canvas.width;
      const dragTime = (x / width) * audioDuration;
      
      if (isDraggingTrim.type === 'end') {
        // 拖动结束标记
        const newEnd = Math.max(settings.trimStart + 0.5, Math.min(dragTime, audioDuration));
        setSettings(prev => ({...prev, trimEnd: newEnd}));
      } else if (isDraggingTrim.type === 'start') {
        // 拖动起始标记
        const newStart = Math.max(0, Math.min(dragTime, settings.trimEnd - 0.5));
        setSettings(prev => ({...prev, trimStart: newStart}));
      }
    };
    
    // 鼠标释放事件
    const handleMouseUp = () => {
      if (isDraggingTrim.active) {
        setIsDraggingTrim({active: false, type: ''});
      }
    };
    
    // 添加事件监听器
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [file, audioDuration, settings, isDraggingTrim]);

  return (
    <div className="space-y-6">
      <audio ref={audioRef} className="hidden" />

      <div className="space-y-4">
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
                  
                  if (gainNode) {
                    gainNode.gain.value = value[0] / 100
                  } else if (audioRef.current) {
                    audioRef.current.volume = Math.min(1.0, value[0] / 100)
                  }
                }}
                disabled={isConverting}
                className="dark:bg-gray-700"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div>
          <div className="flex justify-between mb-2">
            <Label>{t('settings.trim')}</Label>
            <div className="text-sm text-gray-500">
              {settings.trimStart.toFixed(1)}s - {settings.trimEnd.toFixed(1)}s ({t('waveform.dragHint')})
            </div>
          </div>

          <div className="relative">
            <canvas ref={canvasRef} className="w-full h-28 bg-gray-50 rounded-lg" width={600} height={120} />

            <div className="mt-4 space-y-4">
              <div className="w-full">
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-green-600">{settings.trimStart.toFixed(1)}s</Label>
                  <Label className="text-xs text-red-600">{settings.trimEnd.toFixed(1)}s</Label>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handlePreviewClip}
            disabled={isConverting}
          >
            {isPlaying ? (
              <>
                <span className="h-4 w-4 mr-2 flex items-center justify-center">■</span>
                {t('waveform.playing')}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {commonT('preview')}
              </>
            )}
          </Button>
        </div>

        {!downloadUrl ? (
          <div className="space-y-4">
            {isConverting ? (
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
            ) : (
              <Button 
                className="w-full bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 text-white" 
                size="lg"
                onClick={handleConvert}
              >
                {t('buttons.convert')}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center">
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                disabled={!downloadUrl} 
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                {commonT('download')}
              </Button>

              <Button
                variant="outline"
                disabled={!fileId}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/share/' + shareId);
                  toast({
                    title: t('status.linkCopied'),
                    description: t('status.shareExplanation')
                  });
                }}
                disabled={!shareId}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {commonT('share')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md border border-red-200 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {isConverting && (
        <div className="flex items-center justify-center mt-4">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>{t('status.converting')}...</span>
        </div>
      )}
    </div>
  )
} 
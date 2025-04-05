"use client"

import React, { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioWaveformProps {
  audioUrl: string
  trimStart: number
  trimEnd: number
  onTrimChange: (start: number, end: number) => void
  className?: string
  disabled?: boolean
}

export function AudioWaveform({
  audioUrl,
  trimStart,
  trimEnd,
  onTrimChange,
  className,
  disabled = false,
}: AudioWaveformProps) {
  const t = useTranslations('converter')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startMarkerRef = useRef<HTMLDivElement>(null)
  const endMarkerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const waveformDataRef = useRef<number[]>([])
  const playheadRef = useRef<HTMLDivElement>(null)
  
  const [audioDuration, setAudioDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [waveformLoaded, setWaveformLoaded] = useState(false)
  const [isDraggingStart, setIsDraggingStart] = useState(false)
  const [isDraggingEnd, setIsDraggingEnd] = useState(false)
  
  // 加载音频并生成波形
  useEffect(() => {
    if (!audioUrl) return
    
    const audioElement = audioRef.current
    if (!audioElement) return
    
    audioElement.src = audioUrl
    
    const handleCanPlay = () => {
      if (audioElement) {
        setAudioDuration(audioElement.duration)
        generateWaveform(audioElement)
      }
    }
    
    // 音频可以播放时加载波形
    audioElement.addEventListener('canplay', handleCanPlay)
    
    // 如果音频已加载，立即生成波形
    if (audioElement.readyState >= 2) {
      handleCanPlay()
    }
    
    return () => {
      audioElement.removeEventListener('canplay', handleCanPlay)
      
      // 清理播放动画
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [audioUrl])
  
  // 音频播放/暂停状态变化
  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement) return
    
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audioElement.currentTime = trimStart
    }
    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime)
      
      // 如果播放超出裁剪范围，暂停播放
      if (audioElement.currentTime > trimEnd) {
        audioElement.pause()
        audioElement.currentTime = trimEnd
        setIsPlaying(false)
      }
    }
    
    audioElement.addEventListener('play', handlePlay)
    audioElement.addEventListener('pause', handlePause)
    audioElement.addEventListener('ended', handleEnded)
    audioElement.addEventListener('timeupdate', handleTimeUpdate)
    
    return () => {
      audioElement.removeEventListener('play', handlePlay)
      audioElement.removeEventListener('pause', handlePause)
      audioElement.removeEventListener('ended', handleEnded)
      audioElement.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [trimStart, trimEnd])
  
  // 裁剪标记拖动处理
  useEffect(() => {
    if (!containerRef.current || !startMarkerRef.current || !endMarkerRef.current || !canvasRef.current) return
    
    const container = containerRef.current
    const startMarker = startMarkerRef.current
    const endMarker = endMarkerRef.current
    
    const containerWidth = container.clientWidth
    const startPosition = (trimStart / audioDuration) * containerWidth
    const endPosition = (trimEnd / audioDuration) * containerWidth - 10
    
    startMarker.style.left = `${startPosition}px`
    endMarker.style.left = `${endPosition}px`
    
    // 更新波形渲染
    drawWaveform()
  }, [trimStart, trimEnd, audioDuration, waveformLoaded])
  
  // 动画播放进度指示器
  useEffect(() => {
    if (!containerRef.current || !playheadRef.current) return
    
    if (isPlaying && playheadRef.current) {
      const container = containerRef.current
      const containerWidth = container.clientWidth
      const playheadPosition = (currentTime / audioDuration) * containerWidth
      playheadRef.current.style.left = `${playheadPosition}px`
      playheadRef.current.style.display = 'block'
    } else if (playheadRef.current) {
      playheadRef.current.style.display = 'none'
    }
    
    // 更新波形渲染
    const updatePlayhead = () => {
      if (playheadRef.current && isPlaying) {
        const container = containerRef.current
        if (container) {
          const containerWidth = container.clientWidth
          const playheadPosition = (currentTime / audioDuration) * containerWidth
          playheadRef.current.style.left = `${playheadPosition}px`
        }
        drawWaveform()
        animationRef.current = requestAnimationFrame(updatePlayhead)
      }
    }
    
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updatePlayhead)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, currentTime, audioDuration])
  
  // 生成波形数据
  const generateWaveform = async (audioElement: HTMLAudioElement) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const response = await fetch(audioUrl)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      const channelData = audioBuffer.getChannelData(0) // 使用第一个声道
      const samplesPerPixel = Math.floor(channelData.length / 200)
      const samples = []
      
      for (let i = 0; i < 200; i++) {
        const startIdx = i * samplesPerPixel
        const endIdx = startIdx + samplesPerPixel > channelData.length ? channelData.length : startIdx + samplesPerPixel
        
        let max = 0
        for (let j = startIdx; j < endIdx; j++) {
          const absolute = Math.abs(channelData[j])
          if (absolute > max) max = absolute
        }
        
        samples.push(max)
      }
      
      // 归一化波形数据，最大值为1
      const maxSample = Math.max(...samples)
      const normalizedSamples = samples.map(s => s / maxSample)
      
      waveformDataRef.current = normalizedSamples
      setWaveformLoaded(true)
      drawWaveform()
    } catch (error) {
      console.error("Error generating waveform:", error)
    }
  }
  
  // 绘制波形
  const drawWaveform = () => {
    const canvas = canvasRef.current
    if (!canvas || !waveformDataRef.current.length) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const dpr = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    
    // 设置canvas大小以匹配显示尺寸，考虑设备像素比
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    
    // 清除画布
    ctx.clearRect(0, 0, width, height)
    
    const samples = waveformDataRef.current
    const barWidth = width / samples.length
    const barSpacing = 0.3 // 柱状图间距
    const actualBarWidth = barWidth - barSpacing
    
    // 计算裁剪区域的索引
    const trimStartIdx = Math.floor((trimStart / audioDuration) * samples.length)
    const trimEndIdx = Math.floor((trimEnd / audioDuration) * samples.length)
    const currentTimeIdx = Math.floor((currentTime / audioDuration) * samples.length)
    
    // 绘制波形
    samples.forEach((sample, i) => {
      const x = i * barWidth
      const barHeight = sample * (height * 0.7) // 使用画布高度的70%
      const y = (height - barHeight) / 2
      
      // 确定颜色：播放指示器前绿色，裁剪区域内蓝色，裁剪区域外灰色
      if (i >= trimStartIdx && i <= trimEndIdx) {
        if (isPlaying && i <= currentTimeIdx) {
          // 已播放区域
          ctx.fillStyle = '#10B981' // 绿色
        } else {
          // 选中区域
          ctx.fillStyle = '#3B82F6' // 蓝色
        }
      } else {
        // 未选中区域
        ctx.fillStyle = '#94A3B8' // 灰色
      }
      
      ctx.fillRect(x, y, actualBarWidth, barHeight)
    })
  }
  
  // 处理播放/暂停
  const togglePlayback = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      // 从裁剪起点开始播放
      audioRef.current.currentTime = trimStart
      audioRef.current.play()
    }
  }
  
  // 处理从波形点击定位播放
  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return
    
    const canvas = canvasRef.current
    if (!canvas || !audioRef.current) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = (x / rect.width) * audioDuration
    
    // 仅在裁剪区域内响应点击
    if (time >= trimStart && time <= trimEnd) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
      
      if (!isPlaying) {
        audioRef.current.play()
      }
    }
  }
  
  // 开始拖动裁剪标记
  const startDragging = (marker: 'start' | 'end') => (e: React.MouseEvent) => {
    if (disabled) return
    
    e.preventDefault()
    if (marker === 'start') {
      setIsDraggingStart(true)
    } else {
      setIsDraggingEnd(true)
    }
  }
  
  // 处理鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || (!isDraggingStart && !isDraggingEnd)) return
    
    const container = containerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const time = (x / rect.width) * audioDuration
    
    if (isDraggingStart) {
      // 确保起点不超过终点-1秒
      const newStart = Math.min(time, trimEnd - 1)
      onTrimChange(newStart, trimEnd)
    } else if (isDraggingEnd) {
      // 确保终点不小于起点+1秒
      const newEnd = Math.max(time, trimStart + 1)
      onTrimChange(trimStart, newEnd)
    }
  }
  
  // 结束拖动
  const stopDragging = () => {
    setIsDraggingStart(false)
    setIsDraggingEnd(false)
  }
  
  // 在组件卸载时停止拖动
  useEffect(() => {
    return () => {
      stopDragging()
    }
  }, [])
  
  return (
    <div className={cn("space-y-2", className)}>
      <div 
        ref={containerRef} 
        className={cn(
          "relative h-40 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        style={{ isolation: 'isolate' }}
      >
        {/* 画布放在DOM结构最前面，确保它在元素层叠顺序最下方 */}
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-pointer"
          onClick={handleWaveformClick}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 5 }}
        />
        
        {/* 开始裁剪标记 */}
        <div 
          ref={startMarkerRef}
          className={cn(
            "absolute top-0 h-full w-3 bg-green-600 cursor-col-resize",
            isDraggingStart && "opacity-90",
            disabled && "cursor-not-allowed"
          )}
          onMouseDown={startDragging('start')}
          style={{ position: 'absolute', left: 0, zIndex: 999999 }}
        >
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border-2 border-green-600 shadow-md" />
        </div>
        
        {/* 结束裁剪标记 - 提高z-index确保最上层 */}
        <div 
          ref={endMarkerRef}
          className={cn(
            "absolute top-0 h-full w-3 bg-red-600 cursor-col-resize",
            isDraggingEnd && "opacity-90",
            disabled && "cursor-not-allowed"
          )}
          onMouseDown={startDragging('end')}
          style={{ position: 'absolute', zIndex: 999999 }}
        >
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border-2 border-red-600 shadow-md" />
        </div>
        
        {/* 播放指示器 - 放在裁剪标记之间的层级 */}
        <div 
          ref={playheadRef}
          className="absolute top-0 h-full w-1 bg-yellow-500 opacity-90"
          style={{ display: 'none', left: 0, position: 'absolute', zIndex: 99999 }}
        />
      </div>
      
      {/* 播放控制和时间显示 */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={togglePlayback}
          disabled={disabled || !waveformLoaded}
          className="flex items-center gap-1"
        >
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              <span>{t('waveform.pause')}</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>{t('waveform.play')}</span>
            </>
          )}
        </Button>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </div>
      </div>
      
      <audio ref={audioRef} className="hidden" />
    </div>
  ) 
}

// 格式化时间为 mm:ss 格式
function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '00:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default AudioWaveform 
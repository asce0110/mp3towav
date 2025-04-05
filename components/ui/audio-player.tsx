"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export function AudioPlayer({ src, className, onPlay, onPause, onEnded }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<number | null>(null);
  
  useEffect(() => {
    // 重置状态
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoaded(false);
    
    // 停止任何活动的动画帧回调
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    // 设置事件监听器
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      if (audio) {
        setDuration(audio.duration);
        setIsLoaded(true);
      }
    };
    
    const handleTimeUpdate = () => {
      if (audio) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      if (audio) {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      }
      
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [src, onEnded]);
  
  // 更新音量
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.volume = volume / 100;
    audio.muted = isMuted;
  }, [volume, isMuted]);
  
  // 播放/暂停控制
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (onPause) onPause();
    } else {
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            if (onPlay) onPlay();
            
            // 使用requestAnimationFrame更平滑地更新当前时间
            const updateTime = () => {
              if (audio) {
                setCurrentTime(audio.currentTime);
              }
              requestRef.current = requestAnimationFrame(updateTime);
            };
            
            // 启动动画帧更新
            updateTime();
          })
          .catch(error => {
            console.error('播放出错:', error);
          });
      }
    }
  };
  
  // 处理进度条变化
  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;
    
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  // 处理音量变化
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };
  
  // 切换静音
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      <audio 
        ref={audioRef} 
        src={src} 
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true);
          if (onPlay) onPlay();
        }}
        onPause={() => {
          setIsPlaying(false);
          if (onPause) onPause();
        }}
      />
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!isLoaded}
          onClick={togglePlayPause}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs tabular-nums">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            disabled={!isLoaded}
            onValueChange={handleProgressChange}
            className="flex-1"
          />
          <span className="text-xs tabular-nums">{formatTime(duration)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
} 
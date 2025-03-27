"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Home, Download, Play, Pause, Volume2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Slider } from "@/components/ui/slider"
import { SiteHeader } from "@/components/site-header"

export default function DownloadPage() {
  const router = useRouter()
  const params = useParams()
  
  const [isLoading, setIsLoading] = useState(true)
  const [fileName, setFileName] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(100)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isAudioReady, setIsAudioReady] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)

  // Fetch download data on page load
  useEffect(() => {
    async function fetchDownloadData() {
      try {
        const id = params.id as string
        
        // In a real scenario, this would be an API call to get the download data
        // For this example, we're retrieving it from sessionStorage
        const storedData = sessionStorage.getItem(`download_${id}`)
        
        if (!storedData) {
          toast({
            title: "File not found",
            description: "The requested file could not be found.",
            variant: "destructive",
          })
          router.push('/')
          return
        }
        
        const downloadData = JSON.parse(storedData)
        setFileName(downloadData.fileName)
        setDownloadUrl(downloadData.url)
        
        // 创建新的audio元素，避免React引用问题
        const audio = new Audio(downloadData.url)
        
        // 设置多个事件检测音频是否可以播放
        const audioEvents = ['loadeddata', 'canplay', 'canplaythrough']
        
        // 任何一个事件被触发都标记音频为可播放
        const handleAudioReady = () => {
          console.log("Audio is ready to play")
          setIsAudioReady(true)
          setDuration(audio.duration)
          
          // 清理所有事件监听器
          audioEvents.forEach(event => {
            audio.removeEventListener(event, handleAudioReady)
          })
        }
        
        // 添加错误处理
        const handleError = (e: ErrorEvent) => {
          console.error("Error loading audio:", e)
          toast({
            title: "Error loading audio",
            description: "Could not load the audio file. Please try again.",
            variant: "destructive",
          })
        }
        
        // 为每个事件添加监听器
        audioEvents.forEach(event => {
          audio.addEventListener(event, handleAudioReady, { once: true })
        })
        
        audio.addEventListener('error', handleError)
        
        // 设置当前组件的audio ref
        if (audioRef.current) {
          audioRef.current.src = downloadData.url
          audioRef.current.load()
        }
        
        // 30秒后如果还没准备好，强制设置为可用
        const forceReadyTimeout = setTimeout(() => {
          if (!isAudioReady) {
            console.log("Forcing audio ready state after timeout")
            setIsAudioReady(true)
            
            if (audioRef.current && audioRef.current.duration) {
              setDuration(audioRef.current.duration || 0)
            }
          }
        }, 3000)
        
        setIsLoading(false)
        
        // 清理函数
        return () => {
          clearTimeout(forceReadyTimeout)
          audioEvents.forEach(event => {
            audio.removeEventListener(event, handleAudioReady)
          })
          audio.removeEventListener('error', handleError)
        }
      } catch (error) {
        console.error("Error fetching download data:", error)
        toast({
          title: "Error",
          description: "Failed to load download information. Please try again.",
          variant: "destructive",
        })
        router.push('/')
      }
    }
    
    fetchDownloadData()
  }, [params.id, router, isAudioReady])
  
  // Setup audio playback
  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [audioContext])
  
  // Handle time update event - 修改为一个更一致的方式来处理事件
  useEffect(() => {
    // 如果没有audio ref，不做任何事
    if (!audioRef.current) return;
    
    console.log("设置音频事件监听");
    
    // 所有事件处理函数
    const handlers = {
      // 播放位置更新
      timeupdate: () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      },
      
      // 元数据加载完成（获取时长等信息）
      loadedmetadata: () => {
        if (audioRef.current) {
          console.log("元数据加载完成，时长:", audioRef.current.duration);
          if (isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
          setIsAudioReady(true);
        }
      },
      
      // 可以播放时
      canplay: () => {
        console.log("音频可以开始播放了");
        setIsAudioReady(true);
        
        // 确保时长已设置
        if (audioRef.current && duration === 0 && isFinite(audioRef.current.duration)) {
          setDuration(audioRef.current.duration);
        }
      },
      
      // 播放结束时
      ended: () => {
        console.log("音频播放结束");
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      },
      
      // 播放暂停时
      pause: () => {
        console.log("音频已暂停");
        setIsPlaying(false);
      },
      
      // 播放开始时
      play: () => {
        console.log("音频开始播放");
        setIsPlaying(true);
      },
      
      // 错误发生时
      error: (e: Event) => {
        console.error("音频加载错误", e);
        toast({
          title: "音频加载错误",
          description: "无法加载音频文件，请返回重试。",
          variant: "destructive",
        });
      }
    };
    
    // 注册所有事件监听器
    Object.entries(handlers).forEach(([event, handler]) => {
      audioRef.current?.addEventListener(event, handler);
    });
    
    // 清理函数移除所有事件监听器
    return () => {
      if (audioRef.current) {
        Object.entries(handlers).forEach(([event, handler]) => {
          audioRef.current?.removeEventListener(event, handler);
        });
      }
    };
  }, [audioRef.current, duration]); // 依赖数组
  
  // 修改添加额外的定时器来更新进度条
  useEffect(() => {
    // 如果正在播放，使用定时器更新进度条
    let progressInterval: NodeJS.Timeout | null = null;
    
    if (isPlaying && audioRef.current) {
      progressInterval = setInterval(() => {
        if (audioRef.current) {
          try {
            const currentTimeValue = audioRef.current.currentTime;
            
            // 检测是否到达音频结尾
            if (currentTimeValue >= (audioRef.current.duration - 0.5)) {
              setIsPlaying(false);
              setCurrentTime(0);
              audioRef.current.currentTime = 0;
              console.log("播放结束，重置播放器");
            } else {
              setCurrentTime(currentTimeValue);
              
              // 监测是否已卡住（当前时间没有变化）
              if (Math.abs(currentTime - currentTimeValue) < 0.01 && currentTimeValue > 0) {
                console.log("检测到播放可能卡住，尝试恢复");
                // 尝试轻微调整时间以恢复播放
                const newTime = currentTimeValue + 0.1;
                if (newTime < audioRef.current.duration) {
                  audioRef.current.currentTime = newTime;
                }
              }
            }
          } catch (error) {
            console.error("更新进度条时出错:", error);
          }
        }
      }, 250); // 更频繁地更新，每250毫秒一次
      
      console.log("启动进度更新定时器");
    }
    
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        console.log("停止进度更新定时器");
      }
    };
  }, [isPlaying, currentTime]);
  
  // 初始化播放器 - 在组件挂载时预先准备播放器
  useEffect(() => {
    if (downloadUrl && audioRef.current && !audioContext) {
      // 预先加载音频
      audioRef.current.src = downloadUrl;
      audioRef.current.load();
      
      // 预先创建音频上下文但不连接
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        console.log("预先创建音频上下文");
      } catch (error) {
        console.error("预先创建音频上下文失败:", error);
      }
    }
  }, [downloadUrl, audioContext]);
  
  // 增强版播放切换函数
  const togglePlayback = () => {
    if (!audioRef.current || !isAudioReady) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // 检查是否已播放结束
        if (audioRef.current.currentTime >= (audioRef.current.duration - 0.1)) {
          audioRef.current.currentTime = 0;
        }
        
        // 确保音量正确设置
        audioRef.current.volume = volume / 100;
        
        // 使用Promise处理播放可能的错误
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("播放开始");
              setIsPlaying(true);
            })
            .catch(error => {
              console.error("播放失败:", error);
              
              // 尝试恢复播放
              setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.play()
                    .then(() => {
                      console.log("第二次尝试播放成功");
                      setIsPlaying(true);
                    })
                    .catch(secondError => {
                      console.error("第二次播放尝试也失败:", secondError);
                      toast({
                        title: "Playback error",
                        description: "Could not play audio. Please try again.",
                        variant: "destructive",
                      });
                    });
                }
              }, 300);
            });
        }
      }
    } catch (error) {
      console.error("播放控制错误:", error);
      toast({
        title: "Playback error",
        description: "Could not control audio playback. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }
  
  // 修改处理seek的函数以更好地处理完整播放
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    
    try {
      const newTime = parseFloat(e.target.value);
      if (isFinite(newTime)) {
        // 设置新的播放位置
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        
        // 如果已播放到结尾附近且尝试拖动到其他位置，检查是否需要恢复播放
        const wasNearEnd = isPlaying === false && 
                          currentTime > 0 && 
                          audioRef.current.duration > 0 && 
                          (currentTime >= audioRef.current.duration - 1);
        
        if (wasNearEnd && newTime < audioRef.current.duration - 1) {
          console.log("从接近结尾处拖动回来，尝试恢复播放");
          // 尝试自动恢复播放
          setTimeout(() => {
            if (audioRef.current && !isPlaying) {
              audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(err => console.error("恢复播放失败:", err));
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error("调整播放位置时出错:", error);
    }
  };
  
  // 添加点击进度条位置跳转功能
  const handleClickTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    try {
      const trackRect = e.currentTarget.getBoundingClientRect();
      const clickPosition = (e.clientX - trackRect.left) / trackRect.width;
      const newTime = clickPosition * (duration || 100);
      
      if (isFinite(newTime)) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        console.log("点击进度条跳转到:", newTime);
      }
    } catch (error) {
      console.error("点击进度条跳转出错:", error);
    }
  };
  
  // Format time in MM:SS
  const formatTime = (time: number) => {
    if (!isFinite(time)) return "00:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  // Handle download
  const handleDownload = () => {
    if (!downloadUrl) return
    
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = fileName.replace(/\.mp3$/i, '.wav')
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    
    toast({
      title: "Download started",
      description: "Your WAV file is being downloaded.",
    })
  }
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="container max-w-4xl mx-auto px-4 py-12">
          <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg">
            <CardHeader className="bg-[#2A6FDB] text-white">
              <CardTitle className="text-2xl font-bold text-center">
                Download Your WAV File
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <Loader2 className="h-12 w-12 animate-spin text-[#2A6FDB] mb-4" />
                  <h2 className="text-xl font-semibold">Loading your file...</h2>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col items-center">
                    <h2 className="text-xl font-medium mb-2">{fileName.replace(/\.mp3$/i, '.wav')}</h2>
                    <p className="text-gray-500 text-sm mb-6">Your MP3 has been successfully converted to WAV</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium mb-4">Listen to Your Converted File</h3>
                    
                    <audio 
                      ref={audioRef} 
                      className="hidden" 
                      preload="auto"
                      controlsList="nodownload nofullscreen noremoteplayback"
                    />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-4">
                        <Button 
                          className={`h-12 w-12 rounded-full flex items-center justify-center ${!isAudioReady ? 'opacity-70' : ''}`}
                          onClick={togglePlayback}
                          disabled={isLoading}
                        >
                          {isPlaying ? (
                            <Pause className="h-6 w-6" />
                          ) : (
                            !isAudioReady ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-6 w-6" />
                          )}
                        </Button>
                        
                        {!isAudioReady && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setIsAudioReady(true)}
                          >
                            Force Enable Player
                          </Button>
                        )}
                      </div>
                      
                      {!isAudioReady && (
                        <p className="text-xs text-center text-gray-500">
                          Preparing audio playback... If it takes too long, click "Force Enable Player".
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-12 text-right">
                          {formatTime(currentTime)}
                        </span>
                        <div 
                          className="relative w-full h-2 bg-gray-200 rounded-lg cursor-pointer"
                          onClick={handleClickTrack}
                        >
                          {/* 进度条已播放部分 */}
                          <div 
                            className="absolute top-0 left-0 h-full bg-[#2A6FDB] rounded-lg" 
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                          />
                          <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        <span className="text-sm text-gray-500 w-12">
                          {formatTime(duration)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-gray-500" />
                        <Slider
                          min={0}
                          max={200}
                          step={1}
                          value={[volume]}
                          onValueChange={handleVolumeChange}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4 justify-center">
                    <Button 
                      className="flex-1 bg-[#2A6FDB] hover:bg-[#2A6FDB]/90"
                      onClick={handleDownload}
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Download WAV File
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push('/')}
                    >
                      <Home className="h-5 w-5 mr-2" />
                      Return to Converter
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
} 
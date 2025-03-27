"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Home, Download, Play, Pause, Volume2, AlertTriangle, ExternalLink } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Slider } from "@/components/ui/slider"
import { SiteHeader } from "@/components/site-header"

export default function DownloadPage() {
  const router = useRouter()
  const params = useParams()
  
  const [isLoading, setIsLoading] = useState(true)
  const [fileName, setFileName] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")
  const [audioError, setAudioError] = useState(false)
  const [showAlternativePlayer, setShowAlternativePlayer] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
        setIsLoading(false)
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
  }, [params.id, router])
  
  // Handle audio element errors
  useEffect(() => {
    if (!audioRef.current) return
    
    const handleError = (e: Event) => {
      console.error("Audio playback error:", e)
      setAudioError(true)
      toast({
        title: "Audio playback issue",
        description: "There was a problem playing this audio. Try downloading the file instead.",
        variant: "destructive",
      })
    }
    
    const handleCanPlay = () => {
      console.log("Audio can play")
      setAudioError(false)
    }
    
    // 自动监测播放停止
    let lastTimeUpdate = 0
    let stuckTimer: NodeJS.Timeout | null = null
    
    const handleTimeUpdate = () => {
      if (!audioRef.current) return
      
      // 清除之前的计时器
      if (stuckTimer) {
        clearTimeout(stuckTimer)
        stuckTimer = null
      }
      
      const currentTime = audioRef.current.currentTime
      
      // 如果播放卡住（时间不再更新）
      if (Math.abs(currentTime - lastTimeUpdate) < 0.1 && !audioRef.current.paused) {
        // 3秒后检查是否仍然卡住
        stuckTimer = setTimeout(() => {
          if (!audioRef.current) return
          
          // 如果仍然是同一时间点，且播放器不是暂停状态
          if (Math.abs(audioRef.current.currentTime - lastTimeUpdate) < 0.1 && !audioRef.current.paused) {
            console.log("播放卡住了，当前时间：", currentTime)
            setAudioError(true)
          }
        }, 3000)
      }
      
      lastTimeUpdate = currentTime
    }
    
    audioRef.current.addEventListener('error', handleError)
    audioRef.current.addEventListener('canplay', handleCanPlay)
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate)
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('error', handleError)
        audioRef.current.removeEventListener('canplay', handleCanPlay)
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate)
      }
      
      if (stuckTimer) {
        clearTimeout(stuckTimer)
      }
    }
  }, [downloadUrl])
  
  // 使用备用播放器
  const handleUseAlternativePlayer = () => {
    setShowAlternativePlayer(true)
    toast({
      title: "Alternative player activated",
      description: "Using an alternative method to play your audio."
    })
  }
  
  // 在新窗口打开音频
  const handleOpenInNewWindow = () => {
    if (!downloadUrl) return
    window.open(downloadUrl, '_blank')
  }
  
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
  
  // Attempt to refresh audio playback
  const handleRefreshAudio = () => {
    if (!audioRef.current || !downloadUrl) return
    
    // Reset error state
    setAudioError(false)
    
    // Force reload the audio element
    const currentTime = audioRef.current.currentTime
    audioRef.current.load()
    
    // Set the current time back to where it was
    audioRef.current.oncanplay = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = currentTime
        audioRef.current.play().catch(err => {
          console.error("Failed to restart playback:", err)
        })
      }
    }
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
                    
                    <div className="w-full flex flex-col items-center">
                      {showAlternativePlayer ? (
                        <>
                          <div className="w-full max-w-md my-4 border border-gray-200 rounded-md overflow-hidden">
                            <iframe 
                              ref={iframeRef}
                              src={downloadUrl}
                              className="w-full h-[150px]"
                              allow="autoplay"
                              title="Audio Preview"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mb-2">
                            Using alternative player for better compatibility
                          </p>
                        </>
                      ) : (
                        <audio 
                          ref={audioRef}
                          src={downloadUrl}
                          controls
                          controlsList="nodownload"
                          className="w-full max-w-md my-4"
                          preload="auto"
                          crossOrigin="anonymous"
                        />
                      )}
                      
                      {audioError && (
                        <div className="flex flex-col items-center my-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                          <div className="flex items-center gap-2 text-amber-600 mb-2">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-medium">Playback Issue Detected</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            The audio player is having trouble with this file. You can try these options:
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            <Button variant="outline" size="sm" onClick={handleRefreshAudio}>
                              <Play className="h-4 w-4 mr-1" /> Retry Playback
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleUseAlternativePlayer}>
                              <Volume2 className="h-4 w-4 mr-1" /> Use Alt Player
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleOpenInNewWindow}>
                              <ExternalLink className="h-4 w-4 mr-1" /> Open in Browser
                            </Button>
                            <Button variant="default" size="sm" onClick={handleDownload}>
                              <Download className="h-4 w-4 mr-1" /> Download Instead
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        For the best experience, we recommend downloading the file to your device.
                      </p>
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
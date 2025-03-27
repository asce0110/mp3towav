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
  const [showNativeControls, setShowNativeControls] = useState(false)

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
  
  // Handle switching to native controls
  const handleSwitchToNativeControls = () => {
    setShowNativeControls(true)
    toast({
      title: "Native audio player enabled",
      description: "Using browser's built-in audio player for better compatibility."
    })
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
                    
                    {showNativeControls ? (
                      <div className="w-full flex flex-col items-center">
                        <audio 
                          src={downloadUrl}
                          controls
                          controlsList="nodownload"
                          className="w-full max-w-md my-4"
                          preload="auto"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Using browser's native audio player for better compatibility
                        </p>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center">
                        <audio 
                          src={downloadUrl}
                          controlsList="nodownload"
                          className="hidden"
                        />
                        <Button 
                          variant="default" 
                          className="bg-[#2A6FDB] mb-4" 
                          onClick={handleSwitchToNativeControls}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Play Audio
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          If you experience playback issues, click the button above to use browser's built-in player
                        </p>
                      </div>
                    )}
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
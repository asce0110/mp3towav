"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Home, Download, FileAudio, CheckCircle, Share2, ExternalLink } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { SiteHeader } from "@/components/site-header"

export default function DownloadPage() {
  const router = useRouter()
  const params = useParams()
  
  const [isLoading, setIsLoading] = useState(true)
  const [fileName, setFileName] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")
  const [shareId, setShareId] = useState("")
  const [fileId, setFileId] = useState("")
  const [downloadStarted, setDownloadStarted] = useState(false)
  
  // Fetch download data on page load
  useEffect(() => {
    async function fetchDownloadData() {
      try {
        const id = params.id as string
        
        // Retrieve data from sessionStorage
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
        setShareId(downloadData.shareId || "")
        setFileId(downloadData.fileId || id)
        console.log('从sessionStorage加载下载数据:', downloadData)
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
  
  // Get file size in MB (approximate)
  const getFileSize = () => {
    // WAV files are typically 10x larger than MP3
    // This is a rough estimation
    return "High quality uncompressed audio";
  }
  
  // Format the file name for display
  const getFormattedFileName = () => {
    return fileName.replace(/\.mp3$/i, '.wav')
  }
  
  // Handle download
  const handleDownload = () => {
    if (!downloadUrl) return
    
    try {
      const downloadLink = document.createElement('a')
      downloadLink.href = downloadUrl
      downloadLink.download = getFormattedFileName()
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      
      setDownloadStarted(true)
      
      toast({
        title: "Download started",
        description: "Your WAV file is being downloaded.",
      })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Download failed",
        description: "Could not download the file. Please try again.",
        variant: "destructive"
      })
    }
  }
  
  // Handle sharing
  const handleShare = () => {
    if (!shareId) return
    
    // Create share URL
    const shareUrl = `${window.location.origin}/share/${shareId}`
    
    // Try to use Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: 'MP3 to WAV Converter - Shared File',
        text: `Check out this WAV file I converted: ${getFormattedFileName()}`,
        url: shareUrl
      }).catch(err => {
        console.error('Share failed:', err)
        // Fallback to copy to clipboard and redirect
        copyToClipboardAndRedirect(shareUrl)
      })
    } else {
      // Fallback to copy to clipboard and redirect
      copyToClipboardAndRedirect(shareUrl)
    }
  }
  
  // Copy to clipboard helper and redirect to share page
  const copyToClipboardAndRedirect = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Share link copied",
        description: "Share link has been copied to your clipboard. Redirecting to share page..."
      })
      
      // 使用setTimeout确保toast消息能够显示
      setTimeout(() => {
        // 创建一个包含分享链接的URL参数
        const redirectUrl = `/share?url=${encodeURIComponent(text)}`
        router.push(redirectUrl)
      }, 1000)
    }).catch(err => {
      console.error('Copy failed:', err)
      toast({
        title: "Copy failed",
        description: "Could not copy the share link to clipboard.",
        variant: "destructive"
      })
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
                Conversion Complete
              </CardTitle>
              <CardDescription className="text-center text-gray-100">
                Your WAV file is ready to download
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <Loader2 className="h-12 w-12 animate-spin text-[#2A6FDB] mb-4" />
                  <h2 className="text-xl font-semibold">Preparing your download...</h2>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="h-10 w-10 text-green-500" />
                    </div>
                    <h2 className="text-xl font-medium mb-1">{getFormattedFileName()}</h2>
                    <p className="text-gray-500 text-sm">{getFileSize()}</p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <FileAudio className="h-6 w-6 text-blue-500 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="font-medium text-blue-700 mb-1">About WAV Format</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          WAV files provide lossless audio quality, making them perfect for:
                        </p>
                        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                          <li>Professional audio editing</li>
                          <li>Music production and mastering</li>
                          <li>High-fidelity sound reproduction</li>
                          <li>Archiving audio in uncompressed format</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <Button 
                      className="w-full bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 py-6"
                      onClick={handleDownload}
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Download WAV File
                    </Button>
                    
                    {downloadStarted && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-medium mb-2">What's Next?</h3>
                        <div className="flex gap-4 flex-wrap">
                          {shareId && (
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={handleShare}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share This File
                            </Button>
                          )}
                          
                          <Button 
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.push('/')}
                          >
                            <Home className="h-4 w-4 mr-2" />
                            Convert Another File
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => window.open('https://mp3towav.net', '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            More Audio Tools
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {!downloadStarted && (
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          // 将转换状态信息存储到会话存储中
                          try {
                            console.log('尝试保存转换状态:', { downloadId: params.id, fileId, downloadUrl, fileName });
                            
                            // 从sessionStorage获取原始downloadData，提取更多信息
                            const storedData = sessionStorage.getItem(`download_${params.id}`);
                            if (storedData) {
                              const downloadData = JSON.parse(storedData);
                              
                              // 估算文件大小 - WAV文件通常比MP3大约大10倍
                              // 这里我们使用一个合理的默认大小
                              const estimatedSize = 20 * 1024 * 1024; // 20MB
                              
                              // 存储转换完成的状态信息 - 使用下载数据中的fileId或者当前fileId
                              sessionStorage.setItem('converterState', JSON.stringify({
                                fileId: fileId || params.id, // 优先使用fileId
                                downloadUrl,
                                fileName,
                                fileSize: estimatedSize,
                                audioDuration: 180, // 默认音频长度为3分钟
                                keepState: true
                              }));
                              
                              console.log('成功保存转换状态用于返回:', { 
                                fileId: fileId || params.id, 
                                downloadUrl,
                                fileName,
                                fileSize: estimatedSize 
                              });
                            } else {
                              console.error('无法找到原始下载数据');
                            }
                          } catch (error) {
                            console.error('保存转换状态失败:', error);
                          }
                          
                          // 返回到转换器页面
                          router.push('/');
                        }}
                      >
                        <Home className="h-5 w-5 mr-2" />
                        Return to Converter
                      </Button>
                    )}
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
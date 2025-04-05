"use client"

import { Download } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface DownloadButtonProps {
  fileId: string
  downloadUrl: string
  originalName?: string | null
}

export function DownloadButton({
  fileId,
  downloadUrl,
  originalName,
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      console.log(`[下载] 开始下载文件: fileId=${fileId}`)
      
      // 生成请求ID用于跟踪
      const requestId = `download-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      
      // 构建下载URL (包含原始文件名，以便浏览器使用正确的文件名保存)
      const filename = originalName || `${fileId}.wav`
      let url = downloadUrl
      
      // 确保URL包含fileId
      if (!url.includes('fileId=')) {
        const separator = url.includes('?') ? '&' : '?'
        url += `${separator}fileId=${fileId}`
      }
      
      // 添加文件名参数
      url += `&filename=${encodeURIComponent(filename)}`
      
      // 添加请求ID和时间戳防止缓存
      url += `&_=${Date.now()}&requestId=${requestId}`
      
      console.log(`[下载] 下载URL: ${url}`)
      
      // 创建一个隐藏的a标签并触发下载
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      
      // 下载开始后移除元素
      setTimeout(() => {
        document.body.removeChild(a)
        console.log(`[下载] 下载已启动: fileId=${fileId}`)
        setIsDownloading(false)
      }, 100)
    } catch (error) {
      console.error('[下载] 下载错误:', error)
      setIsDownloading(false)
    }
  }

  return (
    <Button 
      className="w-full bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 text-white" 
      size="lg" 
      onClick={handleDownload}
      disabled={isDownloading}
    >
      <Download className="h-5 w-5 mr-2" />
      {isDownloading ? "准备下载..." : "下载WAV文件"}
    </Button>
  )
} 
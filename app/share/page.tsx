"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Mail, 
  Copy, 
  Share2, 
  FileAudio, 
  CheckCircle,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { SiteHeader } from '@/components/site-header'

export default function SharePage() {
  const router = useRouter()
  const [shareUrl, setShareUrl] = useState('')
  const [isValidUrl, setIsValidUrl] = useState(false)
  
  // 验证用户输入的URL是否是有效的分享链接
  const validateShareUrl = (url: string) => {
    const sharePattern = /^https?:\/\/mp3towav\.net\/share\/[a-zA-Z0-9_-]+$/
    const isValid = sharePattern.test(url)
    setIsValidUrl(isValid)
    return isValid
  }
  
  // 处理用户输入分享链接
  const handleShareUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setShareUrl(url)
    validateShareUrl(url)
  }
  
  // 打开分享链接
  const openShareLink = () => {
    if (isValidUrl) {
      router.push(shareUrl)
    } else {
      toast({
        title: "Invalid share URL",
        description: "Please enter a valid mp3towav.net share URL",
        variant: "destructive"
      })
    }
  }
  
  // 分享到社交媒体
  const shareToSocial = (platform: string) => {
    // 示例分享文本
    const shareText = "Convert MP3 to WAV with this free online tool!"
    const shareLink = "https://mp3towav.net"
    
    let shareUrl = ''
    
    switch(platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareLink)}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}`
        break
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent("MP3 to WAV Converter")}&body=${encodeURIComponent(`${shareText} ${shareLink}`)}`
        break
      default:
        return
    }
    
    window.open(shareUrl, '_blank')
  }
  
  // 复制网站链接到剪贴板
  const copyWebsiteLink = () => {
    navigator.clipboard.writeText("https://mp3towav.net").then(() => {
      toast({
        title: "Link copied!",
        description: "Website link copied to clipboard"
      })
    }).catch(err => {
      console.error('Failed to copy: ', err)
      toast({
        title: "Copy failed",
        description: "Could not copy link to clipboard",
        variant: "destructive"
      })
    })
  }
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center">
        <div className="container max-w-5xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">Share Your Converted Audio</h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
            Access shared WAV files or share your own conversions with friends, colleagues, or across your devices.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="h-5 w-5 mr-2 text-blue-500" />
                  Access Shared Files
                </CardTitle>
                <CardDescription>
                  Enter a share link to access a WAV file shared with you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="https://mp3towav.net/share/abc123" 
                    value={shareUrl}
                    onChange={handleShareUrlChange}
                    className={isValidUrl ? "border-green-500" : ""}
                  />
                  <Button 
                    onClick={openShareLink}
                    disabled={!isValidUrl}
                  >
                    Go
                  </Button>
                </div>
                {isValidUrl && (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Valid share link
                  </div>
                )}
              </CardContent>
              <CardFooter className="text-sm text-gray-500">
                Shared files are available for 24 hours after creation
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Share2 className="h-5 w-5 mr-2 text-blue-500" />
                  Share This Service
                </CardTitle>
                <CardDescription>
                  Share our MP3 to WAV converter with others
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm">
                  Help others convert their MP3 files to high-quality WAV format by sharing our service:
                </p>
                <div className="flex justify-center gap-3 mb-4">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full"
                    onClick={() => shareToSocial('facebook')}
                  >
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full"
                    onClick={() => shareToSocial('twitter')}
                  >
                    <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full"
                    onClick={() => shareToSocial('linkedin')}
                  >
                    <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full"
                    onClick={() => shareToSocial('email')}
                  >
                    <Mail className="h-5 w-5 text-gray-600" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full"
                    onClick={copyWebsiteLink}
                  >
                    <Copy className="h-5 w-5 text-gray-600" />
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/">
                    Try MP3 to WAV Converter
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <FileAudio className="h-5 w-5 mr-2 text-blue-500" />
              How File Sharing Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-300">1</span>
                </div>
                <h3 className="font-medium mb-2">Convert Your MP3</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload and convert your MP3 file to WAV format using our converter
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-300">2</span>
                </div>
                <h3 className="font-medium mb-2">Generate Share Link</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  After conversion, click the "Share" button to generate a unique share link
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-300">3</span>
                </div>
                <h3 className="font-medium mb-2">Share & Access</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Share the link with others or use it to access your converted file on any device
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
} 
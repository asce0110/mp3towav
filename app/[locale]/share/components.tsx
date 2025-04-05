'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Download, 
  Link2, 
  ArrowLeft,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  Copy,
  Share2,
  FileAudio,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { toast } from '@/components/ui/use-toast'

export function SharePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('share')
  const commonT = useTranslations('common')
  
  const [shareUrl, setShareUrl] = useState('')

  // 从URL参数中读取分享链接
  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (urlParam) {
      setShareUrl(decodeURIComponent(urlParam))
    }
  }, [searchParams])

  const handleShareUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShareUrl(e.target.value)
  }

  const handleAccessShare = () => {
    if (!shareUrl.trim()) {
      toast({
        title: "Empty URL",
        description: "Please enter a share URL",
        variant: "destructive"
      })
      return
    }
    
    try {
      // Extract share ID from URL if it's a full URL
      if (shareUrl.includes('/')) {
        const urlParts = shareUrl.split('/')
        const shareId = urlParts[urlParts.length - 1]
        router.push(`/share/${shareId}`)
      } else {
        // Assume it's just the ID
        router.push(`/share/${shareUrl.trim()}`)
      }
    } catch (error) {
      console.error('Error accessing share:', error)
      toast({
        title: "Invalid URL",
        description: "Please enter a valid share URL",
        variant: "destructive"
      })
    }
  }

  const copyWebsiteLink = () => {
    navigator.clipboard.writeText(window.location.origin)
    toast({
      title: "Link Copied!",
      description: "Website link has been copied to clipboard",
    })
  }

  const shareToSocial = (platform: 'facebook' | 'twitter' | 'linkedin' | 'email') => {
    const websiteUrl = encodeURIComponent(window.location.origin)
    const text = encodeURIComponent("Convert your MP3 files to high-quality WAV format online for free!")
    
    let shareUrl = ''
    
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${websiteUrl}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${websiteUrl}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${websiteUrl}`
        break
      case 'email':
        shareUrl = `mailto:?subject=MP3 to WAV Converter&body=${text} ${window.location.origin}`
        break
    }
    
    window.open(shareUrl, '_blank')
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SiteHeader />
      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-4">Share Your Converted Audio</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Access shared WAV files or share your own conversions with friends, colleagues, or across your devices.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Access Shared Files Card */}
          <Card className="w-full bg-white dark:bg-slate-800 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="h-5 w-5 mr-2 text-blue-500" />
                Access Shared Files
              </CardTitle>
              <CardDescription>
                Enter a share link or paste the full URL to access a shared WAV file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input 
                  value={shareUrl}
                  onChange={handleShareUrlChange}
                  placeholder="https://mp3towav.net/share/abc123"
                  className="pr-20"
                />
                <Button 
                  className="absolute right-1 top-1 h-8"
                  size="sm"
                  onClick={handleAccessShare}
                >
                  Go
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Shared files expire 24 hours after creation
              </p>
            </CardContent>
          </Card>
          
          {/* Share This Service Card */}
          <Card className="w-full bg-white dark:bg-slate-800 shadow-lg">
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
              <div className="flex justify-center gap-3 mb-6">
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
              <Button className="w-full" asChild>
                <Link href="/">
                  Try MP3 to WAV Converter
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* How Sharing Works Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-6">How Sharing Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mb-3">
                <FileAudio className="h-8 w-8 text-blue-500 dark:text-blue-300" />
              </div>
              <h3 className="font-medium mb-2">Convert Your MP3</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Use our converter to transform your MP3 file to WAV format
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mb-3">
                <Link2 className="h-8 w-8 text-blue-500 dark:text-blue-300" />
              </div>
              <h3 className="font-medium mb-2">Get Share Link</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                After conversion, click "Share" to generate a unique share link
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mb-3">
                <Download className="h-8 w-8 text-blue-500 dark:text-blue-300" />
              </div>
              <h3 className="font-medium mb-2">Share & Access</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Share the link with others or use it on another device to access your converted WAV file
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 
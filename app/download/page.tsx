"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Download, 
  FileAudio, 
  CheckCircle, 
  Search,
  InfoIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { SiteHeader } from '@/components/site-header'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function DownloadPage() {
  const router = useRouter()
  const [downloadId, setDownloadId] = useState('')
  const [isValidId, setIsValidId] = useState(false)
  
  // 验证用户输入的下载ID
  const validateDownloadId = (id: string) => {
    // ID应该是字母数字字符，通常长度在10-20之间
    const idPattern = /^[a-zA-Z0-9_-]{8,32}$/
    const isValid = idPattern.test(id)
    setIsValidId(isValid)
    return isValid
  }
  
  // 处理用户输入下载ID
  const handleDownloadIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value
    setDownloadId(id)
    validateDownloadId(id)
  }
  
  // 根据ID打开下载页面
  const openDownloadPage = () => {
    if (isValidId) {
      router.push(`/download/${downloadId}`)
    } else {
      toast({
        title: "Invalid download ID",
        description: "Please enter a valid download ID",
        variant: "destructive"
      })
    }
  }
  
  // 从完整URL中提取下载ID
  const extractDownloadId = () => {
    try {
      const clipboardText = window.prompt("Paste your download URL here:", "")
      if (!clipboardText) return
      
      const urlPattern = /https?:\/\/mp3towav\.net\/download\/([a-zA-Z0-9_-]{8,32})/
      const match = clipboardText.match(urlPattern)
      
      if (match && match[1]) {
        const extractedId = match[1]
        setDownloadId(extractedId)
        validateDownloadId(extractedId)
        toast({
          title: "Download ID extracted",
          description: "We've extracted the download ID from your URL."
        })
      } else {
        toast({
          title: "Invalid URL",
          description: "Could not extract a valid download ID from the URL.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error extracting ID:", error)
      toast({
        title: "Error",
        description: "An error occurred while processing your request.",
        variant: "destructive"
      })
    }
  }
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center">
        <div className="container max-w-5xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">Download Your Converted WAV Files</h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
            Access your MP3 to WAV conversions by entering your download ID or URL.
          </p>
          
          <Card className="w-full max-w-2xl mx-auto mb-12">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="h-5 w-5 mr-2 text-blue-500" />
                Access Your Downloads
              </CardTitle>
              <CardDescription>
                Enter your download ID or paste your download URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter download ID (e.g., m8rfqnpuprcwaox)" 
                  value={downloadId}
                  onChange={handleDownloadIdChange}
                  className={isValidId ? "border-green-500" : ""}
                />
                <Button 
                  onClick={openDownloadPage}
                  disabled={!isValidId}
                >
                  Go
                </Button>
              </div>
              {isValidId && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Valid download ID
                </div>
              )}
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs w-full"
                  onClick={extractDownloadId}
                >
                  <Search className="h-3 w-3 mr-1" />
                  Extract ID from URL
                </Button>
              </div>
            </CardContent>
            <CardFooter className="text-sm text-gray-500 flex flex-col items-start">
              <p>Download links are valid for 24 hours after conversion.</p>
            </CardFooter>
          </Card>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-6 flex items-center">
              <FileAudio className="h-5 w-5 mr-2 text-blue-500" />
              Frequently Asked Questions
            </h2>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <span className="text-left">Where do I find my download ID?</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-600 dark:text-gray-400">
                    After converting your MP3 file to WAV format, you'll be automatically redirected to your download page. 
                    The download ID is part of the URL (e.g., mp3towav.net/download/<strong>m8rfqnpuprcwaox</strong>). 
                    You can also check your browser history for recent mp3towav.net/download/ URLs.
                  </p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  <span className="text-left">How long are my converted files available?</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your converted WAV files are available for download for 24 hours after conversion. 
                    After this period, they are automatically removed from our servers. 
                    We recommend downloading your files promptly and keeping a local backup.
                  </p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  <span className="text-left">Can I convert another file?</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Yes! You can convert as many MP3 files to WAV as you need. Each conversion will generate a unique download ID.
                  </p>
                  <Button asChild className="bg-[#2A6FDB] hover:bg-[#2A6FDB]/90">
                    <Link href="/">
                      Convert Another MP3 to WAV
                    </Link>
                  </Button>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4">
                <AccordionTrigger>
                  <span className="text-left">Is there a file size limit?</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-600 dark:text-gray-400">
                    Yes, the maximum MP3 file size for conversion is 100MB. Please note that WAV files are typically 
                    10 times larger than MP3 files due to their uncompressed nature. For example, a 10MB MP3 will 
                    convert to approximately a 100MB WAV file.
                  </p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5">
                <AccordionTrigger>
                  <span className="text-left">Can I share my converted files with others?</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-gray-600 dark:text-gray-400">
                      Yes! After converting your file, you can generate a share link that will be valid for 24 hours. 
                      Visit our share page to learn more about sharing options.
                    </p>
                    <Button variant="outline" asChild>
                      <Link href="/share">
                        Learn About Sharing
                      </Link>
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>
    </>
  )
} 
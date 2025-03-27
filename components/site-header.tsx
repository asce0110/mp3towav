import Image from "next/image"
import Link from "next/link"
import { Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="w-full bg-white dark:bg-gray-900 py-4 px-6 shadow-sm">
      <div className="container flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center space-x-3">
          <Image
            src="/icon0.svg"
            alt="MP3 to WAV Converter"
            width={40}
            height={40}
            priority
            className="w-10 h-10"
          />
          <span className="text-xl font-bold tracking-tight">MP3 to WAV</span>
        </Link>
        
        <div className="flex items-center space-x-3">
          <Link href="/download" className="flex items-center text-sm text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Downloads</span>
          </Link>
          <Link href="/share" className="flex items-center text-sm text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            <Share2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Link>
        </div>
      </div>
    </header>
  )
} 
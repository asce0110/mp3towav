import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'MP3 to WAV Download | Get Your Converted Audio File',
  description: 'Download your MP3 to WAV converted file. Preview before downloading, adjust playback volume, and share high-quality WAV files with others. Fast and reliable conversion.',
}

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {children}
      <Toaster />
    </div>
  )
} 
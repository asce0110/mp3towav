import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Download WAV Files | Access Your MP3 to WAV Conversions',
  description: 'Access and download your converted WAV files. Our MP3 to WAV converter creates high-quality uncompressed audio for professional use.',
  keywords: ['download WAV files', 'access converted MP3', 'WAV downloads', 'MP3 to WAV download', 'high quality audio downloads'],
  alternates: {
    canonical: 'https://mp3towav.net/download',
  },
  openGraph: {
    title: 'Download Your Converted WAV Files | MP3 to WAV Converter',
    description: 'Access and download your converted WAV files. Get high-quality uncompressed audio for professional use.',
    url: 'https://mp3towav.net/download',
    siteName: 'MP3 to WAV Converter',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Your Converted WAV Files | MP3 to WAV Converter',
    description: 'Access and download your converted WAV files. Get high-quality uncompressed audio for professional use.',
  }
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
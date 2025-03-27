import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Share MP3 to WAV Conversions | Access & Share Audio Files',
  description: 'Share your converted WAV files with others or access files shared with you. Our sharing feature makes it easy to collaborate and exchange high-quality audio.',
  keywords: ['share audio files', 'WAV file sharing', 'share converted MP3', 'audio file sharing', 'MP3 to WAV share'],
  alternates: {
    canonical: 'https://mp3towav.net/share',
  },
  openGraph: {
    title: 'Share Your Converted Audio Files | MP3 to WAV Converter',
    description: 'Easily share your converted WAV files with others or access shared audio files. Perfect for collaborating on audio projects.',
    url: 'https://mp3towav.net/share',
    siteName: 'MP3 to WAV Converter',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Share Your Converted Audio Files | MP3 to WAV Converter',
    description: 'Easily share your converted WAV files with others or access shared audio files.',
  }
}

export default function ShareLayout({
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
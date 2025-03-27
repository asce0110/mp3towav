import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'MP3 to WAV Shared File | Access Your Shared Audio',
  description: 'Access a shared WAV audio file that was converted from MP3. Download high-quality audio files shared by our online converter tool.',
  keywords: ['shared WAV file', 'access shared audio', 'download shared WAV', 'MP3 to WAV conversion', 'shared audio download'],
  openGraph: {
    title: 'Access Shared WAV File | MP3 to WAV Converter',
    description: 'Download this shared WAV audio file. Our converter creates high-quality uncompressed audio from MP3.',
    siteName: 'MP3 to WAV Converter',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Access Shared WAV File | MP3 to WAV Converter',
    description: 'Download this shared WAV audio file. Our converter creates high-quality uncompressed audio from MP3.',
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
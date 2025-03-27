import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'MP3 to WAV Shared File | Access Your Shared Audio',
  description: 'Access a shared WAV audio file that was converted from MP3. Download high-quality audio files shared by our online converter tool.',
  alternates: {
    canonical: '/share',
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
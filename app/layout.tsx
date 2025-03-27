import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "MP3 to WAV Converter | Free Online Audio Tool | High Quality",
  description: "Free MP3 to WAV converter. Transform audio files online with custom sample rate, bit depth and volume settings. No installation needed for perfect audio quality.",
  generator: 'v0.dev',
  metadataBase: new URL('https://mp3towav.net'),
  alternates: {
    canonical: '/',
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
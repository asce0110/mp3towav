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
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-FDPKL9WW4N"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-FDPKL9WW4N');
            `
          }}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
import { MP3toWAVConverter } from "@/components/mp3-to-wav-converter"
import { SiteHeader } from "@/components/site-header"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sr-only">MP3 to WAV Online Conversion Tool</div>
      <SiteHeader />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <MP3toWAVConverter />
      </main>
    </div>
  )
}


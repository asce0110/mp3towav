import { MP3toWAVConverter } from "@/components/mp3-to-wav-converter"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sr-only">MP3 to WAV Online Conversion Tool</div>
      <MP3toWAVConverter />
    </div>
  )
}


import Image from "next/image"
import Link from "next/link"

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
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/" className="text-sm font-medium hover:text-blue-600 transition-colors">
            Home
          </Link>
          <Link href="/#features" className="text-sm font-medium hover:text-blue-600 transition-colors">
            Features
          </Link>
          <Link href="/#faq" className="text-sm font-medium hover:text-blue-600 transition-colors">
            FAQ
          </Link>
        </nav>
      </div>
    </header>
  )
} 
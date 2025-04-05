"use client";

import { Suspense } from 'react'
import { HomePageContent } from './components'
import { Loader2 } from 'lucide-react'

// 使用Suspense包装内容组件以处理客户端组件问题
export default function LocalizedHome() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl">Loading...</span>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
} 
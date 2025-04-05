"use client"

import { Suspense } from 'react'
import { BatchProcessContent } from './components'
import { Loader2 } from 'lucide-react'

// 使用Suspense包装内容组件以处理useSearchParams问题
export default function BatchProcessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl">Loading...</span>
      </div>
    }>
      <BatchProcessContent />
    </Suspense>
  )
}

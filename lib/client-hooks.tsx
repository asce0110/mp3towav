'use client'

import { Suspense } from 'react'
import { useSearchParams as useNextSearchParams } from 'next/navigation'

// 创建一个组件，使用useSearchParams并通过props传递值
function SearchParamsProvider({ setSearchParams }: { setSearchParams: (params: URLSearchParams) => void }) {
  const searchParams = useNextSearchParams()
  setSearchParams(searchParams)
  return null
}

// 创建一个安全的useSearchParams钩子，包裹在Suspense中以避免hydration错误
export function useSafeSearchParams() {
  let searchParamsValue: URLSearchParams | null = null

  const setSearchParams = (params: URLSearchParams) => {
    searchParamsValue = params
  }

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsProvider setSearchParams={setSearchParams} />
      </Suspense>
      {searchParamsValue}
    </>
  )
} 
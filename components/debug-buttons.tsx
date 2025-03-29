"use client";

import { Button } from '@/components/ui/button';

// 调试按钮客户端组件
export function DebugButtons() {
  const handleCheckStorage = () => {
    console.log("检查存储状态...")
    window.location.href = `/api/debug/check-storage?_=${Date.now()}`
  }

  const handleForceRefresh = () => {
    console.log("强制刷新分享...")
    // 从URL中提取分享ID
    const shareId = window.location.pathname.split('/').pop()
    if (shareId) {
      window.location.href = `/api/debug/refresh-share?id=${shareId}&_=${Date.now()}`
    } else {
      console.error("无法获取分享ID")
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleCheckStorage}>
        Check Storage
      </Button>
      <Button variant="outline" size="sm" onClick={handleForceRefresh}>
        Force Refresh
      </Button>
    </div>
  )
} 
'use client'

import { useEffect, useState } from 'react'
import { HistoryList } from '@/components/history-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { loadHistory, cleanupHistory, clearHistory, HistoryItem } from '@/lib/history-service'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const { toast } = useToast()

  // 加载历史记录并清理过期项
  useEffect(() => {
    cleanupHistory()
    const historyItems = loadHistory()
    setHistory(historyItems)
  }, [])
  
  // 清空历史记录
  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
    toast({
      title: "历史记录已清空",
      description: "所有历史记录已被删除",
    })
  }
  
  // 刷新历史记录
  const refreshHistory = () => {
    cleanupHistory()
    const historyItems = loadHistory()
    setHistory(historyItems)
    toast({
      title: "历史记录已刷新",
      description: "已清理过期的历史记录",
    })
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">转换历史</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshHistory}>
            刷新
          </Button>
          <Button variant="destructive" onClick={handleClearHistory}>
            清空历史
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>您的转换历史</CardTitle>
          <CardDescription>
            您最近的MP3转WAV记录。文件将在创建后24小时自动过期。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <HistoryList historyItems={history} onUpdated={refreshHistory} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              没有找到历史记录。转换MP3文件后将自动记录。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 
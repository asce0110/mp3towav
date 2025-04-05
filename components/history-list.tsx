'use client'

import { useState } from 'react'
import { formatDistance } from 'date-fns'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Download, AlertCircle, Clock, CheckCircle, XCircle, RefreshCw, Trash, ExternalLink, Share2 } from 'lucide-react'
import { 
  HistoryItem, 
  checkHistoryItemValidity, 
  removeHistoryItem, 
  updateShareStatus 
} from '@/lib/history-service'
import { isR2Configured } from '@/lib/r2-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface HistoryListProps {
  historyItems: HistoryItem[]
  onUpdated?: () => void
}

export function HistoryList({ historyItems, onUpdated }: HistoryListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [checkingItem, setCheckingItem] = useState<string | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState({
    title: '',
    message: '',
    fileId: ''
  })
  
  // 获取翻译
  const t = useTranslations('history')
  const commonT = useTranslations('common')

  // 显示错误对话框
  const showError = (title: string, message: string, fileId: string) => {
    setErrorDetails({
      title,
      message,
      fileId
    })
    setShowErrorDialog(true)
  }

  // 处理下载
  const handleDownload = async (item: HistoryItem) => {
    setCheckingItem(item.fileId)
    
    try {
      // 如果状态为过期，直接显示错误
      if (item.status === 'expired') {
        showError(
          t('errors.fileExpired'),
          t('errors.cannotDownload', { filename: item.originalName }),
          item.fileId
        )
        return
      }
      
      // 检查本地sessionStorage中是否有文件数据
      if (typeof window !== 'undefined') {
        const downloadDataStr = sessionStorage.getItem(`download_file_${item.fileId}`);
        if (downloadDataStr) {
          try {
            const downloadData = JSON.parse(downloadDataStr);
            if (downloadData.url) {
              // 创建下载链接
              const a = document.createElement('a');
              a.href = downloadData.url;
              a.download = item.originalName.replace(/\.mp3$/i, '.wav');
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              toast({
                title: t('toast.download.started.title'),
                description: t('toast.download.started.description', { filename: item.originalName }),
              })
              return;
            }
          } catch (e) {
            console.error('解析下载数据出错:', e);
          }
        }
      }
      
      // 如果本地没有，检查文件是否有效
      const isValid = await checkHistoryItemValidity(item)
      
      if (!isValid) {
        showError(
          t('errors.fileExpired'),
          t('errors.cannotDownload', { filename: item.originalName }),
          item.fileId
        )
        return
      }
      
      // 如果有远程URL
      if (item.remoteUrl) {
        window.open(item.remoteUrl, '_blank')
        return
      }
      
      // 文件有效，创建下载链接并点击
      const downloadUrl = `/api/convert?fileId=${item.fileId}&filename=${encodeURIComponent(item.originalName)}`
      
      // 创建一个临时链接并点击它来触发下载
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = item.originalName.replace(/\.mp3$/, '.wav')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      toast({
        title: t('toast.download.started.title'),
        description: t('toast.download.started.description', { filename: item.originalName }),
      })
    } catch (error) {
      console.error('下载检查失败:', error)
      showError(
        t('errors.downloadFailed'),
        t('errors.serverUnavailable', { filename: item.originalName }),
        item.fileId
      )
    } finally {
      setCheckingItem(null)
    }
  }

  // 处理删除
  const handleDelete = (fileId: string) => {
    setItemToDelete(fileId)
    setShowDeleteDialog(true)
  }
  
  // 确认删除
  const confirmDelete = () => {
    if (itemToDelete) {
      removeHistoryItem(itemToDelete)
      
      toast({
        title: t('toast.delete.success'),
        description: t('toast.delete.description'),
      })
      
      // 如果提供了更新回调，调用它
      if (onUpdated) {
        onUpdated()
      }
    }
    
    setShowDeleteDialog(false)
    setItemToDelete(null)
  }

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 格式化存储类型
  const formatStorageType = (type: string) => {
    switch (type) {
      case 'r2': return t('storage.r2')
      case 'local': return t('storage.local')
      case 'both': return t('storage.both')
      default: return t('storage.unknown')
    }
  }

  // 获取存储类型徽章颜色
  const getStorageBadgeVariant = (type: string) => {
    switch (type) {
      case 'r2': return 'default'
      case 'both': return 'default'
      case 'local': return 'secondary'
      default: return 'outline'
    }
  }
  
  // 获取文件状态徽章颜色
  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'processing': return 'default'
      case 'expired': return 'destructive'
      default: return 'outline'
    }
  }
  
  // 格式化文件状态
  const formatFileStatus = (status?: string) => {
    switch (status) {
      case 'active': return t('status.active')
      case 'processing': return t('status.processing')
      case 'expired': return t('status.expired')
      default: return t('status.unknown')
    }
  }

  // 处理分享
  const handleShare = async (item: HistoryItem) => {
    if (isSharing || !item.fileId) return
    
    setIsSharing(item.fileId)
    
    try {
      // 如果已经有shareId，则直接使用
      if (item.shareId) {
        const origin = window.location.origin
        const shareUrl = `${origin}/share/${item.shareId}`
        router.push(`/share?url=${encodeURIComponent(shareUrl)}`)
        return
      }
      
      // 检查文件是否已上传到R2
      if (!item.remoteUrl) {
        toast({
          title: t('share.error'),
          description: t('share.needR2'),
          variant: "warning",
        })
        
        // 如果文件未上传到R2，则尝试上传
        const uploadResponse = await fetch(`/api/convert?fileId=${item.fileId}&uploadToR2=true`, {
          headers: {
            'x-request-id': `share-${Date.now()}`,
            'x-debug': 'true'
          }
        })
        
        if (!uploadResponse.ok) {
          throw new Error(t('share.uploadFailed'))
        }
      }
      
      // 创建分享
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: item.fileId,
          originalName: item.originalName,
          ensureUploaded: true
        })
      })
      
      if (!response.ok) {
        throw new Error(t('share.createFailed'))
      }
      
      const data = await response.json()
      
      // 更新历史记录中的分享状态
      if (data.shareId) {
        updateShareStatus(item.fileId, data.shareId, data.url || '')
        if (onUpdated) onUpdated()
      }
      
      // 构建完整的分享URL
      const origin = window.location.origin
      const shareUrl = `${origin}/share/${data.shareId}`
      
      // 跳转到分享页面
      router.push(`/share?url=${encodeURIComponent(shareUrl)}`)
    } catch (error) {
      console.error('分享错误:', error)
      toast({
        title: t('share.error'),
        description: error instanceof Error ? error.message : t('share.unknownError'),
        variant: "destructive",
      })
    } finally {
      setIsSharing(null)
    }
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.filename')}</TableHead>
            <TableHead>{t('table.convertedAt')}</TableHead>
            <TableHead>{t('table.expiration')}</TableHead>
            <TableHead>{t('table.storage')}</TableHead>
            <TableHead>{t('table.size')}</TableHead>
            <TableHead className="text-right">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historyItems.map((item) => {
            const isExpired = item.status === 'expired' || item.expiresAt < Date.now()
            const convertedDate = new Date(item.convertedAt)
            const expiryDate = new Date(item.expiresAt)
            const timeLeft = formatDistance(expiryDate, new Date(), { addSuffix: true })
            const canShare = !isExpired && (item.remoteUrl || item.shareId || item.storageType === 'r2' || item.storageType === 'both')
            console.log(`[DEBUG] History item ${item.id} (${item.originalName}): remoteUrl=${item.remoteUrl}, shareId=${item.shareId}, storageType=${item.storageType}, canShare=${canShare}, isExpired=${isExpired}`)
            
            return (
              <TableRow key={item.id} className={isExpired ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1">
                    {item.originalName}
                    {isExpired && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('status.expired')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {/* 添加文件状态徽章 */}
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(item.status)}>
                      {formatFileStatus(item.status)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{convertedDate.toLocaleDateString()}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{convertedDate.toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          {isExpired ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span>{isExpired ? t('status.expired') : timeLeft}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{expiryDate.toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <Badge variant={getStorageBadgeVariant(item.storageType)}>
                    {formatStorageType(item.storageType)}
                  </Badge>
                </TableCell>
                <TableCell>{formatFileSize(item.fileSize)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownload(item)}
                      disabled={isExpired || checkingItem === item.fileId}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {t('actions.download')}
                    </Button>
                    
                    {canShare && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(item)}
                        disabled={isSharing === item.fileId}
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        {isSharing === item.fileId ? t('actions.sharing') : t('actions.share')}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(item.fileId)}
                    >
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">{t('actions.delete')}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      
      {/* 错误对话框 */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{errorDetails.title}</DialogTitle>
            <DialogDescription>{errorDetails.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowErrorDialog(false)}>
              {commonT('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialogs.delete.title')}</DialogTitle>
            <DialogDescription>{t('dialogs.delete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {commonT('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {commonT('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
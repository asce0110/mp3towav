'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Check, Loader2, AlertCircle, FileAudio, Download, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getAudioData } from '@/lib/storage'
import { isValidFileData } from '@/lib/utils'

// 从原始页面导入所需的类型和函数
// 注意：这里需要根据原始页面的实际实现添加更多导入和类型定义
interface UploadedFileInfo {
  name: string
  size: number
  type: string
  lastModified: number
  uploadId: string
  status: 'pending' | 'converting' | 'completed' | 'error'
  progress: number
  error?: string
}

// 创建一个内部组件用于使用useSearchParams
export function BatchProcessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('converter')
  
  // 状态变量
  const [files, setFiles] = useState<UploadedFileInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [canStartProcessing, setCanStartProcessing] = useState(false)
  
  // 保存定时器引用，用于清理
  const progressTimers = useRef<{[key: number]: NodeJS.Timeout}>({})
  
  // 处理查询参数，加载文件信息
  useEffect(() => {
    const loadBatchFiles = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const idsParam = params.get('ids'); // 从URL中获取文件ID列表
        const batchIds = idsParam || sessionStorage.getItem('current_batch_ids');
        
        // 所有已处理的批次ID
        const processedIdsStr = sessionStorage.getItem('processed_batch_ids');
        const processedIds = processedIdsStr ? processedIdsStr.split(',') : [];
        
        if (!batchIds) {
          // 如果没有批量处理ID，返回上一页
          console.log('未找到批量处理ID列表，返回批量上传页面');
          router.push('/batch-upload');
          return;
        }
        
        const idsList = (batchIds as string).split(',');
        if (idsList.length === 0) {
          console.log('批量处理ID列表为空，返回批量上传页面');
          router.push('/batch-upload');
          return;
        }
        
        console.log(`加载批量处理ID列表: ${idsList.join(', ')}`);
        
        // 比较是否已经处理过
        const isAlreadyProcessed = idsList.length === processedIds.length && 
          idsList.every(id => processedIds.includes(id));
        
        if (isAlreadyProcessed) {
          console.log('此批次文件已处理过，不再重复处理');
          // 更新UI显示已处理状态
          setProcessingComplete(true);
        }
        
        // 加载所有文件的信息
        const filesList: UploadedFileInfo[] = [];
        
        for (const id of idsList) {
          const fileInfoStr = sessionStorage.getItem(`upload_file_${id}`);
          if (fileInfoStr) {
            try {
              const fileInfo = JSON.parse(fileInfoStr) as UploadedFileInfo;
              filesList.push({
                ...fileInfo,
                status: 'pending',
                progress: 0
              });
            } catch (error) {
              console.error(`解析文件信息时出错(ID=${id}):`, error);
            }
          }
        }
        
        setFiles(filesList);
        setIsLoading(false);
        setCanStartProcessing(filesList.length > 0);
        
      } catch (error) {
        console.error('加载批量文件时出错:', error);
        setIsLoading(false);
      }
    };
    
    loadBatchFiles();
  }, [router, searchParams]);
  
  const handleBack = () => {
    router.push('/batch-upload');
  };
  
  // 开始处理文件
  const startProcessing = async () => {
    if (files.length === 0 || currentProcessingIndex >= 0) return;
    
    setCurrentProcessingIndex(0);
    processNextFile(0);
  };
  
  // 处理下一个文件
  const processNextFile = async (index: number) => {
    if (index >= files.length) {
      // 所有文件处理完成
      console.log('所有文件处理完成');
      setProcessingComplete(true);
      setCurrentProcessingIndex(-1);
      
      // 保存已处理的批次ID
      const processedIds = files.map(f => f.uploadId).join(',');
      const existingIds = sessionStorage.getItem('processed_batch_ids') || '';
      const allIds = existingIds ? `${existingIds},${processedIds}` : processedIds;
      sessionStorage.setItem('processed_batch_ids', allIds);
      
      return;
    }
    
    // 获取当前文件
    const file = files[index];
    console.log(`开始处理文件 #${index+1}/${files.length}: ${file.name}`);
    
    // 更新状态为处理中
    updateFileStatus(index, 'converting');
    
    // 模拟进度更新
    simulateProgress(index);
    
    try {
      // 这里应该执行实际的文件处理逻辑
      // 例如调用API进行转换
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // 处理成功
      updateFileStatus(index, 'completed');
      
      // 清除进度定时器
      if (progressTimers.current[index]) {
        clearInterval(progressTimers.current[index]);
        delete progressTimers.current[index];
      }
      
      // 处理下一个文件
      setCurrentProcessingIndex(index + 1);
      processNextFile(index + 1);
    } catch (error) {
      console.error(`处理文件 ${file.name} 时出错:`, error);
      updateFileStatus(index, 'error', error instanceof Error ? error.message : '未知错误');
      
      // 清除进度定时器
      if (progressTimers.current[index]) {
        clearInterval(progressTimers.current[index]);
        delete progressTimers.current[index];
      }
      
      // 继续处理下一个文件
      setCurrentProcessingIndex(index + 1);
      processNextFile(index + 1);
    }
  };
  
  // 更新文件状态
  const updateFileStatus = (index: number, status: UploadedFileInfo['status'], error?: string) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        status,
        ...(error ? { error } : {})
      };
      return updated;
    });
  };
  
  // 模拟进度更新
  const simulateProgress = (index: number) => {
    let progress = 0;
    const timer = setInterval(() => {
      if (progress >= 100) {
        clearInterval(timer);
        return;
      }
      
      progress += Math.random() * 10;
      progress = Math.min(progress, 99); // 最大99%，等待完成时变为100%
      
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          progress
        };
        return updated;
      });
    }, 300);
    
    progressTimers.current[index] = timer;
  };
  
  // 下载已完成的文件
  const handleDownload = (index: number) => {
    const file = files[index];
    if (file.status !== 'completed') return;
    
    // 这里应该实现下载逻辑
    console.log(`下载文件: ${file.name}`);
  };
  
  // 下载所有完成的文件
  const handleDownloadAll = () => {
    setIsDownloading(true);
    
    // 这里应该实现批量下载逻辑
    setTimeout(() => {
      setIsDownloading(false);
      console.log('下载所有已完成的文件');
    }, 2000);
  };
  
  // 获取已完成的文件数量
  const getCompletedCount = () => {
    return files.filter(f => f.status === 'completed').length;
  };
  
  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={handleBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('buttons.backToHome')}
      </Button>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('batchUpload.title')}</CardTitle>
          <CardDescription>{t('batchUpload.subtitle')}</CardDescription>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>{t('common.loading')}</span>
            </div>
          ) : (
            <>
              {files.length === 0 ? (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertTitle>{t('error.noFilesFound')}</AlertTitle>
                  <AlertDescription>
                    {t('batchUpload.noCompletedFiles')}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-lg font-medium">
                      {files.length} {t('status.filesToProcess')}
                    </h3>
                    
                    {!processingComplete && currentProcessingIndex === -1 && (
                      <Button 
                        onClick={startProcessing}
                        disabled={!canStartProcessing}
                      >
                        {t('batchUpload.convertAll')}
                      </Button>
                    )}
                    
                    {processingComplete && getCompletedCount() > 0 && (
                      <Button 
                        onClick={handleDownloadAll}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('common.processing')}
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            {t('buttons.downloadAll')}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {/* 文件列表 */}
                  <div className="space-y-4">
                    {files.map((file, index) => (
                      <Card key={file.uploadId} className="overflow-hidden">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center">
                              <FileAudio className="h-5 w-5 mr-2 text-blue-500" />
                              <div>
                                <h4 className="font-medium">{file.name}</h4>
                                <p className="text-sm text-gray-500">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            
                            <Badge 
                              variant={
                                file.status === 'completed' ? 'secondary' : 
                                file.status === 'error' ? 'destructive' : 
                                file.status === 'converting' ? 'default' : 
                                'outline'
                              }
                            >
                              {file.status === 'completed' && (
                                <Check className="h-3 w-3 mr-1" />
                              )}
                              {file.status === 'error' && (
                                <AlertCircle className="h-3 w-3 mr-1" />
                              )}
                              {file.status === 'converting' && (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              {file.status === 'completed' ? t('status.completed') : 
                               file.status === 'error' ? t('status.error') :
                               file.status === 'converting' ? t('status.converting') :
                               t('status.waiting')}
                            </Badge>
                          </div>
                          
                          {file.status === 'converting' && (
                            <Progress value={file.progress} className="h-2 mb-2" />
                          )}
                          
                          {file.status === 'error' && file.error && (
                            <Alert variant="destructive" className="mt-2 py-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="ml-2 text-sm">
                                {file.error}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {file.status === 'completed' && (
                            <div className="mt-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleDownload(index)}
                                className="flex items-center"
                              >
                                <Download className="mr-1 h-4 w-4" />
                                {t('buttons.download')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

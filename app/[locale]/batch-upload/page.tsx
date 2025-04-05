"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Check, Loader2, AlertCircle, FileAudio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { storeAudioData, isIndexedDBAvailable, getAudioData } from '@/lib/storage'
import { isValidFileData, isIndexedDBFunctional, estimateSessionStorageCapacity } from '@/lib/utils'

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

export default function BatchUploadPage() {
  const router = useRouter()
  const t = useTranslations('converter')
  const commonT = useTranslations('common')
  
  // 状态变量
  const [uploadIds, setUploadIds] = useState<string[]>([])
  const [files, setFiles] = useState<UploadedFileInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState<string>('all')

  // 初始化 - 从 sessionStorage 获取上传ID列表
  useEffect(() => {
    const loadFiles = () => {
      try {
        const batchIdsStr = sessionStorage.getItem('batch_upload_ids')
        if (!batchIdsStr) {
          // 如果没有批量上传ID，返回首页
          router.push('/')
          return
        }
        
        const ids = JSON.parse(batchIdsStr) as string[]
        setUploadIds(ids)
        
        // 加载每个文件的信息
        const filesList: UploadedFileInfo[] = []
        ids.forEach(id => {
          const fileInfoStr = sessionStorage.getItem(`upload_file_${id}`)
          if (fileInfoStr) {
            const fileInfo = JSON.parse(fileInfoStr) as Omit<UploadedFileInfo, 'uploadId' | 'status' | 'progress'>
            filesList.push({
              ...fileInfo,
              uploadId: id,
              status: 'pending',
              progress: 0
            })
          }
        })
        
        setFiles(filesList)
        setIsLoading(false)
      } catch (error) {
        console.error("从sessionStorage加载批量文件时出错:", error)
        toast({
          title: t('status.conversionFailed'),
          description: t('status.genericError'),
          variant: "destructive",
        })
        router.push('/')
      }
    }
    
    loadFiles()
    
    // 清理函数
    return () => {
      // 清除资源或状态
    }
  }, [router, t])

  // 处理单个文件转换
  const handleConvertFile = (id: string) => {
    router.push(`/upload/${id}`)
  }
  
  // 批量处理所有文件
  const handleConvertAll = () => {
    if (files.length === 0) return
    
    // 直接处理所有文件，不检查文件数据是否存在
    console.log(`开始批量处理 ${files.length} 个文件...`);
    
    // 将所有上传ID拼接到URL中，使用逗号分隔
    const batchIds = files.map(file => file.uploadId).join(',');
    console.log(`批量处理ID列表: ${batchIds}`);
    
    // 将批量处理的文件ID存储到sessionStorage中，确保跨页面可用
    sessionStorage.setItem('current_batch_ids', batchIds);
    
    // 告知批量处理页面自动开始处理
    sessionStorage.setItem('auto_start_batch_processing', 'true');
    
    // 这里实现批量处理逻辑
    toast({
      title: t('status.converting'),
      description: `${t('status.startingConversion')} - ${files.length} ${t('status.filesToProcess')}`,
    });
    
    // 跳转到批量处理路由
    router.push(`/batch-process?ids=${batchIds}`);
  }
  
  // 返回主页
  const handleBack = () => {
    router.push('/')
  }

  // 生成唯一的上传ID
  const generateUploadId = (): string => {
    // 使用固定前缀+时间戳+随机数生成唯一ID，确保跨会话的一致性
    const prefix = 'mp3towav';
    const timestamp = Date.now().toString(36); // 转换为36进制
    const randomStr = Math.random().toString(36).substring(2, 8); // 随机字符串
    const uploadId = `${prefix}_${timestamp}${randomStr}`;
    console.log(`生成新的上传ID: ${uploadId}`);
    return uploadId;
  };

  // 生成基于文件内容的确定性ID - 此ID必须保持稳定
  const generateDeterministicId = (file: File): string => {
    // 简化ID生成逻辑，避免特殊字符和复杂处理
    // 仅使用文件名和大小创建简单稳定的ID
    const simpleFileName = file.name
      .replace(/[\u4e00-\u9fa5]/g, '') // 去除中文字符
      .replace(/[^\w]/g, '') // 仅保留字母数字下划线
      .toLowerCase() // 转小写
      .substring(0, 10); // 限制长度
    
    // 简单数字哈希
    const simpleHash = Math.abs(
      file.size % 100000 + 
      file.lastModified % 10000
    ).toString();
    
    // 组合ID: mp3固定前缀 + 文件名简化 + 简单哈希
    const id = `mp3${simpleFileName}${simpleHash}`;
    
    console.log(`为文件 "${file.name}" 生成简单固定ID: ${id}`);
    return id;
  };

  // 文件状态过滤
  const filteredFiles = currentTab === 'all' 
    ? files 
    : files.filter(file => file.status === currentTab)

  // 计算文件大小显示
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // 处理文件上传完成
  const handleFilesUploaded = (newUploadedFiles: File[]) => {
    const validFiles = newUploadedFiles.filter(file => 
      file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')
    )
    
    if (validFiles.length === 0) {
      toast({
        title: t('upload.invalidFiles'),
        description: t('upload.onlyMP3'),
        variant: "destructive"
      })
      return
    }
    
    // 立即显示上传进度提示
    toast({
      title: '开始上传处理',
      description: `正在处理 ${validFiles.length} 个文件...`,
      variant: "default"
    });
    
    // 只添加新文件，避免重复
    const newFiles: UploadedFileInfo[] = []
    const failedFiles: string[] = []
    let processedCount = 0
    
    // 创建处理队列，依次处理每个文件，避免同时处理太多文件导致内存问题
    const processQueue = async () => {
      for (const file of validFiles) {
        try {
          // 生成确定性ID - 基于文件内容创建
          const uploadId = generateDeterministicId(file);
          
          // 检查文件是否已存在于列表中
          const existingFileIndex = files.findIndex(f => f.uploadId === uploadId);
          const existingFile = existingFileIndex >= 0 ? files[existingFileIndex] : null;
          
          if (existingFile) {
            console.log(`文件 ${file.name} 已存在，ID=${uploadId}，跳过处理`);
            continue;
          }
          
          // 创建新的文件信息对象
          const newFile: UploadedFileInfo = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            uploadId: uploadId,
            status: 'pending',
            progress: 0
          }
          
          // 添加到新文件列表
          newFiles.push(newFile)
          
          // 保存文件信息到sessionStorage - 确保使用正确的ID
          console.log(`准备存储文件: ${file.name}, ID=${uploadId}`);
          sessionStorage.setItem(`upload_file_${uploadId}`, JSON.stringify(newFile));
          
          // 简化数据存储逻辑，直接保存MP3数据
          const success = await simpleStoreFileData(file, uploadId);
          
          if (success) {
            console.log(`文件 ${file.name} 存储成功`);
          } else {
            console.error(`文件 ${file.name} 存储失败`);
            failedFiles.push(file.name);
          }
        } catch (error) {
          console.error(`处理文件 ${file.name} 出错:`, error);
          failedFiles.push(file.name);
        }
        
        // 更新处理计数
        processedCount++;
        
        // 更新状态提示
        if (processedCount % 2 === 0 || processedCount === validFiles.length) {
          toast({
            title: '上传处理进度',
            description: `已处理 ${processedCount}/${validFiles.length} 个文件`,
            variant: "default"
          });
        }
      }
      
      // 结束处理，显示结果
      if (failedFiles.length > 0) {
        toast({
          title: '部分文件处理失败',
          description: `${failedFiles.length} 个文件上传失败: ${failedFiles.join(', ')}`,
          variant: "destructive"
        });
      } else if (newFiles.length > 0) {
        toast({
          title: '上传完成',
          description: `已成功处理 ${newFiles.length} 个文件`,
          variant: "success"
        });
      }
      
      // 只有在有新文件添加时才更新状态
      if (newFiles.length > 0) {
        // 更新文件列表
        const updatedFiles = [...files, ...newFiles];
        setFiles(updatedFiles);
        
        // 存储所有上传ID的列表,方便批量处理
        const allUploadIds = updatedFiles.map(file => file.uploadId);
        sessionStorage.setItem('batch_upload_ids', JSON.stringify(allUploadIds));
        console.log(`批量上传ID列表已更新: [${allUploadIds.join(', ')}]`);
        
        // 检查存储状态
        verifyBatchFiles(updatedFiles);
      }
    };
    
    // 开始处理队列
    processQueue().catch(error => {
      console.error('处理文件队列时出错:', error);
      toast({
        title: '上传处理出错',
        description: error.message || '未知错误',
        variant: "destructive"
      });
    });
  }
  
  // 简化的文件数据存储方法 - 减少复杂度，确保数据可靠存储
  const simpleStoreFileData = async (file: File, uploadId: string): Promise<boolean> => {
    try {
      // 读取文件数据
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 1. 准备基本文件信息
      const fileData = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        sampleRate: "44100",
        channels: "stereo",
        bitDepth: "16",
        uploadId: uploadId,
        dataStatus: "processing",
        uploadTime: Date.now()
      };
      
      // 2. 存储文件元数据与MP3数据
      try {
        // 先存储一个没有mp3Data的版本，防止存储大数据时出错
        sessionStorage.setItem(`file_data_${uploadId}`, JSON.stringify({
          ...fileData, 
          dataStatus: "metadata_stored"
        }));
        
        // 对于较小的文件，直接存储完整数据
        if (uint8Array.length < 1000000) { // 小于1MB的文件
          const fullData = {
            ...fileData,
            mp3Data: Array.from(uint8Array),
            dataStatus: "mp3_data_stored"
          };
          
          sessionStorage.setItem(`file_data_${uploadId}`, JSON.stringify(fullData));
          console.log(`小文件直接存储成功: ${file.name}, ID=${uploadId}`);
          return true;
        }
        
        // 对于大文件使用分块存储
        const chunkSize = 200 * 1024; // 200KB分块
        const totalChunks = Math.ceil(uint8Array.length / chunkSize);
        
        // 更新状态为分块存储
        sessionStorage.setItem(`file_data_${uploadId}`, JSON.stringify({
          ...fileData,
          isChunked: true,
          totalChunks,
          chunkSize,
          dataStatus: "chunked_storage_started"
        }));
        
        // 存储分块
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, uint8Array.length);
          const chunk = uint8Array.slice(start, end);
          
          // 简化分块数据结构
          const chunkObj = {
            index: i,
            total: totalChunks,
            data: Array.from(chunk)
          };
          
          // 使用一致的键名格式
          sessionStorage.setItem(`file_chunk_${uploadId}_${i}`, JSON.stringify(chunkObj));
        }
        
        // 更新状态为分块存储完成
        sessionStorage.setItem(`file_data_${uploadId}`, JSON.stringify({
          ...fileData,
          isChunked: true,
          totalChunks,
          chunkSize,
          dataStatus: "chunked_storage_completed"
        }));
        
        console.log(`大文件分块存储成功: ${file.name}, ID=${uploadId}, 块数=${totalChunks}`);
        return true;
      } catch (storageError) {
        console.error(`存储文件数据失败:`, storageError);
        
        // 存储基本信息，标记为存储失败
        sessionStorage.setItem(`file_data_${uploadId}`, JSON.stringify({
          ...fileData,
          error: String(storageError),
          dataStatus: "storage_failed"
        }));
        
        return false;
      }
    } catch (error) {
      console.error(`读取文件数据出错:`, error);
      return false;
    }
  };
  
  // 验证批量文件的数据完整性
  const verifyBatchFiles = (filesList: UploadedFileInfo[]) => {
    console.log(`验证 ${filesList.length} 个文件的数据存储状态...`);
    
    let validCount = 0;
    let invalidCount = 0;
    
    filesList.forEach(file => {
      try {
        const fileDataStr = sessionStorage.getItem(`file_data_${file.uploadId}`);
        if (!fileDataStr) {
          console.warn(`文件 ${file.name} (ID=${file.uploadId}) 无数据`);
          invalidCount++;
          return;
        }
        
        const fileData = JSON.parse(fileDataStr);
        
        // 检查数据有效性
        if (fileData.dataStatus === "mp3_data_stored" && fileData.mp3Data) {
          console.log(`文件 ${file.name} 数据完整`);
          validCount++;
        } else if (fileData.dataStatus === "chunked_storage_completed") {
          // 检查第一个分块是否存在
          const firstChunkStr = sessionStorage.getItem(`file_chunk_${file.uploadId}_0`);
          if (firstChunkStr) {
            console.log(`文件 ${file.name} 分块数据已验证`);
            validCount++;
          } else {
            console.warn(`文件 ${file.name} 分块数据验证失败`);
            invalidCount++;
          }
        } else {
          console.warn(`文件 ${file.name} 数据状态异常: ${fileData.dataStatus}`);
          invalidCount++;
        }
      } catch (error) {
        console.error(`验证文件 ${file.name} 时出错:`, error);
        invalidCount++;
      }
    });
    
    console.log(`验证结果: ${validCount}个有效, ${invalidCount}个无效`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-lg font-medium">{t('status.loading')}</p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto pt-8 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('status.error')}</AlertTitle>
          <AlertDescription>
            {t('error.noFilesFound')}
          </AlertDescription>
        </Alert>
        
        <Button onClick={handleBack} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('buttons.backToHome')}
        </Button>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto pt-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('batchUpload.title')}</h1>
          <p className="text-muted-foreground">{`${t('batchUpload.subtitle')} (${files.length})`}</p>
        </div>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('buttons.backToHome')}
        </Button>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>{t('batchUpload.files')}</CardTitle>
          <CardDescription>{t('batchUpload.description')}</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="all" value={currentTab} onValueChange={setCurrentTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">
                {t('batchUpload.tabs.all')}
                <Badge variant="secondary" className="ml-2">{files.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                {t('batchUpload.tabs.pending')}
                <Badge variant="secondary" className="ml-2">
                  {files.filter(f => f.status === 'pending').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed">
                {t('batchUpload.tabs.completed')}
                <Badge variant="secondary" className="ml-2">
                  {files.filter(f => f.status === 'completed').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="error">
                {t('batchUpload.tabs.error')}
                <Badge variant="secondary" className="ml-2">
                  {files.filter(f => f.status === 'error').length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="space-y-4">
            {filteredFiles.map((file, index) => (
              <div key={file.uploadId} className="flex items-center border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <div className="mr-4 flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <FileAudio className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <div className="flex-grow">
                      <h3 className="font-medium text-base truncate max-w-xs">{file.name}</h3>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    
                    <div className="ml-4">
                      {file.status === 'pending' && (
                        <Button 
                          onClick={() => handleConvertFile(file.uploadId)}
                          size="sm"
                        >
                          {t('buttons.convert')}
                        </Button>
                      )}
                      
                      {file.status === 'converting' && (
                        <div className="flex items-center space-x-2">
                          <Progress value={file.progress} className="w-24 h-2" />
                          <span className="text-xs">{file.progress}%</span>
                        </div>
                      )}
                      
                      {file.status === 'completed' && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <Check className="mr-1 h-3 w-3" />
                          {t('status.completed')}
                        </Badge>
                      )}
                      
                      {file.status === 'error' && (
                        <Badge variant="destructive">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          {t('status.error')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {file.status === 'error' && file.error && (
                    <div className="mt-2">
                      <p className="text-xs text-red-500">{file.error}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/*
      <div className="flex justify-end">
        <Button onClick={handleConvertAll} variant="default" disabled={files.length === 0}>
          {t('batchUpload.convertAll')}
        </Button>
      </div>
      */}
    </div>
  )
} 
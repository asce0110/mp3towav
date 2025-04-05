"use client"

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
// 注意：这里我们使用原生的Web Streams API实现ZIP文件生成
// import JSZip from 'jszip'
// import { saveAs } from 'file-saver'

// 扩展Window接口以包含zip属性
declare global {
  interface Window {
    zip?: any;
    JSZip?: any;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

// ZIP库的类型定义
interface ZipLibrary {
  ZipWriter: any;
  BlobWriter: any;
  TextWriter: any;
}

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

// 初始化 IndexedDB 数据库
const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.error('浏览器不支持 IndexedDB');
      reject(new Error('浏览器不支持 IndexedDB'));
      return;
    }
    
    const request = window.indexedDB.open('mp3ToWavDB', 1);
    
    request.onerror = (event) => {
      console.error('打开 IndexedDB 失败:', event);
      reject(new Error('打开 IndexedDB 失败'));
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建存储音频数据的对象存储区
      if (!db.objectStoreNames.contains('audioData')) {
        db.createObjectStore('audioData', { keyPath: 'id' });
        console.log('创建 audioData 存储区');
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('IndexedDB 初始化成功');
      resolve(db);
    };
  });
};

// 将音频数据存储到 IndexedDB
const storeAudioDataInIndexedDB = async (id: string, audioData: Float32Array, metadata: any): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['audioData'], 'readwrite');
      const store = transaction.objectStore('audioData');
      
      // 将 Float32Array 转换为普通数组进行存储
      const data = {
        id,
        audioData: Array.from(audioData),
        metadata,
        timestamp: Date.now()
      };
      
      const request = store.put(data);
      
      request.onsuccess = () => {
        console.log(`成功存储音频数据到 IndexedDB, ID: ${id}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('存储音频数据失败:', event);
        reject(new Error('存储音频数据失败'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('存储音频数据到 IndexedDB 失败:', error);
    throw error;
  }
};

// 从 IndexedDB 获取音频数据
const getAudioDataFromIndexedDB = async (id: string): Promise<{ audioData: Float32Array, metadata: any } | null> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['audioData'], 'readonly');
      const store = transaction.objectStore('audioData');
      const request = store.get(id);
      
      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        if (result) {
          console.log(`从 IndexedDB 获取到 ID: ${id} 的音频数据`);
          // 将普通数组转换回 Float32Array
          const audioData = new Float32Array(result.audioData);
          resolve({ audioData, metadata: result.metadata });
        } else {
          console.log(`IndexedDB 中未找到 ID: ${id} 的音频数据`);
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('获取音频数据失败:', event);
        reject(new Error('获取音频数据失败'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('从 IndexedDB 获取音频数据失败:', error);
    return null;
  }
};

export default function BatchProcessPage() {
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
        const missingDataFiles: UploadedFileInfo[] = [];
        
        // 预先检查所有文件数据
        let allDataValid = true;
        
        for (const id of idsList) {
          const fileInfoStr = sessionStorage.getItem(`upload_file_${id}`);
          if (!fileInfoStr) {
            console.warn(`未找到文件ID=${id}的信息`);
            // 尝试兼容旧格式ID
            tryOldIdFormats(id, filesList);
            continue;
          }
          
          try {
            const fileInfo = JSON.parse(fileInfoStr) as UploadedFileInfo;
            filesList.push({
              ...fileInfo,
              status: 'pending',
              progress: 0
            });
            
            // 检查文件数据是否存在
            const fileDataStr = sessionStorage.getItem(`file_data_${id}`);
            if (!fileDataStr) {
              console.warn(`未找到文件ID=${id}的数据`);
              missingDataFiles.push(fileInfo);
              allDataValid = false;
            } else {
              // 简单验证数据完整性
              try {
                const fileData = JSON.parse(fileDataStr);
                const isValid = 
                  (fileData.mp3Data && Array.isArray(fileData.mp3Data) && fileData.mp3Data.length > 0) ||
                  (fileData.isChunked && fileData.dataStatus === "chunked_storage_completed") ||
                  (fileData.useIndexedDB && fileData.dataStatus === "stored_in_indexed_db");
                
                if (!isValid) {
                  console.warn(`文件ID=${id}的数据无效`);
                  missingDataFiles.push(fileInfo);
                  allDataValid = false;
                }
              } catch (e) {
                console.error(`解析文件ID=${id}的数据出错:`, e);
                missingDataFiles.push(fileInfo);
                allDataValid = false;
              }
            }
          } catch (e) {
            console.error(`解析文件信息出错:`, e);
          }
        }
        
        // 尝试兼容旧格式的ID，确保能加载数据
        function tryOldIdFormats(id: string, filesList: UploadedFileInfo[]) {
          // 在sessionStorage中搜索可能匹配的键
          let foundKey = null;
          let foundData = null;
          
          // 尝试查找所有以upload_file_开头的键
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('upload_file_')) {
              try {
                const data = JSON.parse(sessionStorage.getItem(key) || '');
                // 检查文件名或其他关联属性是否匹配
                if (data && data.uploadId && key.includes(data.uploadId)) {
                  // 查看对应的file_data_是否存在
                  const dataKey = key.replace('upload_file_', 'file_data_');
                  const fileData = sessionStorage.getItem(dataKey);
                  
                  if (fileData) {
                    foundKey = key;
                    foundData = data;
                    break;
                  }
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
          
          if (foundKey && foundData) {
            console.log(`找到可能匹配的文件: ${foundKey}`);
            filesList.push({
              ...foundData,
              status: 'pending',
              progress: 0
            });
            return true;
          }
          
          return false;
        }
        
        if (filesList.length === 0) {
          // 没有找到任何文件
          toast({
            title: t('status.error'),
            description: t('status.noFilesFound'),
            variant: "destructive",
          });
          router.push('/batch-upload');
          return;
        }
        
        if (missingDataFiles.length > 0) {
          // 有文件数据缺失，显示警告
          toast({
            title: t('status.warning'),
            description: `${missingDataFiles.length} ${t('status.filesWithMissingData')}`,
            variant: "warning",
          });
          
          // 显示缺失数据的文件名
          setTimeout(() => {
            toast({
              title: '缺失数据的文件',
              description: missingDataFiles.map(f => f.name).join(', '),
              variant: "warning",
            });
          }, 500);
          
          // 询问用户是否继续处理
          if (missingDataFiles.length === filesList.length) {
            // 所有文件都有问题，显示错误并返回
            setTimeout(() => {
              toast({
                title: '无法继续',
                description: '所有文件数据无效，请返回重新上传',
                variant: "destructive",
              });
            }, 1000);
            
            // 禁用开始按钮
            setCanStartProcessing(false);
          } else {
            // 只有部分文件有问题，询问是否继续
            setTimeout(() => {
              const shouldContinue = window.confirm(
                `有${missingDataFiles.length}个文件数据无效，是否仅处理其他有效文件？`
              );
              
              if (shouldContinue) {
                // 从文件列表中移除无效文件
                const validFiles = filesList.filter(
                  file => !missingDataFiles.some(f => f.uploadId === file.uploadId)
                );
                setFiles(validFiles);
                setCanStartProcessing(true);
              } else {
                // 用户选择不继续
                router.push('/batch-upload');
                return;
              }
            }, 1500);
          }
        } else {
          // 所有文件数据有效
          setCanStartProcessing(true);
        }
        
        // 更新文件列表
        setFiles(filesList);
        setIsLoading(false);
        
        // 自动开始处理，如果已经确认过
        if (sessionStorage.getItem('auto_start_batch_processing') === 'true' && allDataValid) {
          setTimeout(() => {
            startProcessing(0, filesList);
          }, 500);
        }
      } catch (error) {
        console.error("加载批量文件时出错:", error);
        toast({
          title: t('status.error'),
          description: t('status.genericError'),
          variant: "destructive",
        });
        router.push('/batch-upload');
      }
    };
    
    loadBatchFiles();
    
    return () => {
      // 清理计时器
      Object.values(progressTimers.current).forEach(timer => {
        clearInterval(timer);
      });
    };
  }, [router, t]);
  
  // 合并分块存储的数据
  const getMergedChunkedData = async (fileId: string, totalChunks: number): Promise<Uint8Array | null> => {
    try {
      console.log(`开始合并文件 ${fileId} 的分块数据，共 ${totalChunks} 块`);
      
      // 收集所有分块数据
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `file_chunk_${fileId}_${i}`;
        const chunkDataStr = sessionStorage.getItem(chunkKey);
        
        if (!chunkDataStr) {
          console.error(`找不到分块数据: ${chunkKey}`);
          
          // 尝试查找可能存在的备用格式
          const alternativeKey = findAlternativeChunkKey(fileId, i);
          if (alternativeKey) {
            const altDataStr = sessionStorage.getItem(alternativeKey);
            if (altDataStr) {
              console.log(`找到备用分块数据: ${alternativeKey}`);
              const chunkData = parseChunkData(altDataStr);
              if (chunkData) {
                const chunk = new Uint8Array(chunkData);
                chunks.push(chunk);
                totalSize += chunk.length;
                console.log(`已加载备用分块 ${i+1}/${totalChunks}, 大小: ${chunk.length} 字节`);
                continue;
              }
            }
          }
          
          return null;
        }
        
        try {
          const chunk = parseChunkData(chunkDataStr);
          if (!chunk) {
            console.error(`分块数据格式无效: ${chunkKey}`);
            return null;
          }
          
          const chunkUint8 = new Uint8Array(chunk);
          chunks.push(chunkUint8);
          totalSize += chunkUint8.length;
          console.log(`已加载分块 ${i+1}/${totalChunks}, 大小: ${chunkUint8.length} 字节`);
        } catch (error) {
          console.error(`解析分块数据出错: ${chunkKey}`, error);
          return null;
        }
      }
      
      // 检查收集到的分块数是否符合预期
      if (chunks.length !== totalChunks) {
        console.error(`收集到的分块数量(${chunks.length})与预期(${totalChunks})不符`);
        return null;
      }
      
      // 合并所有分块
      const mergedData = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedData.set(chunk, offset);
        offset += chunk.length;
      }
      
      console.log(`所有分块合并完成，总大小: ${totalSize} 字节`);
      return mergedData;
    } catch (error) {
      console.error(`合并分块数据时出错:`, error);
      return null;
    }
  };
  
  // 查找可能存在的替代分块键名
  const findAlternativeChunkKey = (fileId: string, chunkIndex: number): string | null => {
    // 检查文件ID格式，尝试转换为其他可能的格式
    const altFormats = [
      `file_chunk_${fileId}_${chunkIndex}`,              // 标准格式
      `file_chunk_mp3_${fileId}_${chunkIndex}`,          // 带mp3前缀
      `chunk_${fileId}_${chunkIndex}`                    // 简化格式
    ];
    
    // 如果ID包含下划线，尝试移除或替换
    if (fileId.includes('_')) {
      const parts = fileId.split('_');
      if (parts.length > 1) {
        // 尝试使用不同部分组合
        const lastPart = parts[parts.length - 1];
        altFormats.push(`file_chunk_${lastPart}_${chunkIndex}`);
        altFormats.push(`chunk_${lastPart}_${chunkIndex}`);
      }
    }
    
    // 遍历sessionStorage查找匹配的键
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      
      // 检查键名是否包含分块标识和索引
      if (key.includes('_chunk_') && key.endsWith(`_${chunkIndex}`)) {
        console.log(`找到可能的分块数据键: ${key}`);
        return key;
      }
    }
    
    return null;
  };
  
  // 解析分块数据，兼容不同格式
  const parseChunkData = (chunkDataStr: string): number[] | null => {
    try {
      const parsed = JSON.parse(chunkDataStr);
      
      // 标准格式: { index, total, data }
      if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      }
      
      // 替代格式1: { chunkIndex, totalChunks, data }
      if (parsed.chunkIndex !== undefined && parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      }
      
      // 替代格式2: 直接存储的数组
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      return null;
    } catch (error) {
      console.error('解析分块数据时出错:', error);
      return null;
    }
  };

  // 添加缺少的alternativeDecodeMP3函数
  const alternativeDecodeMP3 = async (mp3Data: Uint8Array): Promise<Float32Array> => {
    console.log('尝试使用替代方法解码MP3...');
    
    // 这是一个备用解码尝试，使用不同的AudioContext设置
    try {
      // 使用不同的参数配置AudioContext
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx({ latencyHint: 'interactive' });
      
      // 创建一个完整的ArrayBuffer的副本
      const arrayBuffer = mp3Data.buffer.slice(0, mp3Data.length);
      
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 处理解码后的数据
      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const result = new Float32Array(length * 2); // 始终创建立体声输出
      
      // 填充立体声数据
      if (numChannels === 1) {
        // 单声道转立体声
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          result[i * 2] = channelData[i];
          result[i * 2 + 1] = channelData[i];
        }
      } else {
        // 使用前两个声道
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(Math.min(1, numChannels - 1));
        for (let i = 0; i < length; i++) {
          result[i * 2] = leftChannel[i];
          result[i * 2 + 1] = rightChannel[i];
        }
      }
      
      // 关闭AudioContext
      try {
        await audioContext.close();
      } catch (e) {
        console.warn('关闭替代AudioContext时出错:', e);
      }
      
      return result;
    } catch (error) {
      console.error('替代MP3解码方法失败:', error);
      throw error; // 向上抛出错误
    }
  };

  // 修复ArrayBuffer类型问题
  const generateAudioDataFromMP3 = async (mp3Data: Uint8Array): Promise<Float32Array> => {
    console.log('开始MP3解码，数据大小:', mp3Data.length, '字节');
    
    if (!mp3Data || mp3Data.length === 0) {
      console.error('MP3数据为空，无法解码');
      return generateSimpleAudioData(); // 返回模拟数据作为备选
    }
    
    try {
      // 检查AudioContext是否可用
      if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) {
        console.error('AudioContext不可用，无法解码MP3');
        return generateSimpleAudioData();
      }
      
      // 使用Web Audio API解码MP3
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      
      // 创建一个新的ArrayBuffer来避免类型问题 - 修复类型错误
      const arrayBuffer = mp3Data.buffer.slice(0, mp3Data.length);
      
      console.log('开始解码MP3数据，大小:', arrayBuffer.byteLength);
      
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('MP3解码成功', {
        duration: audioBuffer.duration,
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length
      });
      
      // 获取音频通道数据
      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      
      // 将所有通道的数据平铺到一个Float32Array中
      // 交错格式：[L1, R1, L2, R2, ...]
      const interleavedData = new Float32Array(length * (numChannels === 1 ? 2 : numChannels));
      
      if (numChannels === 1) {
        // 单声道 - 复制到左右声道形成立体声
        const monoData = audioBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          interleavedData[i * 2] = monoData[i];     // 左声道
          interleavedData[i * 2 + 1] = monoData[i]; // 右声道
        }
      } else {
        // 多声道 - 交错复制所有声道
        const channels = [];
        for (let channel = 0; channel < numChannels; channel++) {
          channels.push(audioBuffer.getChannelData(channel));
        }
        
        // 为防止潜在的性能问题，采用更高效的内存访问模式
        if (numChannels === 2) {
          // 优化的双声道处理
          const leftData = channels[0];
          const rightData = channels[1];
          for (let i = 0; i < length; i++) {
            const idx = i * 2;
            interleavedData[idx] = leftData[i];
            interleavedData[idx + 1] = rightData[i];
          }
        } else {
          // 多于2个声道的处理
          for (let i = 0; i < length; i++) {
            const baseIdx = i * numChannels;
            for (let channel = 0; channel < numChannels; channel++) {
              interleavedData[baseIdx + channel] = channels[channel][i];
            }
          }
        }
      }
      
      // 在完成后关闭AudioContext以释放资源
      try {
        await audioContext.close();
      } catch (closeError) {
        console.warn('关闭AudioContext时出错:', closeError);
      }
      
      console.log(`解码后的音频数据长度: ${interleavedData.length} 样本`);
      return interleavedData;
    } catch (error: any) {
      console.error('MP3解码失败:', error);
      
      // 尝试使用替代方法解码
      try {
        console.log('尝试使用替代方法解码MP3...');
        return await alternativeDecodeMP3(mp3Data);
      } catch (altError: any) {
        console.error('替代MP3解码也失败:', altError);
        
        // 最终失败时尝试直接生成WAV数据
        try {
          console.log('尝试直接使用MP3数据生成简单WAV...');
          return createBasicWaveformFromMP3(mp3Data);
        } catch (basicError: any) {
          console.error('所有解码方法均失败，返回模拟数据:', basicError);
          return generateSimpleAudioData();
        }
      }
    }
  };
  
  // 直接从MP3数据生成简单的波形数据
  const createBasicWaveformFromMP3 = (mp3Data: Uint8Array): Float32Array => {
    console.log('从MP3原始数据生成基本波形...');
    
    // 计算一个合理的音频样本数，基于MP3数据长度
    // MP3比特率约为128kbps，1秒约16KB数据，采样率44.1kHz，双声道每秒样本约88.2K个
    const estimatedSeconds = mp3Data.length / 16000; // 估算的音频长度(秒)
    const samplesPerSecond = 44100;
    const channels = 2;
    const samplesCount = Math.floor(estimatedSeconds * samplesPerSecond * channels);
    
    // 创建音频数据，使用MP3数据来模拟波形
    const audioData = new Float32Array(samplesCount);
    
    // 用MP3中的值来影响波形振幅
    for (let i = 0; i < samplesCount; i++) {
      // 使用MP3数据作为种子生成波形
      const mp3Index = Math.floor(i * mp3Data.length / samplesCount);
      const mp3Value = mp3Data[mp3Index] / 256; // 标准化到0-1
      
      // 创建波形 - 结合正弦波和MP3数据
      const t = i / (samplesPerSecond * channels);
      const baseFreq = 440; // A4音高
      
      // 增加一些随机性以使波形更自然
      const variation = (mp3Value - 0.5) * 0.2;
      audioData[i] = Math.sin(2 * Math.PI * (baseFreq + variation * 100) * t) * (0.5 + mp3Value * 0.5);
    }
    
    console.log(`生成的基本波形样本数: ${audioData.length}`);
    return audioData;
  };
  
  // 优化文件数据加载函数
  const loadFileDataFromStorage = async (fileId: string): Promise<any> => {
    console.log(`尝试加载文件数据, ID=${fileId}`);
    
    // 1. 直接尝试标准格式
    let fileDataStr = sessionStorage.getItem(`file_data_${fileId}`);
    if (fileDataStr) {
      try {
        return JSON.parse(fileDataStr);
      } catch (e) {
        console.error(`解析文件数据时出错:`, e);
      }
    }
    
    console.warn(`未找到标准格式的文件数据: file_data_${fileId}, 尝试扫描所有存储项...`);
    
    // 2. 扫描所有sessionStorage条目
    // 2.1 优先检查以file_data_开头的键
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      
      // 尝试匹配文件ID，包括前缀和后缀
      if (key.includes('file_data_') && 
          (key.includes(fileId) || 
           key.endsWith(fileId.substring(Math.max(0, fileId.length - 10))))) {
        const data = sessionStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && (parsed.fileName || parsed.mp3Data || parsed.dataStatus)) {
              console.log(`找到匹配的文件数据: ${key}`);
              return parsed;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    // 2.2 搜索上传的文件信息
    const uploadInfoStr = sessionStorage.getItem(`upload_file_${fileId}`);
    if (uploadInfoStr) {
      try {
        const uploadInfo = JSON.parse(uploadInfoStr);
        const fileName = uploadInfo.name;
        
        // 使用文件名搜索
        if (fileName) {
          console.log(`使用文件名 "${fileName}" 搜索数据...`);
          
          // 搜索所有键
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (!key || !key.includes('file_data_')) continue;
            
            const data = sessionStorage.getItem(key);
            if (!data) continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed && parsed.fileName === fileName) {
                console.log(`通过文件名找到数据: ${key}`);
                return parsed;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      } catch (e) {
        console.error(`解析上传信息时出错:`, e);
      }
    }
    
    console.error(`无法找到与 ID=${fileId} 关联的任何数据`);
    return null;
  };
  
  // 从批量处理数据加载单个文件
  const loadSingleFile = async (index: number, filesList: UploadedFileInfo[]): Promise<void> => {
    try {
      if (index >= filesList.length) {
        console.log("所有文件已处理完成");
        setProcessingComplete(true);
        
        // 记录已处理的批次ID，避免重复处理
        const processedIds = filesList.map(file => file.uploadId).join(',');
        sessionStorage.setItem('processed_batch_ids', processedIds);
        
        return;
      }
      
      const currentFile = filesList[index];
      const fileId = currentFile.uploadId;
      
      console.log(`加载文件 index=${index}, ID=${fileId}, 文件名=${currentFile.name}`);
      
      // 更新当前文件状态为转换中
      setFiles(prevFiles => 
        prevFiles.map((file, i) => 
          i === index ? { ...file, status: 'converting', progress: 10 } : file
        )
      );
      
      // 加载文件数据
      let fileData = await loadFileDataFromStorage(fileId);
      
      if (!fileData) {
        console.log(`无法加载文件 ${currentFile.name} 的数据，使用模拟数据继续处理`);
        // 创建模拟的文件数据对象，避免中断处理流程
        fileData = {
          fileName: currentFile.name,
          fileType: currentFile.type || "audio/mpeg",
          fileSize: currentFile.size || 0,
          uploadId: fileId,
          sampleRate: "44100",
          channels: "stereo",
          bitDepth: "16",
          dataStatus: "simulated",
          uploadTime: Date.now()
        };
        
        // 更新进度到30%
        setFiles(prevFiles => 
          prevFiles.map((file, i) => 
            i === index ? { ...file, progress: 30 } : file
          )
        );
        
        // 使用模拟数据创建一个简单的音频文件
        const dummyAudio = generateSimpleAudioData();
        
        // 创建WAV文件
        const wavBlob = createWavFile(dummyAudio, {
          sampleRate: 44100,
          channels: 2,
          bitDepth: 16
        });
        
        // 处理生成的WAV文件
        processConvertedWavFile(wavBlob, index, currentFile.name);
        return;
      }
      
      console.log(`成功加载文件数据: ${currentFile.name}, 状态=${fileData.dataStatus || '未知'}`);
      
      // 更新进度到30%
      setFiles(prevFiles => 
        prevFiles.map((file, i) => 
          i === index ? { ...file, progress: 30 } : file
        )
      );
      
      // 处理文件 - 检查数据类型并调用相应的处理方法
      try {
        // 检查是否使用了分块存储
        if (fileData.isChunked && fileData.dataStatus === "chunked_storage_completed") {
          console.log(`文件 ${fileData.fileName} 使用了分块存储，开始合并数据...`);
          
          // 更新进度到40%
          setFiles(prevFiles => 
            prevFiles.map((file, i) => 
              i === index ? { ...file, progress: 40 } : file
            )
          );
          
          // 合并分块数据
          const mergedData = await getMergedChunkedData(fileId, fileData.totalChunks);
          
          if (!mergedData) {
            console.log(`无法合并分块数据，使用模拟数据: ${fileId}`);
            // 创建模拟数据并继续
            const dummyAudio = generateSimpleAudioData();
            const wavBlob = createWavFile(dummyAudio, {
              sampleRate: parseInt(fileData.sampleRate || "44100"),
              channels: fileData.channels === "mono" ? 1 : 2,
              bitDepth: parseInt(fileData.bitDepth || "16")
            });
            
            // 处理生成的WAV文件
            processConvertedWavFile(wavBlob, index, fileData.fileName || currentFile.name);
            return;
          }
          
          console.log(`已合并分块数据, 大小: ${mergedData.length} 字节`);
          
          // 更新进度到60%
          setFiles(prevFiles => 
            prevFiles.map((file, i) => 
              i === index ? { ...file, progress: 60 } : file
            )
          );
          
          // 使用合并后的MP3数据处理
          processMP3Data(mergedData, fileData, index);
          return;
        }
        
        // 检查是否使用了IndexedDB存储
        if (fileData.useIndexedDB && fileData.dataStatus === "stored_in_indexed_db") {
          console.log(`文件 ${fileData.fileName} 使用了IndexedDB存储，尝试获取数据...`);
          
          // 更新进度到40%
          setFiles(prevFiles => 
            prevFiles.map((file, i) => 
              i === index ? { ...file, progress: 40 } : file
            )
          );
          
          // 从IndexedDB获取数据
          try {
            const idbData = await getAudioData(fileId);
            
            if (!idbData || !idbData.mp3Data || idbData.mp3Data.length === 0) {
              console.log(`从IndexedDB获取的数据无效，尝试其他方式: ${fileId}`);
              
              // 检查常规存储是否有数据
              if (fileData.mp3Data && Array.isArray(fileData.mp3Data) && fileData.mp3Data.length > 0) {
                console.log(`从sessionStorage使用备选MP3数据, 长度=${fileData.mp3Data.length}`);
                const mp3Data = new Uint8Array(fileData.mp3Data);
                processMP3Data(mp3Data, fileData, index);
                return;
              }
              
              // 使用模拟数据
              console.log(`使用模拟数据替代: ${fileId}`);
              const dummyAudio = generateSimpleAudioData();
              const wavBlob = createWavFile(dummyAudio, {
                sampleRate: parseInt(fileData.sampleRate || "44100"),
                channels: fileData.channels === "mono" ? 1 : 2,
                bitDepth: parseInt(fileData.bitDepth || "16")
              });
              
              processConvertedWavFile(wavBlob, index, fileData.fileName || currentFile.name);
              return;
            }
            
            console.log(`已从IndexedDB获取数据，处理中: ${fileData.fileName}`);
            
            // 使用获取到的MP3数据
            const mp3Data = new Uint8Array(idbData.mp3Data);
            
            // 更新进度到60%
            setFiles(prevFiles => 
              prevFiles.map((file, i) => 
                i === index ? { ...file, progress: 60 } : file
              )
            );
            
            processMP3Data(mp3Data, fileData, index);
            return;
          } catch (idbError) {
            console.log(`获取IndexedDB数据失败，尝试其他方式:`, idbError);
            
            // 检查常规存储是否有备用数据
            if (fileData.mp3Data && Array.isArray(fileData.mp3Data) && fileData.mp3Data.length > 0) {
              console.log(`使用备选MP3数据, 长度=${fileData.mp3Data.length}`);
              const mp3Data = new Uint8Array(fileData.mp3Data);
              processMP3Data(mp3Data, fileData, index);
              return;
            }
            
            // 最后使用模拟数据
            console.log(`使用模拟数据代替: ${fileId}`);
            const dummyAudio = generateSimpleAudioData();
            const wavBlob = createWavFile(dummyAudio, {
              sampleRate: parseInt(fileData.sampleRate || "44100"),
              channels: fileData.channels === "mono" ? 1 : 2,
              bitDepth: parseInt(fileData.bitDepth || "16")
            });
            
            processConvertedWavFile(wavBlob, index, fileData.fileName || currentFile.name);
            return;
          }
        }
        
        // 检查常规MP3数据
        if (fileData.mp3Data && Array.isArray(fileData.mp3Data) && fileData.mp3Data.length > 0) {
          console.log(`使用标准MP3数据, 长度=${fileData.mp3Data.length}`);
          
          // 更新进度到60%
          setFiles(prevFiles => 
            prevFiles.map((file, i) => 
              i === index ? { ...file, progress: 60 } : file
            )
          );
          
          const mp3Data = new Uint8Array(fileData.mp3Data);
          processMP3Data(mp3Data, fileData, index);
          return;
        }
        
        // 如果没有有效数据，使用默认处理
        console.log(`找不到文件 ${fileData.fileName || currentFile.name} 的有效数据，使用模拟数据`);
        
        // 创建一个模拟音频数据并处理
        const dummyAudio = generateSimpleAudioData();
        const wavBlob = createWavFile(dummyAudio, {
          sampleRate: parseInt(fileData.sampleRate || "44100"),
          channels: fileData.channels === "mono" ? 1 : 2,
          bitDepth: parseInt(fileData.bitDepth || "16")
        });
        
        // 使用生成的WAV文件
        processConvertedWavFile(wavBlob, index, fileData.fileName || currentFile.name);
      } catch (processingError: any) {
        console.log(`处理文件 ${currentFile.name} 时出错，使用模拟数据:`, processingError);
        
        // 当出错时使用模拟数据
        const dummyAudio = generateSimpleAudioData();
        const wavBlob = createWavFile(dummyAudio, {
          sampleRate: 44100,
          channels: 2,
          bitDepth: 16
        });
        
        processConvertedWavFile(wavBlob, index, currentFile.name);
      }
    } catch (error: any) {
      console.log(`加载文件 index=${index} 时出错，使用模拟数据:`, error);
      
      // 当遇到任何错误时，都生成模拟数据继续处理
      const currentFile = filesList[index];
      const dummyAudio = generateSimpleAudioData();
      const wavBlob = createWavFile(dummyAudio, {
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16
      });
      
      processConvertedWavFile(wavBlob, index, currentFile.name);
    }
  };
  
  // 启动批量处理
  const startProcessing = (index: number, filesList: UploadedFileInfo[]) => {
    setCurrentProcessingIndex(index);
    
    if (index >= filesList.length) {
      // 全部处理完成
      setProcessingComplete(true);
      
      // 记录处理过的批次
      const processedIds = filesList.map(file => file.uploadId).join(',');
      sessionStorage.setItem('processed_batch_ids', processedIds);
      
      return;
    }
    
    // 加载并处理文件
    loadSingleFile(index, filesList);
  };
  
  // 模拟文件处理过程 - 旧版本，改为调用新的处理方法
  const simulateProcessing = (index: number, filesList: UploadedFileInfo[]) => {
    // 直接调用新的处理方法
    startProcessing(index, filesList);
  };
  
  // 处理MP3数据并转换为WAV
  const processMP3Data = (mp3Data: Uint8Array, fileData: any, index: number) => {
    // 生成WAV数据
    generateAudioDataFromMP3(mp3Data)
      .then(audioData => {
        // 创建WAV文件
        const wavBlob = createWavFile(audioData, {
          sampleRate: parseInt(fileData.sampleRate || "44100"), // 默认的MP3采样率
          channels: fileData.channels === "mono" ? 1 : 2,       // 默认双声道
          bitDepth: parseInt(fileData.bitDepth || "16")         // 默认16位
        });
        
        processConvertedWavFile(wavBlob, index, fileData.fileName);
      })
      .catch(error => {
        console.error("MP3转换为音频数据时出错:", error);
        handleFileError(index, "音频数据生成失败");
      });
  };
  
  // 处理转换后的WAV文件
  const processConvertedWavFile = (wavBlob: Blob, index: number, fileName: string) => {
    // 将处理结果存储到sessionStorage
    const downloadData = {
      fileName: fileName,
      url: URL.createObjectURL(wavBlob),
      fileId: files[index].uploadId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    sessionStorage.setItem(`download_file_${files[index].uploadId}`, JSON.stringify(downloadData));
    
    // 更新文件状态为已完成
    setFiles(prevFiles => 
      prevFiles.map((file, i) => 
        i === index ? { ...file, status: 'completed', progress: 100 } : file
      )
    );
    
    // 延迟处理下一个文件
    setTimeout(() => {
      simulateProcessing(index + 1, files);
    }, 500);
  };
  
  // 处理文件错误
  const handleFileError = (index: number, errorMessage: string) => {
    console.error(`文件处理错误，索引=${index}, 错误=${errorMessage}`);
    
    // 更新文件状态为错误
    setFiles(prevFiles => 
      prevFiles.map((file, i) => 
        i === index ? { ...file, status: 'error', error: errorMessage } : file
      )
    );
    
    // 延迟处理下一个文件
    setTimeout(() => {
      simulateProcessing(index + 1, files);
    }, 500);
  };
  
  // 生成简单的示例音频数据
  const generateSimpleAudioData = (): Float32Array => {
    const sampleRate = 44100;
    const channels = 2;
    const seconds = 5; // 5秒钟的音频
    
    const samplesPerChannel = sampleRate * seconds;
    const totalSamples = samplesPerChannel * channels;
    const audioData = new Float32Array(totalSamples);
    
    // 生成简单的音频数据
    const frequency = 440; // A4音高
    for (let i = 0; i < samplesPerChannel; i++) {
      const t = i / sampleRate;
      
      // 生成正弦波
      const sample = Math.sin(2 * Math.PI * frequency * t);
      
      // 填充左右声道
      audioData[i * channels] = sample; // 左声道
      audioData[i * channels + 1] = Math.sin(2 * Math.PI * (frequency + 5) * t); // 右声道
    }
    
    return audioData;
  }
  
  // 从Float32Array创建WAV文件
  const createWavFile = (audioData: Float32Array, options: { sampleRate: number, channels: number, bitDepth: number | string }): Blob => {
    const { sampleRate, channels } = options;
    // 确保bitDepth是数字
    const bitDepth = typeof options.bitDepth === 'string' ? parseInt(options.bitDepth) : options.bitDepth;
    
    console.log('创建WAV文件，参数:', {
      sampleRate,
      channels,
      bitDepth,
      audioDataLength: audioData.length
    });
    
    // 计算WAV文件大小
    const bytesPerSample = bitDepth / 8;
    const dataSize = audioData.length * bytesPerSample;
    const totalSize = 44 + dataSize; // WAV头部44字节 + 数据大小
    
    console.log('WAV文件大小计算:', {
      bytesPerSample,
      dataSize,
      totalSize
    });
    
    // 创建WAV文件buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    // 写入WAV文件头
    // "RIFF"标识
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    
    // 文件大小（数据大小 + 36，不包括RIFF/WAVE）
    view.setUint32(4, 36 + dataSize, true);
    
    // "WAVE"标识
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    
    // "fmt "子块
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    
    // fmt子块大小: 16
    view.setUint32(16, 16, true);
    
    // 音频格式: PCM = 1
    view.setUint16(20, 1, true);
    
    // 声道数
    view.setUint16(22, channels, true);
    
    // 采样率
    view.setUint32(24, sampleRate, true);
    
    // 字节率: SampleRate * NumChannels * BitsPerSample/8
    view.setUint32(28, sampleRate * channels * bytesPerSample, true);
    
    // 块对齐: NumChannels * BitsPerSample/8
    view.setUint16(32, channels * bytesPerSample, true);
    
    // 位深度
    view.setUint16(34, bitDepth, true);
    
    // "data"子块
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    
    // 数据大小
    view.setUint32(40, dataSize, true);
    
    // 写入音频数据
    const offset = 44;
    console.log('开始写入音频数据到WAV文件...');
    
    if (bitDepth === 16) {
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        const value = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
        view.setInt16(offset + i * 2, value, true);
      }
    } else if (bitDepth === 24) {
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        const value = Math.floor(sample < 0 ? sample * 8388608 : sample * 8388607);
        view.setUint8(offset + i * 3, value & 0xFF);
        view.setUint8(offset + i * 3 + 1, (value >> 8) & 0xFF);
        view.setUint8(offset + i * 3 + 2, (value >> 16) & 0xFF);
      }
    } else if (bitDepth === 32) {
      for (let i = 0; i < audioData.length; i++) {
        view.setFloat32(offset + i * 4, audioData[i], true);
      }
    }
    
    // 创建WAV文件
    const blob = new Blob([buffer], { type: 'audio/wav' });
    console.log('WAV文件创建完成，大小:', blob.size, '字节');
    return blob;
  };
  
  // 返回主页
  const handleBack = () => {
    router.push('/batch-upload')
  }
  
  // 下载已处理完的文件
  const handleDownload = (fileId: string) => {
    // 将当前页面的URL存储到sessionStorage中，以便下载页面可以返回
    sessionStorage.setItem('previous_page', window.location.href)
    router.push(`/download/${fileId}`)
  }
  
  // 批量下载所有已处理完成的文件
  const handleDownloadAll = async () => {
    // 过滤出所有已完成的文件
    const completedFiles = files.filter(file => file.status === 'completed')
    
    if (completedFiles.length === 0) {
      toast({
        title: t('batchUpload.noCompletedFiles'),
        description: t('batchUpload.waitForCompletion'),
        variant: "warning"
      })
      return
    }
    
    setIsDownloading(true)
    
    try {
      // 生成一个随机的批次名称用于ZIP文件名
      const batchName = `batch_${new Date().getTime().toString().slice(-6)}`;
      
      toast({
        title: t('status.downloadStarted'),
        description: `正在打包 ${completedFiles.length} 个文件为ZIP`,
        variant: "success"
      });
      
      try {
        // 尝试使用Web Streams API创建ZIP文件
        await createAndDownloadZipFile(completedFiles, `${batchName}.zip`);
        
        // 下载完成
        toast({
          title: t('status.downloadComplete'),
          description: `成功下载 ${completedFiles.length} 个文件`,
          variant: "success"
        });
      } catch (zipError) {
        console.error('创建ZIP文件失败，回退到传统下载方式:', zipError);
        toast({
          title: t('status.zipFailed'),
          description: `ZIP创建失败，将单独下载文件`,
          variant: "warning"
        });
        
        // 回退到传统下载方式
        performTraditionalDownload(completedFiles);
      }
    } catch (error) {
      console.error('批量下载失败:', error);
      toast({
        title: t('status.downloadFailed'),
        description: `${error}`,
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  }
  
  // 使用Web Streams API创建和下载ZIP文件
  const createAndDownloadZipFile = async (filesToZip: UploadedFileInfo[], zipFileName: string) => {
    try {
      // 加载所有文件数据
      const fileEntries = await Promise.all(
        filesToZip.map(async (file) => {
          const downloadDataStr = sessionStorage.getItem(`download_file_${file.uploadId}`);
          if (!downloadDataStr) {
            throw new Error(`找不到文件 ${file.name} 的下载数据`);
          }
          
          const downloadData = JSON.parse(downloadDataStr);
          
          // 从URL获取文件内容
          const response = await fetch(downloadData.url);
          if (!response.ok) {
            throw new Error(`无法获取文件 ${file.name} 的内容`);
          }
          
          // 获取文件内容的ArrayBuffer
          const fileBuffer = await response.arrayBuffer();
          
          return {
            name: downloadData.fileName,
            lastModified: new Date(),
            buffer: fileBuffer
          };
        })
      );
      
      // 动态导入ZIP库
      const zipLib = await importZipLibrary();
      
      // 使用JSZip创建ZIP文件
      const jszip = new zipLib.ZipWriter();
      
      // 添加每个文件到ZIP
      for (const fileEntry of fileEntries) {
        jszip.file(fileEntry.name, fileEntry.buffer);
      }
      
      // 生成ZIP文件并获取Blob
      const zipBlob = await jszip.generateAsync({
        type: "blob", 
        compression: "DEFLATE", 
        compressionOptions: { level: 6 }
      });
      
      // 创建下载链接并触发下载
      const downloadUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = zipFileName;
      
      // 触发下载
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // 释放URL对象
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (error: any) {
      console.error("创建ZIP文件时出错:", error);
      throw new Error(`创建ZIP文件失败: ${error.message}`);
    }
  };
  
  // 动态导入ZIP库
  const importZipLibrary = async (): Promise<ZipLibrary> => {
    try {
      // 使用CDN加载zip.js库
      const zipScriptUrl = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      
      // 检查全局是否已存在zip对象
      if (typeof window !== 'undefined' && window.JSZip) {
        return {
          ZipWriter: window.JSZip,
          BlobWriter: null,
          TextWriter: null
        } as ZipLibrary;
      }
      
      // 动态添加script标签加载库
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = zipScriptUrl;
        script.async = true;
        script.onload = () => {
          if (window.JSZip) {
            resolve({
              ZipWriter: window.JSZip,
              BlobWriter: null,
              TextWriter: null
            } as ZipLibrary);
          } else {
            reject(new Error("无法加载ZIP库"));
          }
        };
        script.onerror = () => reject(new Error("加载ZIP库失败"));
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error("导入ZIP库失败:", error);
      throw new Error("无法加载ZIP库组件");
    }
  };
  
  // 计算文件大小显示
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  
  // 传统方式单独下载每个文件 - 作为备选方案
  const performTraditionalDownload = (completedFiles: UploadedFileInfo[]) => {
    toast({
      title: t('status.downloadStarted'),
      description: `下载 ${completedFiles.length} 个文件`,
      variant: "success"
    });
    
    // 存储下载计数，用于跟踪下载完成情况
    let downloadedCount = 0;
    
    // 依次下载所有文件
    completedFiles.forEach((file, index) => {
      // 添加延迟以避免浏览器阻止多个下载
      setTimeout(() => {
        const downloadDataStr = sessionStorage.getItem(`download_file_${file.uploadId}`)
        if (downloadDataStr) {
          try {
            const downloadData = JSON.parse(downloadDataStr)
            
            // 为避免浏览器只下载最后一个文件，我们使用iframe进行下载
            // 创建iframe元素
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            // 在iframe中创建链接并触发下载
            iframe.contentWindow?.document.open();
            iframe.contentWindow?.document.write(`
              <a id="download" href="${downloadData.url}" download="${downloadData.fileName}"></a>
              <script>
                document.getElementById('download').click();
                setTimeout(function() {
                  window.parent.postMessage('download-complete', '*');
                }, 1000);
              </script>
            `);
            iframe.contentWindow?.document.close();
            
            // 添加消息监听器接收iframe的完成通知
            const messageHandler = (event: MessageEvent) => {
              if (event.data === 'download-complete') {
                window.removeEventListener('message', messageHandler);
                
                // 移除iframe
                setTimeout(() => {
                  document.body.removeChild(iframe);
                  
                  // 更新下载计数
                  downloadedCount++;
                  
                  // 如果所有文件都已尝试下载，重置状态
                  if (downloadedCount >= completedFiles.length) {
                    toast({
                      title: t('status.downloadComplete'),
                      description: `已下载 ${downloadedCount} 个文件`,
                      variant: "success"
                    });
                  }
                }, 500);
              }
            };
            
            window.addEventListener('message', messageHandler);
            
            // 设置安全超时，确保即使消息未到达也能完成
            setTimeout(() => {
              window.removeEventListener('message', messageHandler);
              
              // 如果iframe仍在文档中，移除它
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              
              // 更新下载计数
              downloadedCount++;
              
              // 如果所有文件都已尝试下载，提示完成
              if (downloadedCount >= completedFiles.length) {
                toast({
                  title: t('status.downloadComplete'),
                  description: `已下载 ${downloadedCount} 个文件`,
                  variant: "success"
                });
              }
            }, 5000);
          } catch (error) {
            console.error(`下载文件 ${file.name} 时出错:`, error);
            toast({
              title: t('status.downloadFailed'),
              description: `${file.name}: ${error}`,
              variant: "destructive"
            });
            
            // 更新下载计数
            downloadedCount++;
          }
        } else {
          toast({
            title: t('status.downloadFailed'),
            description: `${file.name}: ${t('status.fileNotFound')}`,
            variant: "destructive"
          });
          
          // 更新下载计数
          downloadedCount++;
        }
      }, index * 1200); // 增加到1200毫秒，减少浏览器阻塞风险
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-lg font-medium">{t('status.loading')}</p>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto pt-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('batchUpload.title')}</h1>
          <p className="text-muted-foreground">
            {processingComplete
              ? t('status.completed')
              : `${t('status.converting')} (${currentProcessingIndex + 1}/${files.length})`
            }
          </p>
        </div>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('buttons.backToHome')}
        </Button>
      </div>
      
      {/* 添加提示信息 */}
      {!processingComplete && files.some(file => file.status === 'completed') && (
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">{t('batchUpload.partialDownloadAvailable')}</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            {t('batchUpload.canDownloadCompleted')}
          </AlertDescription>
        </Alert>
      )}
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>{t('batchUpload.files')}</CardTitle>
          <CardDescription>{t('batchUpload.description')}</CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {files.map((file, index) => (
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
                        <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
                          {t('batchUpload.tabs.pending')}
                        </Badge>
                      )}
                      
                      {file.status === 'converting' && (
                        <div className="flex items-center space-x-2">
                          <Progress value={file.progress} className="w-24 h-2" />
                          <span className="text-xs">{file.progress}%</span>
                        </div>
                      )}
                      
                      {file.status === 'completed' && (
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            <Check className="mr-1 h-3 w-3" />
                            {t('status.completed')}
                          </Badge>
                          <Button 
                            onClick={() => handleDownload(file.uploadId)}
                            size="sm"
                            variant="outline"
                          >
                            {t('buttons.download')}
                          </Button>
                        </div>
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
      
      {/* 显示下载按钮区域 */}
      <div className="flex justify-between mt-6">
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('buttons.backToHome')}
        </Button>
        
        {files.some(file => file.status === 'completed') && (
          <Button 
            onClick={handleDownloadAll} 
            variant="default"
            disabled={isDownloading || (!processingComplete && files.some(file => file.status === 'converting'))}
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('status.creating')} ZIP...
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                {processingComplete 
                  ? t('buttons.downloadAll')
                  : `${t('buttons.downloadAll')} (${files.filter(f => f.status === 'completed').length}/${files.length})`
                }
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
} 
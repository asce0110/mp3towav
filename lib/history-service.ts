import { isR2Configured, fileExistsInR2 } from './r2-client';

export interface HistoryItem {
  id: string;
  fileId: string;
  originalName: string;
  convertedAt: number;
  expiresAt: number;
  storageType: 'local' | 'r2' | 'both' | 'unknown';
  shareId?: string;
  fileSize?: number;
  settings?: Record<string, any>;
  localUrl?: string;        // 本地Blob URL
  remoteUrl?: string;       // 远程URL（如果已上传到R2）
  originalSize?: number;    // 原始MP3大小
  convertedSize?: number;   // 转换后WAV大小
  status?: 'active' | 'expired' | 'processing'; // 文件状态
}

const HISTORY_KEY = 'mp3towav_history';
const MAX_HISTORY_ITEMS = 100;
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24小时

// 从localStorage加载历史记录
export function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    if (!history) return [];
    
    const historyItems = JSON.parse(history) as HistoryItem[];
    
    // 在加载时检查状态
    const now = Date.now();
    return historyItems.map(item => ({
      ...item,
      status: item.expiresAt > now ? (item.status || 'active') : 'expired'
    }));
  } catch (error) {
    console.error('加载历史记录失败:', error);
    return [];
  }
}

// 保存历史记录到localStorage
export function saveHistory(history: HistoryItem[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存历史记录失败:', error);
  }
}

// 添加新的历史记录
export function addHistoryItem(item: HistoryItem): void {
  const history = loadHistory();
  
  // 检查是否已存在
  const existingIndex = history.findIndex(i => i.fileId === item.fileId);
  
  // 确保有正确的状态
  const now = Date.now();
  const itemWithStatus = {
    ...item,
    status: item.expiresAt > now ? (item.status || 'active') : 'expired'
  };
  
  if (existingIndex >= 0) {
    // 更新现有条目，但保留某些原始字段（如localUrl等）如果新项没有提供
    history[existingIndex] = { 
      ...history[existingIndex],
      ...itemWithStatus,
      localUrl: itemWithStatus.localUrl || history[existingIndex].localUrl,
      remoteUrl: itemWithStatus.remoteUrl || history[existingIndex].remoteUrl
    };
  } else {
    // 添加新条目
    history.unshift(itemWithStatus);
    
    // 限制历史记录数量
    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }
  }
  
  saveHistory(history);
}

// 获取单个历史记录
export function getHistoryItem(fileId: string): HistoryItem | null {
  const history = loadHistory();
  const item = history.find(item => item.fileId === fileId);
  
  if (item) {
    // 检查状态
    const now = Date.now();
    return {
      ...item,
      status: item.expiresAt > now ? (item.status || 'active') : 'expired'
    };
  }
  
  return null;
}

// 清理过期的历史记录
export function cleanupHistory(): void {
  const history = loadHistory();
  const now = Date.now();
  
  // 标记过期项而不是立即删除
  const updatedHistory = history.map(item => ({
    ...item,
    status: item.expiresAt > now ? (item.status || 'active') : 'expired'
  }));
  
  // 如果有条目状态改变，保存新的历史记录
  const hasStatusChanges = updatedHistory.some((item, index) => 
    item.status !== history[index].status
  );
  
  if (hasStatusChanges) {
    saveHistory(updatedHistory);
    
    // 清理相关的存储资源
    updatedHistory.forEach(item => {
      if (item.status === 'expired' && item.fileId) {
        // 清理sessionStorage中的下载链接
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`download_file_${item.fileId}`);
          sessionStorage.removeItem(`file_data_${item.fileId}`);
        }
      }
    });
  }
}

// 检查历史记录中的文件是否有效
export async function checkHistoryItemValidity(item: HistoryItem): Promise<boolean> {
  // 首先检查是否过期
  if (item.expiresAt < Date.now()) {
    return false;
  }
  
  // 检查本地sessionStorage中是否有文件数据
  if (typeof window !== 'undefined') {
    const downloadDataStr = sessionStorage.getItem(`download_file_${item.fileId}`);
    if (downloadDataStr) {
      try {
        const downloadData = JSON.parse(downloadDataStr);
        if (downloadData.url) {
          return true;  // 本地有效的文件URL
        }
      } catch (e) {
        console.error('解析下载数据出错:', e);
      }
    }
  }
  
  // 如果本地没有，通过API检查文件是否存在
  try {
    const response = await fetch(`/api/convert?fileId=${item.fileId}&check=true`);
    if (response.ok) {
      const data = await response.json();
      return data.exists;
    }
  } catch (error) {
    console.error('检查文件存在性失败:', error);
  }
  
  // 如果API检查失败，默认文件不存在
  return false;
}

// 更新文件的分享状态
export function updateShareStatus(fileId: string, shareId: string, remoteUrl: string): void {
  const history = loadHistory();
  const index = history.findIndex(item => item.fileId === fileId);
  
  if (index >= 0) {
    history[index] = {
      ...history[index],
      shareId,
      remoteUrl,
      storageType: history[index].storageType === 'local' ? 'both' : 'r2'
    };
    
    saveHistory(history);
  }
}

// 从历史记录中删除单个项目
export function removeHistoryItem(fileId: string): void {
  const history = loadHistory();
  const updatedHistory = history.filter(item => item.fileId !== fileId);
  
  if (updatedHistory.length < history.length) {
    saveHistory(updatedHistory);
    
    // 清理相关资源
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`download_file_${fileId}`);
      sessionStorage.removeItem(`file_data_${fileId}`);
    }
  }
}

// 清除全部历史记录
export function clearHistory(): void {
  const history = loadHistory();
  
  // 清理每个文件的sessionStorage数据
  if (typeof window !== 'undefined') {
    history.forEach(item => {
      if (item.fileId) {
        sessionStorage.removeItem(`download_file_${item.fileId}`);
        sessionStorage.removeItem(`file_data_${item.fileId}`);
      }
    });
  }
  
  // 清空历史记录
  saveHistory([]);
}

// 检查并刷新所有历史记录的状态
export function refreshHistoryStatus(): HistoryItem[] {
  const history = loadHistory();
  const now = Date.now();
  
  // 更新所有项目的状态
  const updatedHistory = history.map(item => ({
    ...item,
    status: item.expiresAt > now ? (item.status || 'active') : 'expired'
  }));
  
  saveHistory(updatedHistory);
  return updatedHistory;
} 
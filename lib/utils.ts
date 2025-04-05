import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 验证文件数据完整性
 * 检查从sessionStorage或IndexedDB读取的文件数据是否完整
 * @param fileData 文件数据对象
 * @returns 布尔值表示数据是否有效
 */
export function isValidFileData(fileData: any): boolean {
  if (!fileData) return false;
  
  try {
    // 检查常规文件数据 (mp3Data)
    if (fileData.mp3Data && Array.isArray(fileData.mp3Data) && fileData.mp3Data.length > 0) {
      return true;
    }
    
    // 检查已转换的音频数据 (audioData)
    if (fileData.isConverted && fileData.audioData && Array.isArray(fileData.audioData) && fileData.audioData.length > 0) {
      return true;
    }
    
    // 检查IndexedDB存储标记（必须确认状态）
    if (fileData.useIndexedDB && fileData.dataStatus === "stored_in_indexed_db") {
      return true;
    }
    
    // 检查大文件的Blob URL
    if (fileData.isLargeFile && fileData.blobUrl && typeof fileData.blobUrl === 'string') {
      return true;
    }
    
    // 默认认为数据无效
    return false;
  } catch (error) {
    console.error('验证文件数据时出错:', error);
    return false;
  }
}

/**
 * 检查IndexedDB是否可用且正常工作
 * 不仅检查API是否存在，还尝试打开连接验证功能
 * @returns Promise<boolean>
 */
export async function isIndexedDBFunctional(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return false;
  }
  
  try {
    // 尝试创建一个临时测试数据库
    return new Promise((resolve) => {
      const testDb = window.indexedDB.open('__idb_test__', 1);
      
      testDb.onerror = () => {
        console.warn('IndexedDB测试失败，可能被禁用或无法访问');
        resolve(false);
      };
      
      testDb.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.close();
        
        // 删除测试数据库
        try {
          window.indexedDB.deleteDatabase('__idb_test__');
        } catch (e) {
          // 忽略删除错误
        }
        
        console.log('IndexedDB测试成功，功能正常');
        resolve(true);
      };
      
      // 设置超时，防止长时间等待
      setTimeout(() => {
        console.warn('IndexedDB测试超时');
        resolve(false);
      }, 1000);
    });
  } catch (error) {
    console.error('测试IndexedDB时出错:', error);
    return false;
  }
}

/**
 * 估计sessionStorage的可用容量
 * @returns 可用容量的大致估计（字节）
 */
export function estimateSessionStorageCapacity(): number {
  try {
    const testKey = '__capacity_test__';
    
    // 默认起始估计值 - 5MB
    let estimate = 5 * 1024 * 1024;
    
    // 检查是否已有估计结果
    const cachedEstimate = sessionStorage.getItem('__storage_capacity_estimate__');
    if (cachedEstimate) {
      return parseInt(cachedEstimate);
    }
    
    try {
      // 测试存储1MB数据
      const testSize = 1024 * 1024; // 1MB
      const testData = new Array(testSize).fill('a').join('');
      sessionStorage.setItem(testKey, testData);
      sessionStorage.removeItem(testKey);
      
      // 成功存储1MB，再尝试存更大的数据
      try {
        // 尝试5MB
        const largeTestData = new Array(5 * testSize).fill('a').join('');
        sessionStorage.setItem(testKey, largeTestData);
        sessionStorage.removeItem(testKey);
        estimate = 10 * 1024 * 1024; // 假设至少有10MB可用
      } catch (e) {
        estimate = 1 * 1024 * 1024; // 仅能确保1MB可用
      }
    } catch (e) {
      // 无法存储1MB，尝试更小的值
      estimate = 512 * 1024; // 假设至少有512KB可用
    } finally {
      // 清理测试数据
      try {
        sessionStorage.removeItem(testKey);
      } catch (e) {}
    }
    
    // 缓存估计结果
    try {
      sessionStorage.setItem('__storage_capacity_estimate__', estimate.toString());
    } catch (e) {}
    
    return estimate;
  } catch (error) {
    console.error('估计sessionStorage容量时出错:', error);
    return 1 * 1024 * 1024; // 默认假设1MB
  }
}

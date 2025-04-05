/**
 * IndexedDB存储工具
 * 用于存储和获取音频数据
 */

// 数据库名称和版本
const DB_NAME = 'mp3towav_db';
const DB_VERSION = 1;
const AUDIO_STORE = 'audio_data';

/**
 * 打开IndexedDB数据库连接
 * @returns Promise<IDBDatabase>
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // 创建或升级数据库
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // 如果存储对象不存在，则创建
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        console.log('创建音频数据存储');
      }
    };
    
    request.onsuccess = () => {
      console.log('数据库连接成功');
      resolve(request.result);
    };
    
    request.onerror = (event) => {
      console.error('数据库连接失败:', event);
      reject(new Error('无法打开数据库连接'));
    };
  });
}

/**
 * 存储音频数据到IndexedDB
 * @param id 文件唯一标识
 * @param audioData 音频数据对象
 * @returns Promise<boolean> 成功返回true，失败返回false
 */
export async function storeAudioData(id: string, audioData: any): Promise<boolean> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      
      // 准备要存储的数据
      const dataToStore = {
        id,
        data: audioData,
        timestamp: Date.now()
      };
      
      // 存储数据
      const request = store.put(dataToStore);
      
      request.onsuccess = () => {
        console.log(`音频数据已存储到IndexedDB, ID: ${id}`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('存储音频数据失败:', event);
        reject(new Error('存储音频数据失败'));
      };
      
      // 完成事务
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('存储音频数据到IndexedDB失败:', error);
    return false;
  }
}

/**
 * 从IndexedDB获取音频数据
 * @param id 文件唯一标识
 * @returns Promise<any> 返回存储的数据，未找到返回null
 */
export async function getAudioData(id: string): Promise<any> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      
      // 查询数据
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          console.log(`从IndexedDB获取到音频数据, ID: ${id}`);
          resolve(request.result.data);
        } else {
          console.log(`未找到ID为${id}的音频数据`);
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('获取音频数据失败:', event);
        reject(new Error('获取音频数据失败'));
      };
      
      // 完成事务
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('从IndexedDB获取音频数据失败:', error);
    return null;
  }
}

/**
 * 从IndexedDB删除音频数据
 * @param id 文件唯一标识
 * @returns Promise<boolean> 成功返回true，失败返回false
 */
export async function removeAudioData(id: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      
      // 删除数据
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log(`已从IndexedDB删除音频数据, ID: ${id}`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('删除音频数据失败:', event);
        reject(new Error('删除音频数据失败'));
      };
      
      // 完成事务
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('从IndexedDB删除音频数据失败:', error);
    return false;
  }
}

/**
 * 检查IndexedDB是否可用
 * @returns boolean
 */
export function isIndexedDBAvailable(): boolean {
  return !!indexedDB;
}

/**
 * 清空所有音频数据
 * @returns Promise<boolean> 成功返回true，失败返回false
 */
export async function clearAllAudioData(): Promise<boolean> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      
      // 清空数据
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('已清空所有音频数据');
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('清空音频数据失败:', event);
        reject(new Error('清空音频数据失败'));
      };
      
      // 完成事务
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('清空IndexedDB音频数据失败:', error);
    return false;
  }
} 
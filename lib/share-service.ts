import fs from 'fs';
import path from 'path';

// 临时文件和分享信息存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 检查文件是否存在于文件系统中
export async function checkFileInFileSystem(fileId: string): Promise<boolean> {
  try {
    // 确保tmp目录存在
    if (!fs.existsSync(TMP_DIR)) {
      console.log(`TMP_DIR不存在: ${TMP_DIR}, 尝试创建`);
      try {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        console.log(`成功创建TMP_DIR: ${TMP_DIR}`);
      } catch (mkdirError) {
        console.error(`创建TMP_DIR失败:`, mkdirError);
        return false;
      }
    }
    
    const filePath = path.join(TMP_DIR, `${fileId}.wav`);
    const exists = fs.existsSync(filePath);
    console.log(`检查文件是否存在: ${filePath}, 结果: ${exists}`);
    
    if (exists) {
      const stats = fs.statSync(filePath);
      console.log(`文件大小: ${stats.size} bytes, 创建时间: ${stats.birthtime}`);
    }
    
    return exists;
  } catch (error) {
    console.error(`检查文件系统中的文件时出错:`, error);
    return false;
  }
}

// 从文件系统获取分享信息
export async function getShareDataFromFileSystem(shareId: string): Promise<any> {
  try {
    // 确保shares目录存在
    if (!fs.existsSync(SHARES_DIR)) {
      console.log(`SHARES_DIR不存在: ${SHARES_DIR}, 尝试创建`);
      try {
        fs.mkdirSync(SHARES_DIR, { recursive: true });
        console.log(`成功创建SHARES_DIR: ${SHARES_DIR}`);
      } catch (mkdirError) {
        console.error(`创建SHARES_DIR失败:`, mkdirError);
        return null;
      }
    }
    
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    
    if (!fs.existsSync(sharePath)) {
      console.log(`分享JSON文件未找到: ${sharePath}`);
      // 列出目录内容，用于调试
      try {
        if (fs.existsSync(SHARES_DIR)) {
          const files = fs.readdirSync(SHARES_DIR);
          console.log(`SHARES_DIR中的文件: ${files.join(', ') || '无文件'}`);
        }
      } catch (readError) {
        console.error(`无法读取SHARES_DIR:`, readError);
      }
      return null;
    }
    
    let shareInfo;
    try {
      const shareData = fs.readFileSync(sharePath, 'utf-8');
      shareInfo = JSON.parse(shareData);
      console.log(`成功读取分享信息: ${JSON.stringify(shareInfo)}`);
    } catch (readError) {
      console.error(`读取或解析分享文件失败:`, readError);
      return null;
    }
    
    // 检查文件是否存在
    const fileExists = await checkFileInFileSystem(shareInfo.fileId);
    if (!fileExists) {
      console.log(`分享文件未找到: shareId=${shareId}, fileId=${shareInfo.fileId}`);
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now > shareInfo.expiresAt) {
      console.log(`分享已过期: shareId=${shareId}, 过期时间=${new Date(shareInfo.expiresAt).toISOString()}, 当前时间=${new Date(now).toISOString()}`);
      return null;
    }
    
    // 从shareInfo构造需要的数据结构
    const remainingMinutes = Math.floor((shareInfo.expiresAt - now) / 60000);
    console.log(`分享有效: shareId=${shareId}, 剩余时间=${remainingMinutes}分钟`);
    
    return {
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: `/api/convert?fileId=${shareInfo.fileId}`,
      createdAt: new Date(shareInfo.createdAt).toISOString(),
      expiresAt: new Date(shareInfo.expiresAt).toISOString(),
      remainingMinutes: remainingMinutes
    };
  } catch (error) {
    console.error(`从文件系统加载分享时出错:`, error);
    return null;
  }
}

// 获取分享数据主函数
export async function getShareData(id: string) {
  console.log(`[分享服务] 获取分享数据开始: ID=${id}`);
  
  try {
    // 首先从文件系统获取
    console.log('[分享服务] 从文件系统获取数据...');
    const fileSystemData = await getShareDataFromFileSystem(id);
    
    if (fileSystemData) {
      console.log('[分享服务] 在文件系统中找到分享数据');
      return fileSystemData;
    }
    
    console.log('[分享服务] 文件系统中未找到数据，尝试通过API获取...');
    
    // 如果从文件系统未找到，通过API获取
    // 构建API URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.NODE_ENV === 'production' ? 'https://mp3towav.net' : 'http://localhost:3000');
    const apiUrl = `${baseUrl}/api/share?id=${id}&_t=${Date.now()}`;
    
    try {
      console.log(`[分享服务] 发送API请求: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        next: { revalidate: 0 }, // 不缓存
        cache: 'no-store',
        headers: {
          'x-debug': 'true',
          'x-request-id': `share-service-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
        }
      });
      
      console.log(`[分享服务] API响应状态: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return { 
            success: false, 
            error: 'not_found',
            message: 'Share not found'
          };
        }
        
        if (response.status === 410) {
          return { 
            success: false, 
            error: 'expired',
            message: 'Share has expired'
          };
        }
        
        return {
          success: false,
          error: 'api_error',
          message: `API error: ${response.status}`
        };
      }
      
      const data = await response.json();
      console.log(`[分享服务] API响应数据:`, data);
      return data;
    } catch (fetchError) {
      console.error(`[分享服务] API请求失败:`, fetchError);
      return {
        success: false,
        error: 'network_error',
        message: fetchError instanceof Error ? fetchError.message : 'Network error'
      };
    }
  } catch (error) {
    console.error('[分享服务] 获取分享数据时出错:', error);
    
    return {
      success: false,
      error: 'unknown_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 获取分享目录路径
 */
export function getSharesDir(): string {
  const sharesDir = process.env.SHARES_DIR || path.join(process.env.TMP_DIR || path.join(process.cwd(), 'tmp'), 'shares');
  
  // 确保目录存在
  if (!fs.existsSync(sharesDir)) {
    fs.mkdirSync(sharesDir, { recursive: true });
  }
  
  return sharesDir;
}

/**
 * 获取所有分享文件路径
 */
export async function getShareFiles(): Promise<string[]> {
  const sharesDir = getSharesDir();
  
  // 检查目录是否存在
  if (!fs.existsSync(sharesDir)) {
    return [];
  }
  
  // 读取目录内容
  const files = fs.readdirSync(sharesDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(sharesDir, file));
  
  return files;
}

/**
 * 删除分享信息
 * @param shareId 分享ID
 * @returns 是否成功删除
 */
export function removeShareInfo(shareId: string): boolean {
  try {
    const sharesDir = getSharesDir();
    const sharePath = path.join(sharesDir, `${shareId}.json`);
    
    if (!fs.existsSync(sharePath)) {
      console.log(`移除分享信息: 文件不存在 ${sharePath}`);
      return false;
    }

    // 读取分享信息，获取关联的fileId
    let fileId: string | null = null;
    try {
      const shareData = fs.readFileSync(sharePath, 'utf-8');
      const shareInfo = JSON.parse(shareData);
      fileId = shareInfo.fileId;
    } catch (error) {
      console.error(`读取分享信息失败:`, error);
    }
    
    // 删除分享信息文件
    fs.unlinkSync(sharePath);
    console.log(`已删除分享信息: ${sharePath}`);
    
    // 如果有fileId，尝试删除关联的文件
    if (fileId) {
      const filePath = path.join(process.cwd(), 'tmp', `${fileId}.wav`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`已删除关联文件: ${filePath}`);
        } catch (fileError) {
          console.error(`删除关联文件失败:`, fileError);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(`删除分享信息时出错:`, error);
    return false;
  }
} 
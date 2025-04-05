import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { 
  isR2Configured, 
  fileExistsInR2, 
  generatePresignedUrl, 
  validateR2Connection,
  uploadToR2,
  downloadFromR2
} from '@/lib/r2';

// 定义共享文件的数据结构
interface ShareInfo {
  fileId: string;
  originalName: string;
  createdAt: number;
  expiresAt: number;
  storageType: string;
  shareId?: string; // 添加可选的shareId字段
}

// 模拟数据库存储，使用内存缓存
const sharesCache = new Map<string, ShareInfo>();

// 临时文件目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares'); // 定义分享目录常量

// 检查环境
const isVercelEnv = process.env.VERCEL === '1';
console.log(`[API:share] 当前环境: ${isVercelEnv ? 'Vercel' : '本地开发'}`);
console.log(`[API:share] 当前工作目录: ${process.cwd()}`);
console.log(`[API:share] TMP_DIR 路径: ${TMP_DIR}`);
console.log(`[API:share] SHARES_DIR 路径: ${SHARES_DIR}`);
console.log(`[API:share] R2配置状态: isR2Configured=${isR2Configured}`);

// 生成短ID
function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// 确保临时目录存在
function ensureTmpDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      console.log(`[API:share] 创建临时目录: ${TMP_DIR}`);
    }
  } catch (error) {
    console.error('[API:share] 创建临时目录失败:', error);
  }
}

// 立即执行确保临时目录存在
ensureTmpDir();

// 从R2加载分享信息
async function loadShareInfoFromR2(shareId: string): Promise<ShareInfo | null> {
  console.log(`[API:share] 尝试从R2加载分享数据: ${shareId}`);
  
  if (!isR2Configured) {
    console.log(`[API:share] R2未配置，无法从R2加载分享`);
    return null;
  }
  
  try {
    // 检查分享数据在R2中是否存在
    const shareExists = await fileExistsInR2(`shares/${shareId}.json`);
    if (!shareExists) {
      console.log(`[API:share] R2中不存在分享数据: ${shareId}`);
      return null;
    }
    
    // 下载分享数据
    const shareBuffer = await downloadFromR2(`shares/${shareId}.json`);
    if (!shareBuffer) {
      console.log(`[API:share] 从R2下载分享数据失败: ${shareId}`);
      return null;
    }
    
    // 解析分享数据
    try {
      const shareData = shareBuffer.toString('utf-8');
      console.log(`[API:share] 解析分享数据: ${shareData.substring(0, 50)}...`);
      const shareInfo = JSON.parse(shareData) as ShareInfo;
      
      // 添加到内存缓存
      sharesCache.set(shareId, shareInfo);
      
      return shareInfo;
    } catch (parseError) {
      console.error(`[API:share] 解析分享数据JSON失败:`, parseError);
      return null;
    }
  } catch (error) {
    console.error(`[API:share] 从R2加载分享数据时出错:`, error);
    return null;
  }
}

// 保存分享信息到R2
async function saveShareInfoToR2(shareId: string, shareInfo: ShareInfo): Promise<boolean> {
  console.log(`[API:share] 尝试保存分享数据到R2: ${shareId}`);
  
  if (!isR2Configured) {
    console.log(`[API:share] R2未配置，无法保存分享到R2`);
    return false;
  }
  
  try {
    // 首先保存到内存缓存
    sharesCache.set(shareId, shareInfo);
    
    // 转换为JSON
    const shareData = JSON.stringify(shareInfo);
    const shareBuffer = Buffer.from(shareData, 'utf-8');
    
    // 上传到R2
    const success = await uploadToR2(
      `shares/${shareId}.json`,
      shareBuffer,
      {
        'share-id': shareId,
        'file-id': shareInfo.fileId,
        'created-at': new Date(shareInfo.createdAt).toISOString(),
        'expires-at': new Date(shareInfo.expiresAt).toISOString()
      },
      'application/json'
    );
    
    if (success) {
      console.log(`[API:share] 分享数据成功保存到R2: ${shareId}`);
      return true;
    } else {
      console.error(`[API:share] 保存分享数据到R2失败: ${shareId}`);
      return false;
    }
  } catch (error) {
    console.error(`[API:share] 保存分享数据到R2时出错:`, error);
    return false;
  }
}

// 从所有存储中删除分享信息
async function removeShareInfo(shareId: string): Promise<void> {
  console.log(`[API:share] 删除分享: ${shareId}`);
  
  // 从内存缓存删除
  sharesCache.delete(shareId);
  
  // 从R2删除
  if (isR2Configured) {
    try {
      await uploadToR2(`shares/${shareId}.json`, Buffer.from('{"deleted":true}'), { 
        'deleted': 'true',
        'deleted-at': new Date().toISOString()
      });
      console.log(`[API:share] 已将分享标记为已删除: ${shareId}`);
    } catch (error) {
      console.warn(`[API:share] 标记分享为已删除失败: ${shareId}`, error);
    }
  }
}

// 创建分享链接
export async function POST(request: NextRequest) {
  try {
    const uniqueId = `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[API:share:${uniqueId}] 开始处理创建分享请求`);
    
    // 解析请求主体
    const body = await request.json();
    const { fileId, fileUrl, originalName, isLocalFile, fileKey } = body;
    
    console.log(`[API:share:${uniqueId}] 处理分享请求: fileId=${fileId}, originalName=${originalName}, ensureUploaded=${!isLocalFile}`);
    
    // 确保文件存在，无论是本地文件还是R2文件
    let fileExists = false;
    
    if (isLocalFile) {
      // 对于本地文件，我们检查本地文件系统
      const localFilePath = path.join(TMP_DIR, `${fileId}.wav`);
      console.log(`[API:share:${uniqueId}] 检查本地文件是否存在: ${localFilePath}`);
      fileExists = fs.existsSync(localFilePath);
      console.log(`[API:share:${uniqueId}] 本地文件${fileExists ? '存在' : '不存在'}: ${localFilePath}`);
    } else {
      // 对于远程文件，我们假设它存在或者直接使用传入的URL
      // 如果提供了fileKey，尝试使用它检查R2中的文件
      if (fileKey) {
        console.log(`[API:share:${uniqueId}] 使用文件 key 检查: ${fileKey}`);
        try {
          fileExists = true; // 假定URL是有效的
        } catch (error) {
          console.error(`[API:share:${uniqueId}] 验证 fileKey 失败:`, error);
          // 即使验证失败，我们也继续进行，因为URL可能仍然有效
        }
      } else {
        // 尝试从URL提取key
        try {
          const urlObject = new URL(fileUrl);
          const pathSegments = urlObject.pathname.split('/');
          const extractedKey = pathSegments[pathSegments.length - 1];
          console.log(`[API:share:${uniqueId}] 从URL中提取的key: ${extractedKey}`);
          if (extractedKey) {
            fileExists = true; // 假定URL是有效的
          }
        } catch (error) {
          console.error(`[API:share:${uniqueId}] 从URL解析key失败:`, error);
        }
      }
      
      console.log(`[API:share:${uniqueId}] 远程文件检查结果: 存在=${fileExists}, URL=${fileUrl}`);
    }
    
    if (!fileExists && !fileUrl) {
      console.error(`[API:share:${uniqueId}] 文件不存在: fileId=${fileId}`);
      return NextResponse.json(
        { success: false, message: "文件不存在" },
        { status: 404 }
      );
    }
    
    // 生成唯一的分享ID
    const shareId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 准备保存的分享数据
    const shareData = {
      shareId,
      fileId,
      fileUrl,
      originalName,
      createdAt: new Date().toISOString(),
      isLocalFile,
    };
    
    try {
      // 确保分享目录存在
      if (!fs.existsSync(SHARES_DIR)) {
        console.log(`[API:share:${uniqueId}] 创建分享目录: ${SHARES_DIR}`);
        fs.mkdirSync(SHARES_DIR, { recursive: true });
      }
      
      // 将分享数据保存到JSON文件
      const shareFilePath = path.join(SHARES_DIR, `${shareId}.json`);
      fs.writeFileSync(shareFilePath, JSON.stringify(shareData, null, 2));
      console.log(`[API:share:${uniqueId}] 分享数据保存成功: ${shareFilePath}`);
      
      // 返回分享ID
      return NextResponse.json({
        success: true,
        shareId,
        message: "分享创建成功"
      });
      
    } catch (error) {
      console.error(`[API:share:${uniqueId}] 保存分享数据时出错:`, error);
      return NextResponse.json(
        { success: false, message: "服务器错误，无法保存分享数据" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("[API:share] 处理分享请求时出错:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
}

// 获取分享信息
export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || `get-share-${Date.now()}`;
  const isDebug = request.headers.get('x-debug') === 'true';
  const isClient = request.headers.get('x-client') === 'browser';
  const isForceFetch = request.nextUrl.searchParams.get('force') === 'true';
  
  try {
    const shareId = request.nextUrl.searchParams.get('id');
    
    console.log(`[API:share:${requestId}] 接收到获取分享请求: id=${shareId}, debug=${isDebug}, client=${isClient}, force=${isForceFetch}`);
    
    if (!shareId) {
      console.log(`[API:share:${requestId}] API请求缺少share ID参数`);
      return NextResponse.json({ 
        error: 'Missing share ID',
        requestId,
        timestamp: new Date().toISOString(),
        url: request.url,
        isDebug,
        isClient
      }, { status: 400 });
    }
    
    // 记录完整的请求信息用于调试
    if (isDebug) {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log(`[API:share:${requestId}] 请求详情:`, {
        url: request.url,
        method: request.method,
        headers: headers,
        params: Object.fromEntries(request.nextUrl.searchParams.entries()),
      });
    }
    
    // 首先从内存缓存中获取
    let shareInfo: ShareInfo | undefined = sharesCache.get(shareId);
    
    // 如果设置了force参数或在客户端模式下，尝试直接访问文件系统和R2
    if (isForceFetch || isClient) {
      console.log(`[API:share:${requestId}] 强制模式或客户端请求，绕过缓存`);
      shareInfo = undefined; // 清除缓存结果，强制重新获取
    }
    
    // 如果不在缓存中，从R2加载
    if (!shareInfo) {
      console.log(`[API:share:${requestId}] 分享不在内存缓存中，从R2加载`);
      const loadedInfo = await loadShareInfoFromR2(shareId);
      
      // 修复TypeScript问题，明确检查null
      if (loadedInfo === null) {
        console.log(`[API:share:${requestId}] R2中也未找到分享`);
        
        // 添加服务器环境信息用于诊断
        const envDebugInfo = isDebug ? {
          serverEnv: {
            cwd: process.cwd(),
            tmpExists: fs.existsSync(TMP_DIR),
            sharesExists: fs.existsSync(path.join(TMP_DIR, 'shares')),
            r2Configured: isR2Configured,
            nodeEnv: process.env.NODE_ENV,
            platform: process.platform,
            timestamp: Date.now()
          }
        } : {};
        
        return NextResponse.json({ 
          error: 'Share not found or expired',
          detail: 'The requested share link could not be found in our system',
          requestId,
          timestamp: new Date().toISOString(),
          ...envDebugInfo
        }, { 
          status: 404,
          headers: {
            'x-debug-info': 'share-not-found',
            'x-request-id': requestId,
            'x-timestamp': Date.now().toString()
          }
        });
      }
      
      shareInfo = loadedInfo;
      console.log(`[API:share:${requestId}] 从R2加载到分享信息`);
    } else {
      console.log(`[API:share:${requestId}] 从内存缓存中找到分享`);
    }
    
    // 检查是否过期
    if (shareInfo.expiresAt < Date.now()) {
      // 清理过期的分享
      await removeShareInfo(shareId);
      console.log(`[API:share:${requestId}] 分享已过期: ${shareId}, 过期时间: ${new Date(shareInfo.expiresAt).toISOString()}`);
      return NextResponse.json({ 
        error: 'Share link has expired', 
        expiresAt: new Date(shareInfo.expiresAt).toISOString(),
        currentTime: new Date().toISOString(),
        detail: 'The share link has expired. Shares are available for 24 hours after creation.',
        requestId,
        timestamp: Date.now()
      }, { 
        status: 410,
        headers: {
          'x-debug-info': 'share-expired',
          'x-request-id': requestId
        }
      });
    }
    
    // 生成R2预签名URL
    console.log(`[API:share:${requestId}] 为文件生成R2预签名URL: wav/${shareInfo.fileId}.wav`);
    let downloadUrl = `/api/convert?fileId=${shareInfo.fileId}`;
    
    try {
      // 检查文件是否存在于R2
      let fileInR2 = false;
      if (isR2Configured) {
        try {
          fileInR2 = await fileExistsInR2(`wav/${shareInfo.fileId}.wav`);
          console.log(`[API:share:${requestId}] 文件在R2中存在检查结果: ${fileInR2}`);
        } catch (r2Error) {
          console.error(`[API:share:${requestId}] 检查R2文件时出错:`, r2Error);
        }
      }
      
      // 检查文件是否存在于本地文件系统
      let fileInLocal = false;
      try {
        const localFilePath = path.join(TMP_DIR, `${shareInfo.fileId}.wav`);
        fileInLocal = fs.existsSync(localFilePath);
        console.log(`[API:share:${requestId}] 文件在本地文件系统中存在检查结果: ${fileInLocal}, 路径: ${localFilePath}`);
      } catch (fsError) {
        console.error(`[API:share:${requestId}] 检查本地文件时出错:`, fsError);
      }
      
      // 记录存储状态
      console.log(`[API:share:${requestId}] 文件存储状态: R2=${fileInR2}, 本地=${fileInLocal}`);
      
      if (!fileInR2 && !fileInLocal) {
        console.error(`[API:share:${requestId}] 文件在R2和本地都不存在: fileId=${shareInfo.fileId}`);
        return NextResponse.json({ 
          error: 'File not found',
          detail: 'The file associated with this share link could not be found in storage',
          fileId: shareInfo.fileId,
          requestId,
          storage: { r2: fileInR2, local: fileInLocal }
        }, { status: 404 });
      }
      
      if (fileInR2) {
        const presignedUrl = await generatePresignedUrl(`wav/${shareInfo.fileId}.wav`);
        if (presignedUrl) {
          downloadUrl = presignedUrl;
          console.log(`[API:share:${requestId}] 成功生成预签名URL`);
        } else {
          console.warn(`[API:share:${requestId}] 无法生成预签名URL，使用API回退URL`);
        }
      } else {
        console.log(`[API:share:${requestId}] R2文件不存在，使用API回退URL`);
      }
    } catch (error) {
      console.error(`[API:share:${requestId}] 生成预签名URL失败:`, error);
    }
    
    // 计算剩余有效时间（以分钟为单位）
    const remainingTimeMs = shareInfo.expiresAt - Date.now();
    const remainingMinutes = Math.max(0, Math.floor(remainingTimeMs / (1000 * 60)));
    
    console.log(`[API:share:${requestId}] 成功获取分享: ${shareId}, fileId: ${shareInfo.fileId}, 剩余时间: ${remainingMinutes}分钟`);
    
    // 添加调试信息（如果需要）
    const debugInfo = isDebug ? {
      debug: {
        cacheHit: !!sharesCache.get(shareId),
        r2Available: isR2Configured,
        requestId,
        serverTime: new Date().toISOString(),
        client: isClient,
        path: request.nextUrl.pathname + request.nextUrl.search,
        referer: request.headers.get('referer') || 'none'
      }
    } : {};
    
    return NextResponse.json({
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: downloadUrl,
      createdAt: new Date(shareInfo.createdAt).toISOString(),
      expiresAt: new Date(shareInfo.expiresAt).toISOString(),
      remainingMinutes: remainingMinutes,
      timestamp: Date.now(),
      ...debugInfo
    }, {
      headers: {
        'x-request-id': requestId,
        'x-timestamp': Date.now().toString(),
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error(`[API:share:${requestId}] 获取分享信息错误:`, error);
    return NextResponse.json({ 
      error: 'Failed to retrieve share information',
      detail: error.message || 'An unknown error occurred',
      requestId,
      timestamp: Date.now(),
      stack: isDebug ? error.stack : undefined
    }, { status: 500 });
  }
}

// 处理CORS预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-debug, x-request-id',
      'Access-Control-Max-Age': '86400'
    }
  });
} 
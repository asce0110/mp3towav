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
}

// 模拟数据库存储，使用内存缓存
const sharesCache = new Map<string, ShareInfo>();

// 临时文件目录
const TMP_DIR = path.join(process.cwd(), 'tmp');

// 检查环境
const isVercelEnv = process.env.VERCEL === '1';
console.log(`[API:share] 当前环境: ${isVercelEnv ? 'Vercel' : '本地开发'}`);
console.log(`[API:share] 当前工作目录: ${process.cwd()}`);
console.log(`[API:share] TMP_DIR 路径: ${TMP_DIR}`);
console.log(`[API:share] R2配置状态: isR2Configured=${isR2Configured}`);

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
    const requestId = request.headers.get('x-request-id') || `share-${Date.now()}`;
    console.log(`[API:share:${requestId}] 接收到创建分享请求`);
    
    const bodyText = await request.text();
    console.log(`[API:share:${requestId}] 请求体: ${bodyText}`);
    
    const { fileId, originalName, shareId } = JSON.parse(bodyText);
    
    if (!fileId) {
      console.error(`[API:share:${requestId}] 创建分享失败：缺少fileId参数`);
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }
    
    console.log(`[API:share:${requestId}] 创建分享: fileId=${fileId}, originalName=${originalName || '未指定'}`);
    
    // 检查R2是否已配置
    if (!isR2Configured) {
      console.error(`[API:share:${requestId}] R2未配置，无法创建分享`);
      return NextResponse.json({ 
        error: 'R2 storage not configured', 
        detail: 'Cloud storage is required for file sharing feature'
      }, { status: 500 });
    }
    
    // 检查R2连接
    try {
      console.log(`[API:share:${requestId}] 检查R2连接状态...`);
      const isConnected = await validateR2Connection();
      if (!isConnected) {
        console.error(`[API:share:${requestId}] R2连接失败，无法创建分享`);
        return NextResponse.json({ 
          error: 'R2 connection failed', 
          detail: 'Could not connect to cloud storage'
        }, { status: 500 });
      }
      console.log(`[API:share:${requestId}] R2连接测试成功`);
    } catch (r2Error) {
      console.error(`[API:share:${requestId}] R2连接测试异常:`, r2Error);
      return NextResponse.json({ 
        error: 'R2 connection test failed', 
        detail: 'Error testing connection to cloud storage',
        message: r2Error instanceof Error ? r2Error.message : String(r2Error)
      }, { status: 500 });
    }
    
    // 检查文件是否存在于R2
    console.log(`[API:share:${requestId}] 检查文件是否存在于R2: wav/${fileId}.wav`);
    let fileExists = false;
    
    try {
      fileExists = await fileExistsInR2(`wav/${fileId}.wav`);
      if (!fileExists) {
        console.log(`[API:share:${requestId}] 文件不存在于R2: wav/${fileId}.wav, 尝试检查本地文件...`);
        
        // 检查本地文件并上传到R2
        const localFilePath = path.join(TMP_DIR, `${fileId}.wav`);
        if (fs.existsSync(localFilePath)) {
          console.log(`[API:share:${requestId}] 找到本地文件: ${localFilePath}, 尝试上传到R2...`);
          
          // 读取文件并上传到R2
          const fileBuffer = fs.readFileSync(localFilePath);
          console.log(`[API:share:${requestId}] 读取本地文件成功，大小: ${fileBuffer.length} 字节`);
          
          const uploadSuccess = await uploadToR2(
            `wav/${fileId}.wav`,
            fileBuffer,
            {
              'source': 'local-file',
              'original-name': originalName || `${fileId}.wav`,
              'request-id': requestId
            },
            'audio/wav'
          );
          
          if (uploadSuccess) {
            console.log(`[API:share:${requestId}] 文件成功上传到R2: wav/${fileId}.wav`);
            fileExists = true;
          } else {
            console.error(`[API:share:${requestId}] 上传文件到R2失败: wav/${fileId}.wav`);
          }
        } else {
          console.error(`[API:share:${requestId}] 本地文件也不存在: ${localFilePath}`);
          
          // 检查TMP目录下的文件
          try {
            const tmpFiles = fs.readdirSync(TMP_DIR);
            console.log(`[API:share:${requestId}] TMP目录内容: ${tmpFiles.length > 0 ? tmpFiles.join(', ') : '空目录'}`);
          } catch (e) {
            console.error(`[API:share:${requestId}] 无法读取TMP目录内容:`, e);
          }
        }
      } else {
        console.log(`[API:share:${requestId}] 文件存在于R2: wav/${fileId}.wav`);
      }
    } catch (error) {
      console.error(`[API:share:${requestId}] 检查文件时出错:`, error);
    }
    
    if (!fileExists) {
      console.error(`[API:share:${requestId}] 创建分享失败: 文件不存在 fileId=${fileId}`);
      return NextResponse.json({ 
        error: 'File not found',
        detail: 'The file you are trying to share could not be found in storage'
      }, { status: 404 });
    }
    
    // 使用提供的shareId或生成一个新的
    const finalShareId = shareId || Math.random().toString(36).substring(2, 10);
    
    // 计算过期时间（24小时后）
    const now = Date.now();
    const expiresAt = now + (1000 * 60 * 60 * 24);
    
    // 创建分享信息
    const shareInfo: ShareInfo = {
      fileId,
      originalName: originalName || `${fileId}.wav`,
      createdAt: now,
      expiresAt: expiresAt
    };
    
    console.log(`[API:share:${requestId}] 准备保存分享信息到R2: shareId=${finalShareId}`);
    
    // 保存分享信息到R2
    const saveSuccess = await saveShareInfoToR2(finalShareId, shareInfo);
    if (!saveSuccess) {
      console.error(`[API:share:${requestId}] 保存分享信息到R2失败: shareId=${finalShareId}`);
      return NextResponse.json({ 
        error: 'Failed to save share information',
        detail: 'Could not save share metadata to storage'
      }, { status: 500 });
    }
    
    const shareUrl = `${request.nextUrl.origin}/share/${finalShareId}`;
    console.log(`[API:share:${requestId}] 分享创建成功: shareId=${finalShareId}, url=${shareUrl}`);
    
    return NextResponse.json({
      success: true,
      shareId: finalShareId,
      shareUrl: shareUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      storageType: 'R2'
    });
  } catch (error) {
    console.error('[API:share] Share creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create share link',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
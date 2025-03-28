import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isR2Configured, fileExistsInR2, generatePresignedUrl, validateR2Connection } from '@/lib/r2';

// 定义共享文件的数据结构
interface ShareInfo {
  fileId: string;
  originalName: string;
  createdAt: number;
  expiresAt: number;
}

// 使用内存存储作为缓存，加快访问速度
const sharesCache = new Map<string, ShareInfo>();

// 临时文件和分享信息存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 确保目录存在
function ensureDirectoriesExist() {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      console.log(`创建临时目录: ${TMP_DIR}`);
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(SHARES_DIR)) {
      console.log(`创建分享目录: ${SHARES_DIR}`);
      fs.mkdirSync(SHARES_DIR, { recursive: true });
    }
    
    // 验证目录权限
    const testFile = path.join(SHARES_DIR, '.test_write_permission');
    try {
      // 尝试写入测试文件
      fs.writeFileSync(testFile, 'test');
      // 成功写入，删除测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (writeError) {
      console.error(`目录写入权限测试失败: ${writeError}`);
      throw new Error(`没有目录写入权限: ${SHARES_DIR}`);
    }
  } catch (error) {
    console.error(`确保目录存在时出错:`, error);
    throw error;
  }
}

// 从文件系统加载分享信息
function loadShareInfo(shareId: string): ShareInfo | null {
  try {
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (!fs.existsSync(sharePath)) {
      return null;
    }
    
    const shareData = fs.readFileSync(sharePath, 'utf-8');
    const shareInfo = JSON.parse(shareData) as ShareInfo;
    
    // 缓存到内存
    sharesCache.set(shareId, shareInfo);
    
    return shareInfo;
  } catch (error) {
    console.error(`Error loading share info for ${shareId}:`, error);
    return null;
  }
}

// 保存分享信息到文件系统
function saveShareInfo(shareId: string, shareInfo: ShareInfo) {
  try {
    ensureDirectoriesExist();
    
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    fs.writeFileSync(sharePath, JSON.stringify(shareInfo), 'utf-8');
    
    // 缓存到内存
    sharesCache.set(shareId, shareInfo);
    
    // 设置到期自动删除
    const expiryTimeMs = shareInfo.expiresAt - Date.now();
    if (expiryTimeMs > 0) {
      setTimeout(() => {
        removeShareInfo(shareId);
      }, expiryTimeMs);
    }
  } catch (error) {
    console.error(`Error saving share info for ${shareId}:`, error);
  }
}

// 从文件系统和内存缓存中删除分享信息
function removeShareInfo(shareId: string) {
  try {
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (fs.existsSync(sharePath)) {
      fs.unlinkSync(sharePath);
    }
    sharesCache.delete(shareId);
    console.log(`分享链接已过期并移除: ${shareId}`);
  } catch (error) {
    console.error(`Error removing share info for ${shareId}:`, error);
  }
}

// 创建分享链接
export async function POST(request: NextRequest) {
  try {
    const { fileId, originalName, shareId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }
    
    console.log(`创建分享: fileId=${fileId}, originalName=${originalName || '未指定'}`);
    
    // 如果R2可用，检查连接状态
    if (isR2Configured) {
      try {
        console.log('检查R2连接状态...');
        const isConnected = await validateR2Connection();
        if (!isConnected) {
          console.warn('R2连接失败，将使用本地存储');
        } else {
          console.log('R2连接成功，将使用R2存储');
        }
      } catch (r2Error) {
        console.error('R2连接测试异常:', r2Error);
      }
    }
    
    // 检查文件是否存在 (首先检查R2，然后检查本地)
    let fileExists = false;
    let storageType = '未知';
    
    if (isR2Configured) {
      // 检查文件是否存在于R2
      console.log(`检查文件是否存在于R2: wav/${fileId}.wav`);
      try {
        fileExists = await fileExistsInR2(`wav/${fileId}.wav`);
        if (fileExists) {
          console.log(`文件存在于R2: wav/${fileId}.wav`);
          storageType = 'R2';
        } else {
          console.log(`文件不存在于R2: wav/${fileId}.wav`);
        }
      } catch (r2Error) {
        console.error('检查R2文件时出错:', r2Error);
      }
    }
    
    // 如果不在R2中或R2不可用，检查本地文件系统
    if (!fileExists) {
      const filePath = path.join(TMP_DIR, `${fileId}.wav`);
      try {
        fileExists = fs.existsSync(filePath);
        if (fileExists) {
          console.log(`文件存在于本地: ${filePath}`);
          const stats = fs.statSync(filePath);
          console.log(`文件大小: ${stats.size}字节, 创建时间: ${stats.birthtime}`);
          storageType = '本地';
        } else {
          console.log(`文件不存在于本地: ${filePath}`);
        }
      } catch (fsError) {
        console.error('检查本地文件时出错:', fsError);
      }
    }
    
    if (!fileExists) {
      console.error(`创建分享失败: 文件不存在 fileId=${fileId}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
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
    
    console.log(`准备保存分享信息: shareId=${finalShareId}, storageType=${storageType}`);
    
    // 存储分享信息到文件系统
    try {
      saveShareInfo(finalShareId, shareInfo);
      console.log(`成功保存分享信息: shareId=${finalShareId}`);
    } catch (saveError) {
      console.error(`保存分享信息失败: shareId=${finalShareId}`, saveError);
      return NextResponse.json({ error: 'Failed to save share information' }, { status: 500 });
    }
    
    const shareUrl = `${request.nextUrl.origin}/share/${finalShareId}`;
    console.log(`分享创建成功: shareId=${finalShareId}, url=${shareUrl}`);
    
    return NextResponse.json({
      success: true,
      shareId: finalShareId,
      shareUrl: shareUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      storageType
    });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

// 获取分享信息
export async function GET(request: NextRequest) {
  try {
    const shareId = request.nextUrl.searchParams.get('id');
    
    if (!shareId) {
      console.log('API请求缺少share ID参数');
      return NextResponse.json({ error: 'Missing share ID' }, { status: 400 });
    }
    
    console.log(`API: 获取分享 ID=${shareId}`);
    
    // 首先从内存缓存中获取
    let shareInfo = sharesCache.get(shareId);
    
    // 如果不在缓存中，从文件系统加载
    if (!shareInfo) {
      console.log(`API: 分享不在内存缓存中，从文件系统加载`);
      const loadedShareInfo = loadShareInfo(shareId);
      if (loadedShareInfo) {
        shareInfo = loadedShareInfo;
      } else {
        console.log(`API: 文件系统中也未找到分享`);
      }
    } else {
      console.log(`API: 从内存缓存中找到分享`);
    }
    
    // 检查是否存在
    if (!shareInfo) {
      console.log(`API: 分享未找到: ${shareId}`);
      return NextResponse.json({ 
        error: 'Share not found or expired',
        detail: 'The requested share link could not be found in our system'
      }, { status: 404 });
    }
    
    // 检查是否过期
    if (shareInfo.expiresAt < Date.now()) {
      // 清理过期的分享
      removeShareInfo(shareId);
      console.log(`API: 分享已过期: ${shareId}, 过期时间: ${new Date(shareInfo.expiresAt).toISOString()}`);
      return NextResponse.json({ 
        error: 'Share link has expired', 
        expiresAt: new Date(shareInfo.expiresAt).toISOString(),
        currentTime: new Date().toISOString(),
        detail: 'The share link has expired. Shares are available for 24 hours after creation.'
      }, { status: 410 });
    }
    
    // 确定下载URL
    let downloadUrl = `/api/convert?fileId=${shareInfo.fileId}`;
    console.log(`API: 使用默认下载URL: ${downloadUrl}`);
    
    // 如果R2可用，生成预签名URL
    if (isR2Configured) {
      try {
        console.log(`API: 尝试从R2生成预签名URL`);
        const presignedUrl = await generatePresignedUrl(`wav/${shareInfo.fileId}.wav`);
        if (presignedUrl) {
          downloadUrl = presignedUrl;
          console.log(`API: 生成了R2预签名URL`);
        } else {
          console.log(`API: 从R2生成预签名URL失败，使用默认URL`);
        }
      } catch (r2Error) {
        console.error(`API: 生成R2预签名URL错误:`, r2Error);
      }
    } else {
      console.log(`API: R2未配置，使用本地文件存储`);
      // 如果使用本地存储，检查文件是否存在
      const filePath = path.join(TMP_DIR, `${shareInfo.fileId}.wav`);
      if (!fs.existsSync(filePath)) {
        // 清理失效的分享
        removeShareInfo(shareId);
        console.log(`API: 文件不存在: ${shareId}, 文件: ${shareInfo.fileId}.wav`);
        return NextResponse.json({ 
          error: 'File not available anymore',
          detail: 'The file associated with this share link no longer exists on our servers'
        }, { status: 410 });
      } else {
        console.log(`API: 找到分享文件: ${shareId}, 文件: ${shareInfo.fileId}.wav, 大小: ${fs.statSync(filePath).size} bytes`);
      }
    }
    
    // 计算剩余有效时间（以分钟为单位）
    const remainingTimeMs = shareInfo.expiresAt - Date.now();
    const remainingMinutes = Math.max(0, Math.floor(remainingTimeMs / (1000 * 60)));
    
    console.log(`API: 成功获取分享: ${shareId}, fileId: ${shareInfo.fileId}, 剩余时间: ${remainingMinutes}分钟`);
    
    return NextResponse.json({
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: downloadUrl,
      createdAt: new Date(shareInfo.createdAt).toISOString(),
      expiresAt: new Date(shareInfo.expiresAt).toISOString(),
      remainingMinutes: remainingMinutes
    });
  } catch (error: any) {
    console.error('API: 获取分享信息错误:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve share information',
      detail: error.message || 'An unknown error occurred' 
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
} 
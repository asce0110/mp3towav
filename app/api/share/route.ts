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

// 模拟数据库存储，使用内存缓存
const sharesCache = new Map<string, ShareInfo>();

// Vercel内部存储 - 服务器端组件共享此变量，但每次部署会重置
let serverShares: Record<string, ShareInfo> = {};

// 临时文件和分享信息存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 检查Vercel环境
const isVercelEnv = process.env.VERCEL === '1';
console.log(`当前环境: ${isVercelEnv ? 'Vercel' : '本地开发'}`);
console.log(`当前工作目录: ${process.cwd()}`);
console.log(`TMP_DIR 路径: ${TMP_DIR}`);
console.log(`SHARES_DIR 路径: ${SHARES_DIR}`);

// 在应用启动时确保目录存在
function ensureDirectoriesExist() {
  try {
    // 确保临时目录存在
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      console.log(`创建临时目录: ${TMP_DIR}`);
    } else {
      console.log(`临时目录已存在: ${TMP_DIR}`);
      try {
        // 列出目录内容
        const files = fs.readdirSync(TMP_DIR);
        console.log(`TMP_DIR内容: ${files.length > 0 ? files.join(', ') : '空目录'}`);
      } catch (e) {
        console.error(`无法读取TMP_DIR内容:`, e);
      }
    }
    
    // 确保分享信息目录存在
    if (!fs.existsSync(SHARES_DIR)) {
      fs.mkdirSync(SHARES_DIR, { recursive: true });
      console.log(`创建分享目录: ${SHARES_DIR}`);
    } else {
      console.log(`分享目录已存在: ${SHARES_DIR}`);
      try {
        // 列出目录内容
        const files = fs.readdirSync(SHARES_DIR);
        console.log(`SHARES_DIR内容: ${files.length > 0 ? files.join(', ') : '空目录'}`);
      } catch (e) {
        console.error(`无法读取SHARES_DIR内容:`, e);
      }
    }
    
    // 在Vercel环境做额外测试
    if (isVercelEnv) {
      console.log(`在Vercel环境进行目录写入测试`);
      const testFile = path.join(TMP_DIR, '_test_write.txt');
      try {
        fs.writeFileSync(testFile, `Test file created at ${new Date().toISOString()}`);
        console.log(`测试文件写入成功: ${testFile}`);
        
        // 验证文件存在
        if (fs.existsSync(testFile)) {
          const content = fs.readFileSync(testFile, 'utf8');
          console.log(`测试文件内容: ${content.substring(0, 30)}...`);
          
          // 尝试删除测试文件
          fs.unlinkSync(testFile);
          console.log(`测试文件删除成功`);
        } else {
          console.error(`测试文件写入后无法验证存在: ${testFile}`);
        }
      } catch (e) {
        console.error(`Vercel环境文件写入测试失败:`, e);
      }
    }
  } catch (error) {
    console.error('创建必要目录失败:', error);
  }
}

// 立即执行确保目录存在
ensureDirectoriesExist();

// 从数据存储加载分享信息
function loadShareInfo(shareId: string): ShareInfo | null {
  console.log(`尝试加载分享信息: ${shareId}`);
  
  // 首先从内存缓存检查
  if (sharesCache.has(shareId)) {
    console.log(`从内存缓存加载分享: ${shareId}`);
    return sharesCache.get(shareId) || null;
  }
  
  // 然后从服务器变量检查
  if (serverShares[shareId]) {
    console.log(`从服务器变量加载分享: ${shareId}`);
    const shareInfo = serverShares[shareId];
    // 更新内存缓存
    sharesCache.set(shareId, shareInfo);
    return shareInfo;
  }
  
  // 最后从文件系统检查
  try {
    console.log(`尝试从文件系统加载分享: ${shareId}`);
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (!fs.existsSync(sharePath)) {
      console.log(`文件系统中不存在分享文件: ${sharePath}`);
      return null;
    }
    
    const shareData = fs.readFileSync(sharePath, 'utf-8');
    console.log(`已读取分享文件内容: ${shareData.substring(0, 50)}...`);
    
    try {
      const shareInfo = JSON.parse(shareData) as ShareInfo;
      
      // 更新缓存
      sharesCache.set(shareId, shareInfo);
      serverShares[shareId] = shareInfo;
      
      console.log(`成功从文件加载并解析分享: ${shareId}`);
      return shareInfo;
    } catch (parseError) {
      console.error(`解析分享JSON失败: ${shareId}`, parseError);
      return null;
    }
  } catch (error) {
    console.error(`从文件系统加载分享失败: ${shareId}`, error);
    return null;
  }
}

// 保存分享信息到存储
function saveShareInfo(shareId: string, shareInfo: ShareInfo) {
  console.log(`正在保存分享信息: ${shareId}`);
  
  // 同时保存到所有存储位置
  
  // 1. 内存缓存
  sharesCache.set(shareId, shareInfo);
  
  // 2. 服务器变量
  serverShares[shareId] = shareInfo;
  console.log(`分享已保存到服务器变量: ${shareId}`);
  
  // 3. 文件系统 (尽最大努力，但可能在Vercel上不可靠)
  try {
    ensureDirectoriesExist();
    
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    const shareData = JSON.stringify(shareInfo);
    
    console.log(`尝试保存分享到文件: ${sharePath}`);
    fs.writeFileSync(sharePath, shareData, 'utf-8');
    
    if (fs.existsSync(sharePath)) {
      console.log(`分享文件已成功写入: ${sharePath}`);
    } else {
      console.warn(`分享文件写入后无法验证存在: ${sharePath}`);
    }
  } catch (error) {
    console.warn(`保存分享到文件系统失败 (非致命错误): ${shareId}`, error);
    // 不抛出错误，因为我们仍然有内存缓存和服务器变量
  }
  
  return true;
}

// 从所有存储中删除分享信息
function removeShareInfo(shareId: string) {
  console.log(`删除分享: ${shareId}`);
  
  // 从内存缓存删除
  sharesCache.delete(shareId);
  
  // 从服务器变量删除
  delete serverShares[shareId];
  
  // 从文件系统删除
  try {
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (fs.existsSync(sharePath)) {
      fs.unlinkSync(sharePath);
      console.log(`分享文件已从文件系统删除: ${sharePath}`);
    }
  } catch (error) {
    console.warn(`从文件系统删除分享失败 (非致命错误): ${shareId}`, error);
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
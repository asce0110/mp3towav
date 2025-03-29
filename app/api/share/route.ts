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
console.log(`当前环境: ${isVercelEnv ? 'Vercel' : '本地开发'}`);
console.log(`当前工作目录: ${process.cwd()}`);
console.log(`TMP_DIR 路径: ${TMP_DIR}`);

// 确保临时目录存在
function ensureTmpDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      console.log(`创建临时目录: ${TMP_DIR}`);
    }
  } catch (error) {
    console.error('创建临时目录失败:', error);
  }
}

// 立即执行确保临时目录存在
ensureTmpDir();

// 从R2加载分享信息
async function loadShareInfoFromR2(shareId: string): Promise<ShareInfo | null> {
  console.log(`尝试从R2加载分享数据: ${shareId}`);
  
  if (!isR2Configured) {
    console.log(`R2未配置，无法从R2加载分享`);
    return null;
  }
  
  try {
    // 检查分享数据在R2中是否存在
    const shareExists = await fileExistsInR2(`shares/${shareId}.json`);
    if (!shareExists) {
      console.log(`R2中不存在分享数据: ${shareId}`);
      return null;
    }
    
    // 下载分享数据
    const shareBuffer = await downloadFromR2(`shares/${shareId}.json`);
    if (!shareBuffer) {
      console.log(`从R2下载分享数据失败: ${shareId}`);
      return null;
    }
    
    // 解析分享数据
    try {
      const shareData = shareBuffer.toString('utf-8');
      console.log(`解析分享数据: ${shareData.substring(0, 50)}...`);
      const shareInfo = JSON.parse(shareData) as ShareInfo;
      
      // 添加到内存缓存
      sharesCache.set(shareId, shareInfo);
      
      return shareInfo;
    } catch (parseError) {
      console.error(`解析分享数据JSON失败:`, parseError);
      return null;
    }
  } catch (error) {
    console.error(`从R2加载分享数据时出错:`, error);
    return null;
  }
}

// 保存分享信息到R2
async function saveShareInfoToR2(shareId: string, shareInfo: ShareInfo): Promise<boolean> {
  console.log(`尝试保存分享数据到R2: ${shareId}`);
  
  if (!isR2Configured) {
    console.log(`R2未配置，无法保存分享到R2`);
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
      console.log(`分享数据成功保存到R2: ${shareId}`);
      return true;
    } else {
      console.error(`保存分享数据到R2失败: ${shareId}`);
      return false;
    }
  } catch (error) {
    console.error(`保存分享数据到R2时出错:`, error);
    return false;
  }
}

// 从所有存储中删除分享信息
async function removeShareInfo(shareId: string): Promise<void> {
  console.log(`删除分享: ${shareId}`);
  
  // 从内存缓存删除
  sharesCache.delete(shareId);
  
  // 从R2删除
  if (isR2Configured) {
    try {
      await uploadToR2(`shares/${shareId}.json`, Buffer.from('{"deleted":true}'), { 
        'deleted': 'true',
        'deleted-at': new Date().toISOString()
      });
      console.log(`已将分享标记为已删除: ${shareId}`);
    } catch (error) {
      console.warn(`标记分享为已删除失败: ${shareId}`, error);
    }
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
    
    // 检查R2是否已配置
    if (!isR2Configured) {
      console.error('R2未配置，无法创建分享');
      return NextResponse.json({ 
        error: 'R2 storage not configured', 
        detail: 'Cloud storage is required for file sharing feature'
      }, { status: 500 });
    }
    
    // 检查R2连接
    try {
      console.log('检查R2连接状态...');
      const isConnected = await validateR2Connection();
      if (!isConnected) {
        console.error('R2连接失败，无法创建分享');
        return NextResponse.json({ 
          error: 'R2 connection failed', 
          detail: 'Could not connect to cloud storage'
        }, { status: 500 });
      }
    } catch (r2Error) {
      console.error('R2连接测试异常:', r2Error);
      return NextResponse.json({ 
        error: 'R2 connection test failed', 
        detail: 'Error testing connection to cloud storage'
      }, { status: 500 });
    }
    
    // 检查文件是否存在于R2
    console.log(`检查文件是否存在于R2: wav/${fileId}.wav`);
    let fileExists = false;
    
    try {
      fileExists = await fileExistsInR2(`wav/${fileId}.wav`);
      if (!fileExists) {
        console.log(`文件不存在于R2: wav/${fileId}.wav, 尝试检查本地文件...`);
        
        // 检查本地文件并上传到R2
        const localFilePath = path.join(TMP_DIR, `${fileId}.wav`);
        if (fs.existsSync(localFilePath)) {
          console.log(`找到本地文件: ${localFilePath}, 尝试上传到R2...`);
          
          // 读取文件并上传到R2
          const fileBuffer = fs.readFileSync(localFilePath);
          const uploadSuccess = await uploadToR2(
            `wav/${fileId}.wav`,
            fileBuffer,
            {
              'source': 'local-file',
              'original-name': originalName || `${fileId}.wav`
            },
            'audio/wav'
          );
          
          if (uploadSuccess) {
            console.log(`文件成功上传到R2: wav/${fileId}.wav`);
            fileExists = true;
          } else {
            console.error(`上传文件到R2失败: wav/${fileId}.wav`);
          }
        } else {
          console.error(`本地文件也不存在: ${localFilePath}`);
        }
      } else {
        console.log(`文件存在于R2: wav/${fileId}.wav`);
      }
    } catch (error) {
      console.error('检查文件时出错:', error);
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
    
    console.log(`准备保存分享信息到R2: shareId=${finalShareId}`);
    
    // 保存分享信息到R2
    const saveSuccess = await saveShareInfoToR2(finalShareId, shareInfo);
    if (!saveSuccess) {
      console.error(`保存分享信息到R2失败: shareId=${finalShareId}`);
      return NextResponse.json({ error: 'Failed to save share information' }, { status: 500 });
    }
    
    const shareUrl = `${request.nextUrl.origin}/share/${finalShareId}`;
    console.log(`分享创建成功: shareId=${finalShareId}, url=${shareUrl}`);
    
    return NextResponse.json({
      success: true,
      shareId: finalShareId,
      shareUrl: shareUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      storageType: 'R2'
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
    
    // 如果不在缓存中，从R2加载
    if (!shareInfo) {
      console.log(`API: 分享不在内存缓存中，从R2加载`);
      shareInfo = await loadShareInfoFromR2(shareId);
      if (!shareInfo) {
        console.log(`API: R2中也未找到分享`);
        return NextResponse.json({ 
          error: 'Share not found or expired',
          detail: 'The requested share link could not be found in our system'
        }, { status: 404 });
      }
    } else {
      console.log(`API: 从内存缓存中找到分享`);
    }
    
    // 检查是否过期
    if (shareInfo.expiresAt < Date.now()) {
      // 清理过期的分享
      await removeShareInfo(shareId);
      console.log(`API: 分享已过期: ${shareId}, 过期时间: ${new Date(shareInfo.expiresAt).toISOString()}`);
      return NextResponse.json({ 
        error: 'Share link has expired', 
        expiresAt: new Date(shareInfo.expiresAt).toISOString(),
        currentTime: new Date().toISOString(),
        detail: 'The share link has expired. Shares are available for 24 hours after creation.'
      }, { status: 410 });
    }
    
    // 生成R2预签名URL
    console.log(`API: 为文件生成R2预签名URL: wav/${shareInfo.fileId}.wav`);
    let downloadUrl = `/api/convert?fileId=${shareInfo.fileId}`;
    
    try {
      const presignedUrl = await generatePresignedUrl(`wav/${shareInfo.fileId}.wav`);
      if (presignedUrl) {
        downloadUrl = presignedUrl;
        console.log(`API: 成功生成预签名URL`);
      } else {
        console.warn(`API: 无法生成预签名URL，使用API回退URL`);
      }
    } catch (error) {
      console.error(`API: 生成预签名URL失败:`, error);
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
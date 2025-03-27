import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isR2Configured, fileExistsInR2, generatePresignedUrl } from '@/lib/r2';

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
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHARES_DIR)) {
    fs.mkdirSync(SHARES_DIR, { recursive: true });
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
    setTimeout(() => {
      removeShareInfo(shareId);
    }, shareInfo.expiresAt - Date.now());
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
    
    // 检查文件是否存在 (首先检查R2，然后检查本地)
    let fileExists = false;
    
    if (isR2Configured) {
      // 检查文件是否存在于R2
      fileExists = await fileExistsInR2(`wav/${fileId}.wav`);
    }
    
    // 如果不在R2中或R2不可用，检查本地文件系统
    if (!fileExists) {
      const filePath = path.join(TMP_DIR, `${fileId}.wav`);
      fileExists = fs.existsSync(filePath);
    }
    
    if (!fileExists) {
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
    
    // 存储分享信息到文件系统
    saveShareInfo(finalShareId, shareInfo);
    
    return NextResponse.json({
      success: true,
      shareId: finalShareId,
      shareUrl: `${request.nextUrl.origin}/share/${finalShareId}`,
      expiresAt: new Date(expiresAt).toISOString()
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
      return NextResponse.json({ error: 'Missing share ID' }, { status: 400 });
    }
    
    // 首先从内存缓存中获取
    let shareInfo = sharesCache.get(shareId);
    
    // 如果不在缓存中，从文件系统加载
    if (!shareInfo) {
      shareInfo = loadShareInfo(shareId);
    }
    
    // 检查是否存在
    if (!shareInfo) {
      console.log(`Share not found: ${shareId}`);
      return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 });
    }
    
    // 检查是否过期
    if (Date.now() > shareInfo.expiresAt) {
      // 清理过期的分享
      removeShareInfo(shareId);
      console.log(`Share expired: ${shareId}`);
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }
    
    // 确定下载URL
    let downloadUrl = `/api/convert?fileId=${shareInfo.fileId}`;
    
    // 如果R2可用，生成预签名URL
    if (isR2Configured) {
      const presignedUrl = await generatePresignedUrl(`wav/${shareInfo.fileId}.wav`);
      if (presignedUrl) {
        downloadUrl = presignedUrl;
      }
    } else {
      // 如果使用本地存储，检查文件是否存在
      const filePath = path.join(TMP_DIR, `${shareInfo.fileId}.wav`);
      if (!fs.existsSync(filePath)) {
        // 清理失效的分享
        removeShareInfo(shareId);
        console.log(`File not found for share: ${shareId}, file: ${shareInfo.fileId}.wav`);
        return NextResponse.json({ error: 'File not available anymore' }, { status: 410 });
      } else {
        console.log(`File found for share: ${shareId}, file: ${shareInfo.fileId}.wav`);
      }
    }
    
    // 添加调试日志
    console.log(`Successfully retrieved share: ${shareId}, fileId: ${shareInfo.fileId}`);
    
    return NextResponse.json({
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: downloadUrl,
      createdAt: new Date(shareInfo.createdAt).toISOString(),
      expiresAt: new Date(shareInfo.expiresAt).toISOString()
    });
  } catch (error) {
    console.error('Share retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve share information' }, { status: 500 });
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
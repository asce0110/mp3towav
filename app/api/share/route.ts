import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isR2Configured, fileExistsInR2, generatePresignedUrl } from '@/lib/r2';

// 模拟数据库存储分享信息
const shares = new Map<string, {
  fileId: string,
  originalName: string,
  createdAt: number,
  expiresAt: number
}>();

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');

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
    
    // 存储分享信息
    shares.set(finalShareId, {
      fileId,
      originalName: originalName || `${fileId}.wav`,
      createdAt: now,
      expiresAt: expiresAt
    });
    
    // 链接过期时间（24小时）
    setTimeout(() => {
      shares.delete(finalShareId);
      console.log(`分享链接已过期并移除: ${finalShareId}`);
    }, 1000 * 60 * 60 * 24);
    
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
    
    const shareInfo = shares.get(shareId);
    
    if (!shareInfo) {
      return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 });
    }
    
    // 检查是否过期
    if (Date.now() > shareInfo.expiresAt) {
      // 清理过期的分享
      shares.delete(shareId);
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
        shares.delete(shareId);
        return NextResponse.json({ error: 'File not available anymore' }, { status: 410 });
      }
    }
    
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
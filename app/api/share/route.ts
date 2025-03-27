import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 模拟数据库存储分享信息
const shares = new Map<string, {
  fileId: string,
  originalName: string,
  createdAt: number
}>();

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');

// 创建分享链接
export async function POST(request: NextRequest) {
  try {
    const { fileId, originalName } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }
    
    const filePath = path.join(TMP_DIR, `${fileId}.wav`);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // 生成一个简单的分享ID（实际应用可能需要更复杂的生成逻辑）
    const shareId = Math.random().toString(36).substring(2, 10);
    
    // 存储分享信息
    shares.set(shareId, {
      fileId,
      originalName: originalName || `${fileId}.wav`,
      createdAt: Date.now()
    });
    
    // 链接过期时间（24小时）
    setTimeout(() => {
      shares.delete(shareId);
    }, 1000 * 60 * 60 * 24);
    
    return NextResponse.json({
      success: true,
      shareId,
      shareUrl: `${request.nextUrl.origin}/share/${shareId}`
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
    
    // 检查文件是否仍然存在
    const filePath = path.join(TMP_DIR, `${shareInfo.fileId}.wav`);
    
    if (!fs.existsSync(filePath)) {
      // 清理失效的分享
      shares.delete(shareId);
      return NextResponse.json({ error: 'File not available anymore' }, { status: 410 });
    }
    
    return NextResponse.json({
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: `/api/convert?fileId=${shareInfo.fileId}`
    });
  } catch (error) {
    console.error('Share retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve share information' }, { status: 500 });
  }
} 
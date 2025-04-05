import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 目录定义
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 确保目录存在
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

if (!fs.existsSync(SHARES_DIR)) {
  fs.mkdirSync(SHARES_DIR, { recursive: true });
}

// 获取分享数据的接口
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 正确处理异步 params
    const { id: shareId } = params;
    console.log(`[API:get-share] 获取分享数据: ID=${shareId}`);
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'Missing share ID', success: false },
        { status: 400 }
      );
    }
    
    // 确保目录存在
    if (!fs.existsSync(SHARES_DIR)) {
      fs.mkdirSync(SHARES_DIR, { recursive: true });
    }
    
    // 从文件系统读取分享数据
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    console.log(`[API:get-share] 尝试从路径读取: ${sharePath}`);
    
    if (!fs.existsSync(sharePath)) {
      console.log(`[API:get-share] 文件未找到: ${sharePath}`);
      return NextResponse.json(
        { error: 'Share not found', success: false },
        { status: 404 }
      );
    }
    
    try {
      const shareData = fs.readFileSync(sharePath, 'utf-8');
      const shareInfo = JSON.parse(shareData);
      
      // 检查是否过期
      const now = Date.now();
      const createdAt = new Date(shareInfo.createdAt).getTime();
      const expiresAt = createdAt + (24 * 60 * 60 * 1000); // 24小时后过期
      
      if (expiresAt && now > expiresAt) {
        console.log(`[API:get-share] 分享已过期: ${shareId}`);
        return NextResponse.json(
          { error: 'Share has expired', success: false },
          { status: 410 } // 410 Gone
        );
      }
      
      console.log(`[API:get-share] 成功获取分享数据: ${shareId}`);
      
      // 如果是本地文件路径，需要特殊处理
      if (shareInfo.isLocalFile) {
        // 对于本地文件，需要确保文件存在，并返回本地文件的访问路径
        const localFilePath = path.join(TMP_DIR, `${shareInfo.fileId}.wav`);
        
        if (!fs.existsSync(localFilePath)) {
          console.log(`[API:get-share] 本地文件不存在: ${localFilePath}`);
          // 如果本地文件不存在，但fileUrl可能仍然有效（例如R2 URL）
          if (!shareInfo.fileUrl) {
            return NextResponse.json(
              { error: 'File not found', success: false },
              { status: 404 }
            );
          }
        }
      }
      
      // 确保文件名属性存在
      if (!shareInfo.fileName && shareInfo.originalName) {
        shareInfo.fileName = shareInfo.originalName;
      } else if (!shareInfo.fileName && !shareInfo.originalName) {
        shareInfo.fileName = `${shareInfo.fileId}.wav`;
      }
      
      // 返回分享数据，添加过期时间
      return NextResponse.json({ 
        ...shareInfo, 
        expiresAt: new Date(expiresAt).toISOString(),
        success: true 
      });
    } catch (readError: any) {
      console.error(`[API:get-share] 读取或解析分享文件失败:`, readError);
      return NextResponse.json(
        { error: 'Invalid share data', success: false },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[API:get-share] 处理请求时出错:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error', success: false },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// 本地存储的文件目录
const LOCAL_FILES_DIR = path.join(process.cwd(), 'tmp', 'local-files');

/**
 * 本地文件API路由
 * 这是专门为开发环境创建的路由，用于在本地服务WAV文件，避免R2上传
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileId = params.id;

  console.log(`[本地文件API] 请求文件: ${fileId}`);

  // 确保目录存在
  if (!fs.existsSync(LOCAL_FILES_DIR)) {
    fs.mkdirSync(LOCAL_FILES_DIR, { recursive: true });
    console.log(`[本地文件API] 创建本地文件目录: ${LOCAL_FILES_DIR}`);
  }

  // 检查文件是否存在于会话存储中
  const sessionKey = `local_file_${fileId}`;
  
  try {
    // 检查文件是否存在于临时目录
    const filePath = path.join(LOCAL_FILES_DIR, `${fileId}.wav`);
    
    if (fs.existsSync(filePath)) {
      console.log(`[本地文件API] 找到文件: ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      
      // 返回WAV文件
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Disposition': `attachment; filename="${fileId}.wav"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // 如果文件不存在，返回404
    console.log(`[本地文件API] 文件不存在: ${filePath}`);
    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error(`[本地文件API] 处理文件请求出错:`, error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * 保存本地文件
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileId = params.id;
  
  console.log(`[本地文件API] 接收到文件上传请求: ${fileId}`);
  
  try {
    // 确保目录存在
    if (!fs.existsSync(LOCAL_FILES_DIR)) {
      fs.mkdirSync(LOCAL_FILES_DIR, { recursive: true });
      console.log(`[本地文件API] 创建本地文件目录: ${LOCAL_FILES_DIR}`);
    }
    
    // 读取文件内容
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('[本地文件API] 请求中未包含文件');
      return NextResponse.json(
        { error: '没有接收到文件' },
        { status: 400 }
      );
    }
    
    // 将文件保存到本地
    const filePath = path.join(LOCAL_FILES_DIR, `${fileId}.wav`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    
    console.log(`[本地文件API] 文件已保存到: ${filePath}`);
    
    // 返回成功响应和本地文件URL
    return NextResponse.json({
      success: true,
      fileUrl: `/api/local-files/${fileId}`,
      fileId: fileId,
      isLocalFile: true
    });
  } catch (error) {
    console.error('[本地文件API] 保存文件失败:', error);
    return NextResponse.json(
      { error: '保存文件失败', details: String(error) },
      { status: 500 }
    );
  }
} 
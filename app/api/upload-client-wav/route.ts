import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');

// 确保临时目录存在
async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 确保临时目录存在
    await ensureTmpDir();
    
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientFileId = formData.get('clientFileId') as string;
    
    // 验证参数
    if (!file || !clientFileId) {
      return NextResponse.json({ error: 'Missing file or clientFileId' }, { status: 400 });
    }
    
    // 获取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // 保存文件到临时目录
    const filePath = path.join(TMP_DIR, `${clientFileId}.wav`);
    await writeFile(filePath, fileBuffer);
    
    // 返回成功响应
    return NextResponse.json({ 
      success: true, 
      fileId: clientFileId,
      message: 'File saved successfully'
    });
  } catch (error) {
    console.error('Upload client WAV error:', error);
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}

// 处理CORS预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
} 
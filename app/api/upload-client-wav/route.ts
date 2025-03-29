import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { uploadToR2, isR2Configured } from '@/lib/r2';

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');

// 最大文件大小限制 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024; 

// 确保临时目录存在
async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 生成唯一请求ID用于日志跟踪
    const requestId = request.headers.get('x-request-id') || `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[API:upload-client-wav:${requestId}] 开始处理客户端WAV上传`);
    
    // 获取内容长度
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    console.log(`[API:upload-client-wav:${requestId}] 请求内容长度: ${contentLength} bytes`);
    
    // 检查文件大小
    if (contentLength > MAX_FILE_SIZE) {
      console.log(`[API:upload-client-wav:${requestId}] 文件过大: ${contentLength} > ${MAX_FILE_SIZE}`);
      return NextResponse.json({ 
        error: 'File too large', 
        maxSize: MAX_FILE_SIZE,
        actualSize: contentLength 
      }, { 
        status: 413,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 确保临时目录存在
    await ensureTmpDir();
    
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientFileId = formData.get('clientFileId') as string;
    
    // 验证参数
    if (!file || !clientFileId) {
      console.log(`[API:upload-client-wav:${requestId}] 缺少必要参数: file=${!!file}, clientFileId=${!!clientFileId}`);
      return NextResponse.json({ error: 'Missing file or clientFileId' }, { status: 400 });
    }
    
    console.log(`[API:upload-client-wav:${requestId}] 接收到文件: ${file.name}, 大小: ${file.size} bytes, 类型: ${file.type}, 客户端ID: ${clientFileId}`);
    
    // 再次检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[API:upload-client-wav:${requestId}] 文件过大: ${file.size} > ${MAX_FILE_SIZE}`);
      return NextResponse.json({ 
        error: 'File too large', 
        maxSize: MAX_FILE_SIZE,
        actualSize: file.size 
      }, { status: 413 });
    }
    
    // 获取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log(`[API:upload-client-wav:${requestId}] 文件转换为Buffer，大小: ${fileBuffer.length} bytes`);
    
    // 保存文件到临时目录
    const filePath = path.join(TMP_DIR, `${clientFileId}.wav`);
    await writeFile(filePath, fileBuffer);
    console.log(`[API:upload-client-wav:${requestId}] 文件已保存到本地: ${filePath}`);
    
    // 尝试上传到R2
    let r2Success = false;
    if (isR2Configured) {
      try {
        console.log(`[API:upload-client-wav:${requestId}] 尝试上传到R2: wav/${clientFileId}.wav`);
        r2Success = await uploadToR2(`wav/${clientFileId}.wav`, fileBuffer, {
          'content-type': 'audio/wav',
          'original-name': file.name,
          'created-at': new Date().toISOString(),
          'client-id': clientFileId
        });
        
        console.log(`[API:upload-client-wav:${requestId}] R2上传结果: ${r2Success ? '成功' : '失败'}`);
      } catch (r2Error) {
        console.error(`[API:upload-client-wav:${requestId}] R2上传错误:`, r2Error);
        // 继续处理，因为文件已保存在本地
      }
    } else {
      console.log(`[API:upload-client-wav:${requestId}] R2未配置，跳过上传`);
    }
    
    // 返回成功响应
    console.log(`[API:upload-client-wav:${requestId}] 处理完成，返回成功响应`);
    return NextResponse.json({ 
      success: true, 
      fileId: clientFileId,
      r2Success,
      storedLocally: true,
      message: 'File saved successfully'
    });
  } catch (error) {
    console.error('Upload client WAV error:', error);
    return NextResponse.json({ 
      error: 'Failed to process file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 处理CORS预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400'
    }
  });
} 
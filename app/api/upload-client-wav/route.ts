import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import fs from 'fs';

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
    // 解析multipart/form-data请求
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientFileId = formData.get('clientFileId') as string;
    const skipR2Upload = formData.get('skipR2Upload') === 'true';
    
    if (!file || !clientFileId) {
      return NextResponse.json({
        error: 'Missing file or clientFileId',
      }, { status: 400 });
    }
    
    console.log(`[API:upload-client-wav] 接收到客户端WAV上传请求: fileId=${clientFileId}, 大小=${file.size}, 文件名=${file.name}, skipR2Upload=${skipR2Upload}`);
    
    // 创建临时目录（如果不存在）
    const tmpDir = process.env.TMP_DIR || path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // 保存文件到本地
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(tmpDir, `${clientFileId}.wav`);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`[API:upload-client-wav] 客户端WAV已保存到: ${filePath}, 大小: ${buffer.length} 字节`);
    
    // 如果不跳过R2上传且R2已配置，则上传到R2
    let r2Success = false;
    if (!skipR2Upload && isR2Configured) {
      try {
        console.log(`[API:upload-client-wav] 尝试上传WAV到R2: fileId=${clientFileId}`);
        r2Success = await uploadToR2(
          `wav/${clientFileId}.wav`,
          buffer,
          {
            originalName: file.name,
            convertedAt: Date.now().toString(),
            source: 'client-upload'
          },
          'audio/wav'
        );
        
        console.log(`[API:upload-client-wav] R2上传结果: ${r2Success ? '成功' : '失败'}`);
      } catch (r2Error) {
        console.error(`[API:upload-client-wav] 上传到R2失败:`, r2Error);
      }
    } else if (skipR2Upload) {
      console.log(`[API:upload-client-wav] 按请求跳过R2上传`);
    } else if (!isR2Configured) {
      console.log(`[API:upload-client-wav] R2未配置，跳过上传`);
    }
    
    // 返回成功响应
    return NextResponse.json({
      success: true,
      fileId: clientFileId,
      localPath: filePath,
      size: buffer.length,
      r2Uploaded: r2Success,
      skipR2Upload: skipR2Upload
    });
  } catch (error) {
    console.error(`[API:upload-client-wav] 上传处理错误:`, error);
    return NextResponse.json({
      error: 'Failed to process upload',
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
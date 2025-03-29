import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const CHUNKS_DIR = path.join(TMP_DIR, 'chunks');

// 最大分块大小限制 (10MB)
const MAX_CHUNK_SIZE = 10 * 1024 * 1024;

// 确保临时目录存在
async function ensureDirs() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true });
  }
  if (!existsSync(CHUNKS_DIR)) {
    await mkdir(CHUNKS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 生成唯一请求ID用于日志跟踪
    const requestId = request.headers.get('x-request-id') || `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[API:upload-chunk:${requestId}] 开始处理分块上传`);
    
    // 获取内容长度
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    console.log(`[API:upload-chunk:${requestId}] 请求内容长度: ${contentLength} bytes`);
    
    // 检查分块大小
    if (contentLength > MAX_CHUNK_SIZE) {
      console.log(`[API:upload-chunk:${requestId}] 分块过大: ${contentLength} > ${MAX_CHUNK_SIZE}`);
      return NextResponse.json({ 
        error: 'Chunk too large', 
        maxSize: MAX_CHUNK_SIZE,
        actualSize: contentLength 
      }, { status: 413 });
    }
    
    // 确保目录存在
    await ensureDirs();
    
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientFileId = formData.get('clientFileId') as string;
    const chunkIndex = formData.get('chunkIndex') as string;
    const totalChunks = formData.get('totalChunks') as string;
    const originalName = formData.get('originalName') as string;
    
    // 验证参数
    if (!file || !clientFileId || chunkIndex === undefined || totalChunks === undefined) {
      console.log(`[API:upload-chunk:${requestId}] 缺少必要参数: file=${!!file}, clientFileId=${!!clientFileId}, chunkIndex=${!!chunkIndex}, totalChunks=${!!totalChunks}`);
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    console.log(`[API:upload-chunk:${requestId}] 接收到分块: ${file.name}, 大小: ${file.size} bytes, 客户端ID: ${clientFileId}, 块索引: ${chunkIndex}/${totalChunks}`);
    
    // 再次检查文件大小
    if (file.size > MAX_CHUNK_SIZE) {
      console.log(`[API:upload-chunk:${requestId}] 分块过大: ${file.size} > ${MAX_CHUNK_SIZE}`);
      return NextResponse.json({ 
        error: 'Chunk too large', 
        maxSize: MAX_CHUNK_SIZE,
        actualSize: file.size 
      }, { status: 413 });
    }
    
    // 创建客户端目录
    const clientChunksDir = path.join(CHUNKS_DIR, clientFileId);
    if (!existsSync(clientChunksDir)) {
      await mkdir(clientChunksDir, { recursive: true });
    }
    
    // 获取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log(`[API:upload-chunk:${requestId}] 文件转换为Buffer，大小: ${fileBuffer.length} bytes`);
    
    // 保存分块到临时目录
    const chunkFilePath = path.join(clientChunksDir, `${chunkIndex}.chunk`);
    await writeFile(chunkFilePath, fileBuffer);
    console.log(`[API:upload-chunk:${requestId}] 分块已保存到本地: ${chunkFilePath}`);
    
    // 创建或更新元数据文件
    const metadataPath = path.join(clientChunksDir, 'metadata.json');
    const metadata = {
      clientFileId,
      originalName,
      totalChunks: parseInt(totalChunks, 10),
      receivedChunks: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // 如果元数据文件已存在，则读取并更新
    try {
      if (existsSync(metadataPath)) {
        const existingMetadata = require(metadataPath);
        metadata.receivedChunks = existingMetadata.receivedChunks || [];
        metadata.createdAt = existingMetadata.createdAt;
      }
    } catch (metadataError) {
      console.error(`[API:upload-chunk:${requestId}] 读取元数据文件失败:`, metadataError);
      // 继续使用新创建的元数据
    }
    
    // 添加当前块索引到已接收列表（如果不存在）
    if (!metadata.receivedChunks.includes(parseInt(chunkIndex, 10))) {
      metadata.receivedChunks.push(parseInt(chunkIndex, 10));
    }
    metadata.lastUpdated = new Date().toISOString();
    
    // 保存更新的元数据
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[API:upload-chunk:${requestId}] 元数据已更新，已接收 ${metadata.receivedChunks.length}/${metadata.totalChunks} 个分块`);
    
    // 返回成功响应
    console.log(`[API:upload-chunk:${requestId}] 处理完成，返回成功响应`);
    return NextResponse.json({ 
      success: true, 
      chunkIndex: parseInt(chunkIndex, 10),
      receivedChunks: metadata.receivedChunks.length,
      totalChunks: metadata.totalChunks,
      isComplete: metadata.receivedChunks.length === metadata.totalChunks,
      message: 'Chunk saved successfully'
    });
  } catch (error) {
    console.error('Upload chunk error:', error);
    return NextResponse.json({ 
      error: 'Failed to process chunk',
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
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { uploadToR2, isR2Configured } from '@/lib/r2';

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const CHUNKS_DIR = path.join(TMP_DIR, 'chunks');

// 定义元数据类型接口
interface ChunkMetadata {
  clientFileId: string;
  originalName: string;
  totalChunks: number;
  receivedChunks: number[];
  createdAt: string;
  lastUpdated: string;
}

export async function POST(request: NextRequest) {
  try {
    // 生成唯一请求ID用于日志跟踪
    const requestId = request.headers.get('x-request-id') || `merge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[API:merge-chunks:${requestId}] 开始处理文件分块合并`);
    
    // 解析请求体
    const data = await request.json();
    const { clientFileId, totalChunks, fileName } = data;
    
    // 验证参数
    if (!clientFileId || !totalChunks || !fileName) {
      console.log(`[API:merge-chunks:${requestId}] 缺少必要参数: clientFileId=${!!clientFileId}, totalChunks=${!!totalChunks}, fileName=${!!fileName}`);
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    console.log(`[API:merge-chunks:${requestId}] 请求合并文件: ${fileName}, 客户端ID: ${clientFileId}, 总块数: ${totalChunks}`);
    
    // 检查分块目录是否存在
    const clientChunksDir = path.join(CHUNKS_DIR, clientFileId);
    if (!existsSync(clientChunksDir)) {
      console.log(`[API:merge-chunks:${requestId}] 分块目录不存在: ${clientChunksDir}`);
      return NextResponse.json({ error: 'Chunks directory not found' }, { status: 404 });
    }
    
    // 读取元数据文件
    const metadataPath = path.join(clientChunksDir, 'metadata.json');
    if (!existsSync(metadataPath)) {
      console.log(`[API:merge-chunks:${requestId}] 元数据文件不存在: ${metadataPath}`);
      return NextResponse.json({ error: 'Metadata file not found' }, { status: 404 });
    }
    
    // 解析元数据
    const metadataContent = await readFile(metadataPath, 'utf8');
    let metadata: ChunkMetadata;
    try {
      metadata = JSON.parse(metadataContent);
    } catch (jsonError) {
      console.error(`[API:merge-chunks:${requestId}] 解析元数据失败:`, jsonError);
      return NextResponse.json({ error: 'Invalid metadata format' }, { status: 500 });
    }
    
    // 检查是否所有分块都已上传
    const { receivedChunks, totalChunks: metaTotalChunks, originalName } = metadata;
    if (receivedChunks.length !== metaTotalChunks) {
      console.log(`[API:merge-chunks:${requestId}] 分块不完整: 已接收 ${receivedChunks.length}/${metaTotalChunks}`);
      return NextResponse.json({ 
        error: 'Incomplete chunks', 
        receivedChunks: receivedChunks.length,
        totalChunks: metaTotalChunks,
        missingChunks: Array.from({ length: metaTotalChunks }, (_, i) => i).filter(i => !receivedChunks.includes(i))
      }, { status: 400 });
    }
    
    // 准备合并文件
    const targetFilePath = path.join(TMP_DIR, `${clientFileId}.wav`);
    console.log(`[API:merge-chunks:${requestId}] 开始合并文件到: ${targetFilePath}`);
    
    // 创建输出流
    const output = createWriteStream(targetFilePath);
    
    // 按顺序处理所有分块
    try {
      for (let i = 0; i < metaTotalChunks; i++) {
        const chunkPath = path.join(clientChunksDir, `${i}.chunk`);
        if (!existsSync(chunkPath)) {
          throw new Error(`分块文件不存在: ${chunkPath}`);
        }
        
        // 读取分块并写入输出流
        const chunkData = await readFile(chunkPath);
        output.write(chunkData);
        
        console.log(`[API:merge-chunks:${requestId}] 已处理分块 ${i + 1}/${metaTotalChunks}`);
      }
      
      // 关闭输出流
      output.end();
      
      // 等待输出流完成
      await new Promise<void>((resolve, reject) => {
        output.on('finish', () => resolve());
        output.on('error', (err) => reject(err));
      });
      
      console.log(`[API:merge-chunks:${requestId}] 文件合并完成: ${targetFilePath}`);
      
      // 尝试上传到R2
      let r2Success = false;
      const finalBuffer = await readFile(targetFilePath);
      
      if (isR2Configured) {
        try {
          console.log(`[API:merge-chunks:${requestId}] 尝试上传到R2: wav/${clientFileId}.wav`);
          r2Success = await uploadToR2(`wav/${clientFileId}.wav`, finalBuffer, {
            'content-type': 'audio/wav',
            'original-name': originalName || fileName,
            'created-at': new Date().toISOString(),
            'client-id': clientFileId
          });
          
          console.log(`[API:merge-chunks:${requestId}] R2上传结果: ${r2Success ? '成功' : '失败'}`);
        } catch (r2Error) {
          console.error(`[API:merge-chunks:${requestId}] R2上传错误:`, r2Error);
          // 继续处理，因为文件已保存在本地
        }
      } else {
        console.log(`[API:merge-chunks:${requestId}] R2未配置，跳过上传`);
      }
      
      // 清理分块文件（可选）
      // 暂时保留分块文件，以便于调试或恢复
      // TODO: 实现定时清理功能
      
      // 返回成功响应
      console.log(`[API:merge-chunks:${requestId}] 处理完成，返回成功响应`);
      return NextResponse.json({ 
        success: true, 
        fileId: clientFileId,
        r2Success,
        storedLocally: true,
        fileSize: finalBuffer.length,
        message: 'File merged successfully',
        downloadUrl: `/api/convert?fileId=${clientFileId}`
      });
    } catch (mergeError) {
      console.error(`[API:merge-chunks:${requestId}] 合并文件失败:`, mergeError);
      return NextResponse.json({ 
        error: 'Failed to merge chunks',
        message: mergeError instanceof Error ? mergeError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Merge chunks error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
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
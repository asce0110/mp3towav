import { NextRequest, NextResponse } from 'next/server';
import { 
  PutObjectCommand,
  PutObjectCommandInput 
} from '@aws-sdk/client-s3';
import { initR2Client, r2BucketName, fileExistsInR2 } from '@/lib/r2';
import { promises as fs, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';

// 临时目录
const TMP_DIR = process.cwd() + '/tmp';

// 确保临时目录存在
if (!existsSync(TMP_DIR)) {
  try {
    mkdirSync(TMP_DIR, { recursive: true });
    console.log(`[代理上传] 创建临时目录: ${TMP_DIR}`);
  } catch (err) {
    console.error(`[代理上传] 创建临时目录失败: ${TMP_DIR}`, err);
  }
}

// 配置上传参数
const CHUNK_SIZE = 5 * 1024 * 1024; // 每次分块5MB
const UPLOAD_TIMEOUT = 120000; // 上传超时时间，增加到2分钟

/**
 * 代理上传到R2的API路由 - 优化版
 * 服务器端上传到R2，避免浏览器端SSL握手问题
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[代理上传] 收到上传请求');
  
  try {
    // 1. 解析multipart/form-data
    const formData = await request.formData();
    
    // 2. 获取上传的文件
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ success: false, error: '未找到文件' }, { status: 400 });
    }
    
    // 获取客户端指定的文件键名（如果提供）
    const clientFileKey = formData.get('fileKey') as string | null;
    
    console.log(`[代理上传] 接收到文件: ${file.name}, 大小: ${formatSize(file.size)}, 类型: ${file.type}`);
    
    // 3. 生成唯一文件名
    const fileKey = clientFileKey || `mp3_to_wav_${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}.wav`;
    
    // 4. 初始化R2客户端
    const r2Client = await initR2Client();
    if (!r2Client) {
      console.error('[代理上传] R2客户端初始化失败，环境变量可能不正确');
      
      // 返回详细错误信息
      return NextResponse.json({ 
        success: false, 
        error: 'R2客户端初始化失败',
        message: 'R2客户端初始化失败，请检查服务器配置'
      }, { status: 500 });
    }
    
    // 5. 检查是否已存在（避免重复上传）
    if (clientFileKey) {
      try {
        const fileExists = await fileExistsInR2(clientFileKey);
        if (fileExists) {
          console.log(`[代理上传] 文件已存在于R2: ${clientFileKey}`);
          
          // 构建并返回文件URL
          const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL || 
            `https://${r2BucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
          const fileUrl = `${publicUrl}/${clientFileKey}`;
          
          return NextResponse.json({ 
            success: true, 
            fileUrl,
            alreadyExists: true
          });
        }
      } catch (error) {
        // 检查错误只记录，不中断流程
        console.log(`[代理上传] 检查文件存在出错，继续上传流程: ${error}`);
      }
    }
    
    // 6. 准备元数据 - 确保所有元数据键名为有效的标识符
    const safeFileName = encodeURIComponent(file.name);
    const metadataObj: Record<string, string> = {
      'filename': safeFileName,
      'contenttype': file.type,
      'source': 'proxy-upload',
      'filesize': file.size.toString(),
      'uploadtime': Date.now().toString(),
      'timestamp': Date.now().toString()
    };
    
    // 7. 上传到R2
    console.log(`[代理上传] 开始上传到R2，文件大小: ${formatSize(file.size)}`);
    
    // 读取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    let uploadStartTime = Date.now();
    let uploadSuccess = false;
    let fileUrl = '';
    let uploadError = null;
    
    // 上传文件到R2 - 带重试逻辑
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[代理上传] 尝试第${attempt}次上传...`);
          // 如果是重试，等待一段时间
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt - 1)));
        }
        
        // 构建上传参数
        const uploadParams: PutObjectCommandInput = {
          Bucket: r2BucketName,
          Key: fileKey,
          Body: fileBuffer,
          ContentType: file.type,
          Metadata: metadataObj
        };
        
        // 执行上传
        const command = new PutObjectCommand(uploadParams);
        
        // 设置上传超时
        const result = await Promise.race([
          r2Client.send(command),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('上传操作超时')), UPLOAD_TIMEOUT);
          })
        ]) as any;
        
        console.log(`[代理上传] 文件上传成功, ETag: ${result.ETag}, 尝试次数: ${attempt}`);
        uploadSuccess = true;
        
        // 构建文件URL
        const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL || 
          `https://${r2BucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        fileUrl = `${publicUrl}/${fileKey}`;
        
        // 成功后跳出重试循环
        break;
      } catch (error: any) {
        uploadError = error;
        console.error(`[代理上传] 第${attempt}次上传失败:`, error.message);
        
        // 如果是最后一次尝试，记录详细错误信息
        if (attempt === 3) {
          console.error('[代理上传] 所有尝试都失败，详细错误:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
          });
        }
      }
    }
    
    // 检查上传结果
    if (uploadSuccess) {
      // 记录上传时间和总处理时间
      const uploadTime = Date.now() - uploadStartTime;
      const totalTime = Date.now() - startTime;
      
      // 计算上传速率
      const uploadSpeed = (file.size / uploadTime * 1000 / 1024 / 1024).toFixed(2);
      
      console.log(`[代理上传] 上传完成 - 大小: ${formatSize(file.size)}, 用时: ${uploadTime}ms, 速率: ${uploadSpeed} MB/s`);
      console.log(`[代理上传] 总处理时间: ${totalTime}ms`);
      
      return NextResponse.json({ 
        success: true, 
        fileUrl,
        fileKey,
        processingTime: totalTime,
        uploadTime,
        uploadSpeed: `${uploadSpeed} MB/s`
      });
    } else {
      // 提供具体的错误信息
      let errorMessage = '未知错误';
      let errorDetail = '';
      
      if (uploadError) {
        if (uploadError.message.includes('timeout') || uploadError.code === 'TimeoutError') {
          errorMessage = '上传超时，文件可能过大或网络不稳定';
        } else if (uploadError.message.includes('SSL') || uploadError.message.includes('TLS') || 
                  uploadError.message.includes('EPROTO') || uploadError.message.includes('ECONNRESET')) {
          errorMessage = 'SSL/TLS连接错误，服务器与Cloudflare R2之间的连接存在问题';
          errorDetail = uploadError.message;
        } else {
          errorMessage = `上传失败: ${uploadError.message}`;
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: '上传到R2失败',
        message: errorMessage,
        detail: errorDetail
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[代理上传] 处理上传请求时出错:', error);
    
    // 提供更详细的错误信息
    const errorDetail = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n')[0] || 'No stack trace'
    } : 'Unknown error';
    
    return NextResponse.json({ 
      success: false, 
      error: '处理上传请求时出错',
      message: error instanceof Error ? error.message : '未知错误',
      detail: errorDetail
    }, { status: 500 });
  }
}

// 文件大小格式化函数
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return size.toFixed(2) + ' ' + units[unitIndex];
}

// 需要配置为接受大文件
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '100mb',
  },
}; 
import { S3Client } from '@aws-sdk/client-s3';
import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs';
import { CHUNK_SIZE } from './constants';

// 动态加载dotenv配置文件
try {
  // 优先尝试加载.env.local
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
    console.log('已从.env.local加载R2环境变量');
  } else {
    // 回退到.env
    require('dotenv').config();
    console.log('已从.env加载R2环境变量');
  }
} catch (error) {
  console.warn('加载环境变量文件失败，将使用当前环境中的变量:', error);
}

// 获取环境变量
const r2AccountId = process.env.R2_ACCOUNT_ID || '';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
export const r2BucketName = process.env.R2_BUCKET_NAME || '';
const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;

// 检查R2配置是否完整
export const isR2Configured = !!(
  r2AccountId && 
  r2AccessKeyId && 
  r2SecretAccessKey && 
  r2BucketName
);

// 为开发环境禁用SSL证书验证 (仅用于开发测试)
if (process.env.NODE_ENV === 'development') {
  // 不再全局设置NODE_TLS_REJECT_UNAUTHORIZED，这会导致安全问题
  console.warn('[R2] 注意: 在开发环境中将对R2连接使用特殊配置');
}

// 初始化S3客户端
let r2ClientInstance: S3Client | null = null;

// 提供初始化R2客户端的函数
export async function initR2Client(): Promise<S3Client | null> {
  // 如果已经初始化，直接返回实例
  if (r2ClientInstance) {
    return r2ClientInstance;
  }
  
  if (!isR2Configured) {
    console.log('[R2] R2配置不完整，无法初始化客户端');
    return null;
  }
  
  try {
    // 为本地开发环境设置特殊配置选项
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.log(`[R2] 初始化客户端，当前环境: ${process.env.NODE_ENV}, 开发模式: ${isDevelopment}`);
    
    // 创建R2客户端配置
    const clientConfig: any = {
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
      forcePathStyle: true,
    };

    // 添加更可靠的网络配置
    clientConfig.requestHandler = {
      httpOptions: {
        timeout: 60000, // 60秒超时
        connectTimeout: 30000, // 30秒连接超时
      }
    };

    // 仅在开发环境中添加日志记录器
    if (isDevelopment) {
      clientConfig.logger = {
        debug: (...args: any[]) => console.debug('[R2 DEBUG]', ...args),
        info: (...args: any[]) => console.info('[R2 INFO]', ...args),
        warn: (...args: any[]) => console.warn('[R2 WARN]', ...args),
        error: (...args: any[]) => console.error('[R2 ERROR]', ...args),
      };
    }
    
    // 创建R2客户端
    r2ClientInstance = new S3Client(clientConfig);
    console.log('[R2] R2客户端初始化成功');
    return r2ClientInstance;
  } catch (error) {
    console.error('[R2] 初始化R2客户端失败:', error);
    return null;
  }
}

if (isR2Configured) {
  try {
    // 初始化客户端实例
    initR2Client()
      .then(client => {
        r2ClientInstance = client;
        console.log('R2客户端初始化成功');
      })
      .catch(error => {
        console.error('初始化R2客户端失败:', error);
        r2ClientInstance = null;
      });
  } catch (error) {
    console.error('初始化R2客户端失败:', error);
    r2ClientInstance = null;
  }
} else {
  console.log('R2配置不完整，存储功能将回退到本地文件系统');
}

// 导出r2Client以供外部使用
export const r2Client = r2ClientInstance;

// 验证R2连接
export async function validateR2Connection(): Promise<boolean> {
  if (!r2Client) {
    console.error('R2客户端未初始化，无法验证连接');
    return false;
  }

  try {
    console.log('开始验证R2连接...');
    // 尝试列出桶中的对象（限制为1个）以验证连接
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      MaxKeys: 1, // 只需要1个对象来验证连接
    });

    const response = await r2Client.send(command);
    console.log('R2连接验证成功，桶存在');
    return true;
  } catch (error) {
    console.error('R2连接验证失败:', error);
    return false;
  }
}

// 分块上传函数
async function uploadToR2InChunks(key: string, buffer: Buffer, metadata: Record<string, string>) {
  try {
    // 创建分块上传
    const createMultipartUpload = new CreateMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Metadata: metadata,
    })
    const { UploadId } = await r2Client!.send(createMultipartUpload)

    // 计算分块数量
    const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE)
    const parts = []

    // 上传每个分块
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, buffer.length)
      const chunk = buffer.slice(start, end)

      const uploadPart = new UploadPartCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        UploadId,
        PartNumber: i + 1,
        Body: chunk,
      })

      const { ETag } = await r2Client!.send(uploadPart)
      parts.push({ PartNumber: i + 1, ETag })
    }

    // 完成分块上传
    const completeMultipartUpload = new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      UploadId,
      MultipartUpload: { Parts: parts },
    })

    await r2Client!.send(completeMultipartUpload)
    return true
  } catch (error) {
    console.error('Error in multipart upload:', error)
    return false
  }
}

// 直接上传函数
async function uploadToR2Direct(key: string, buffer: Buffer, metadata: Record<string, string>) {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      Metadata: metadata,
    })
    await r2Client!.send(command)
    return true
  } catch (error) {
    console.error('Error in direct upload:', error)
    return false
  }
}

// 主上传函数
export async function uploadToR2(key: string, buffer: Buffer, metadata: Record<string, string>) {
  // 根据文件大小选择上传方式
  if (buffer.length > CHUNK_SIZE) {
    return uploadToR2InChunks(key, buffer, metadata)
  } else {
    return uploadToR2Direct(key, buffer, metadata)
  }
}

// 检查文件是否存在于R2
export async function fileExistsInR2(key: string): Promise<boolean> {
  if (!r2Client) {
    console.log('R2客户端未初始化，无法检查文件');
    return false;
  }

  try {
    console.log(`检查文件是否存在于R2: ${key}`);
    const command = new HeadObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    await r2Client.send(command);
    console.log(`文件存在于R2: ${key}`);
    return true;
  } catch (error) {
    console.log(`文件不存在于R2: ${key}`);
    if (error instanceof Error) {
      console.log(`错误详情: ${error.name}: ${error.message}`);
    }
    return false;
  }
}

// 从R2下载文件
export async function downloadFromR2(key: string): Promise<Buffer | null> {
  if (!r2Client) {
    console.error('R2客户端未初始化，无法下载文件');
    return null;
  }

  try {
    console.log(`从R2下载文件: ${key}`);
    const command = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    const result = await r2Client.send(command);
    
    if (!result.Body) {
      console.error(`从R2下载文件失败: ${key}, 没有返回数据`);
      return null;
    }

    // 转换ReadableStream为Buffer
    const chunks: Uint8Array[] = [];
    const stream = result.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    console.log(`从R2下载文件成功: ${key}, 大小: ${buffer.length} 字节`);
    return buffer;
  } catch (error) {
    console.error(`从R2下载文件失败: ${key}`, error);
    return null;
  }
}

// 生成预签名URL (有效期30分钟)
export async function generatePresignedUrl(key: string, expiresIn: number = 30 * 60): Promise<string | null> {
  if (!r2Client) {
    console.error('R2客户端未初始化，无法生成预签名URL');
    return null;
  }

  try {
    console.log(`为${key}生成预签名URL, 有效期: ${expiresIn}秒`);
    const command = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    console.log(`已生成预签名URL: ${url.substring(0, 50)}...`);
    return url;
  } catch (error) {
    console.error(`生成预签名URL失败: ${key}`, error);
    return null;
  }
}

// 删除R2对象
export async function deleteFromR2(key: string): Promise<boolean> {
  if (!r2Client) {
    console.error('R2客户端未初始化，无法删除文件');
    return false;
  }

  try {
    console.log(`删除R2文件: ${key}`);
    const command = new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    await r2Client.send(command);
    console.log(`文件已从R2删除: ${key}`);
    return true;
  } catch (error) {
    console.error(`删除R2文件失败: ${key}`, error);
    return false;
  }
}

// 列出R2对象
export async function listR2Objects(prefix: string = '', limit: number = 100): Promise<Array<any>> {
  if (!r2Client) {
    console.error('R2客户端未初始化，无法列出对象');
    return [];
  }

  try {
    console.log(`列出R2对象，前缀: ${prefix}, 限制: ${limit}`);
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      Prefix: prefix,
      MaxKeys: limit
    });

    const result = await r2Client.send(command);
    console.log(`列出R2对象成功，找到 ${result.Contents?.length || 0} 个对象`);
    return result.Contents || [];
  } catch (error) {
    console.error('列出R2对象失败:', error);
    return [];
  }
}

// 设置R2对象的生命周期（在服务器端设置过期时间）
export async function setupR2Lifecycle(expireDays: number = 1): Promise<boolean> {
  console.log(`R2生命周期管理需要在Cloudflare dashboard中配置`);
  console.log(`请访问 https://dash.cloudflare.com/ 设置对象生命周期规则`);
  console.log(`建议为wav/和shares/目录设置 ${expireDays} 天的过期时间`);
  return false;
}

// 列出R2中的文件
export async function listFilesInR2(prefix: string = '', limit: number = 100): Promise<string[]> {
  return await listR2Objects(prefix, limit).then(objects => 
    objects.map(obj => obj.Key || obj.key || '')
      .filter(key => key !== '')
  );
} 
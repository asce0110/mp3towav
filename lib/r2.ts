import { S3Client } from '@aws-sdk/client-s3';
import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs';

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
const r2BucketName = process.env.R2_BUCKET_NAME || '';
const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;

// 检查R2配置是否完整
export const isR2Configured = !!(
  r2AccountId && 
  r2AccessKeyId && 
  r2SecretAccessKey && 
  r2BucketName
);

// 初始化S3客户端
let r2Client: S3Client | null = null;

if (isR2Configured) {
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });
    console.log('R2客户端初始化成功');
  } catch (error) {
    console.error('初始化R2客户端失败:', error);
    r2Client = null;
  }
} else {
  console.log('R2配置不完整，存储功能将回退到本地文件系统');
}

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

// 上传文件到R2
export async function uploadToR2(
  key: string, 
  fileBuffer: Buffer, 
  metadata: Record<string, string> = {}, 
  contentType = 'application/octet-stream'
): Promise<boolean> {
  if (!r2Client) {
    console.error('[R2] 客户端未初始化，无法上传文件。检查环境变量配置');
    // 输出当前环境变量状态（不显示实际值）
    console.log('[R2] 环境变量状态:', {
      R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME
    });
    return false;
  }

  console.log(`[R2] 准备上传文件: ${key}, 大小: ${fileBuffer.length} 字节, 类型: ${contentType}`);
  console.log(`[R2] 使用存储桶: ${r2BucketName}, 端点: ${endpoint}`);
  
  try {
    // 添加时间戳元数据
    const timestampedMetadata = {
      ...metadata,
      'upload-timestamp': Date.now().toString(),
    };
    
    console.log(`[R2] 构建上传命令，包含元数据:`, Object.keys(timestampedMetadata));
    
    // 构建上传命令
    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: timestampedMetadata,
    });

    console.log(`[R2] 发送上传命令...`);
    
    // 发送上传命令
    const result = await r2Client.send(command);
    console.log(`[R2] 文件成功上传: ${key}, ETag: ${result.ETag}`);
    
    // 验证文件是否已上传
    try {
      console.log(`[R2] 验证文件是否已上传: ${key}`);
      const exists = await fileExistsInR2(key);
      if (exists) {
        console.log(`[R2] 文件验证成功: ${key}`);
      } else {
        console.warn(`[R2] 文件验证失败，可能上传不完整: ${key}`);
      }
    } catch (verifyError) {
      console.error(`[R2] 文件验证出错: ${key}`, verifyError);
    }
    
    return true;
  } catch (error) {
    console.error(`[R2] 上传文件失败: ${key}`, error);
    if (error instanceof Error) {
      console.error(`[R2] 错误详情: ${error.name}: ${error.message}`);
      console.error(`[R2] 错误堆栈: ${error.stack}`);
    }
    return false;
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

// 列出R2中的对象
export async function listR2Objects(prefix: string = '', limit: number = 100): Promise<Array<any>> {
  if (!r2Client) {
    console.error('R2客户端未初始化，无法列出对象');
    return [];
  }

  try {
    console.log(`列出R2对象, 前缀: ${prefix}, 限制: ${limit}`);
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      Prefix: prefix,
      MaxKeys: limit
    });

    const result = await r2Client.send(command);
    const objects = result.Contents || [];
    console.log(`找到${objects.length}个对象`);
    
    return objects.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));
  } catch (error) {
    console.error(`列出R2对象失败:`, error);
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
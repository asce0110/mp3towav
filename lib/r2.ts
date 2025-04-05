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

// 上传文件到R2
export async function uploadToR2(
  key: string, 
  fileBuffer: Buffer, 
  metadata: Record<string, string> = {}, 
  contentType = 'application/octet-stream'
): Promise<boolean> {
  if (!r2Client) {
    // 尝试重新初始化R2客户端
    console.log('[R2] 客户端未初始化，尝试重新初始化...');
    const newClient = await initR2Client();
    if (!newClient) {
      console.error('[R2] 重新初始化失败，无法上传文件。检查环境变量配置');
      // 输出当前环境变量状态（不显示实际值）
      console.log('[R2] 环境变量状态:', {
        R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME
      });
      return false;
    }
  }

  console.log(`[R2] 准备上传文件: ${key}, 大小: ${fileBuffer.length} 字节, 类型: ${contentType}`);
  console.log(`[R2] 使用存储桶: ${r2BucketName}, 端点: ${endpoint}`);
  
  try {
    // 添加时间戳元数据 - 确保所有元数据键名为有效的标识符
    const sanitizedMetadata: Record<string, string> = {};
    
    // 处理所有元数据，确保键名和值都有效
    for (const [key, value] of Object.entries(metadata)) {
      // 移除连字符，替换为下划线，并移除任何非字母数字字符
      const sanitizedKey = key.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      
      // 确保值也是有效的ASCII字符，如果有非ASCII字符，使用URL编码
      let sanitizedValue = typeof value === 'string' ? value : String(value);
      
      // 检查值是否包含非ASCII字符
      if (/[^\x00-\x7F]/.test(sanitizedValue)) {
        console.log(`[R2] 元数据值包含非ASCII字符，进行URL编码: ${key}`);
        sanitizedValue = encodeURIComponent(sanitizedValue);
      }
      
      sanitizedMetadata[sanitizedKey] = sanitizedValue;
    }
    
    // 添加时间戳
    sanitizedMetadata['timestamp'] = Date.now().toString();
    
    console.log(`[R2] 构建上传命令，包含元数据:`, Object.keys(sanitizedMetadata));
    
    // 构建上传命令
    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: sanitizedMetadata,
    });

    console.log(`[R2] 发送上传命令...`);
    
    // 设置命令超时时间较长，以应对网络问题
    const commandTimeout = 30000; // 30秒
    
    // 发送上传命令
    const result = await Promise.race([
      r2Client.send(command),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('上传超时，可能存在网络问题')), commandTimeout);
      })
    ]) as any;
    
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
    console.error(`[R2] 上传文件失败: ${key}`);
    if (error instanceof Error) {
      console.error(`[R2] 错误类型: ${error.constructor.name}`);
      console.error(`[R2] 错误详情: ${error.name}: ${error.message}`);
      console.error(`[R2] 错误堆栈: ${error.stack}`);
      
      // 检查是否为SSL握手错误
      if (error.message.includes('SSL') || error.message.includes('handshake') || 
          error.message.includes('EPROTO') || error.message.includes('ECONNRESET')) {
        console.error('[R2] 检测到SSL/TLS握手错误，可能是由于网络问题或证书验证失败');
      }
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
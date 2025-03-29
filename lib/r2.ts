import { S3Client } from '@aws-sdk/client-s3';
import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '9a54200354c496d0e610009d7ab97c17';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mp3towav';

// 如果未配置访问密钥，在控制台显示警告
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn(
    '⚠️ R2 访问密钥未配置，将使用本地存储。请设置 R2_ACCESS_KEY_ID 和 R2_SECRET_ACCESS_KEY 环境变量以启用 R2 存储。'
  );
}

// 检查是否配置了 R2 凭据
export const isR2Configured = !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

// 创建 R2 客户端
let r2ClientInitialized = false;
let r2ClientInitError: any = null;
export const r2Client = (() => {
  if (!isR2Configured) {
    console.log('R2 凭据未配置，将使用本地存储');
    return null;
  }
  
  try {
    console.log(`正在初始化 R2 客户端，Account ID: ${R2_ACCOUNT_ID}, Bucket: ${R2_BUCKET_NAME}`);
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
    r2ClientInitialized = true;
    console.log('R2 客户端初始化成功');
    return client;
  } catch (error) {
    console.error('初始化 R2 客户端失败:', error);
    r2ClientInitError = error;
    return null;
  }
})();

// 验证 R2 连接是否正常
export async function validateR2Connection(): Promise<boolean> {
  if (!isR2Configured || !r2Client) {
    console.log('R2 未配置，无法验证连接');
    return false;
  }

  try {
    console.log('测试 R2 连接...');
    // 尝试列出文件以验证连接
    const command = new ListObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      MaxKeys: 1, // 只获取一个对象以减少负担
    });

    await r2Client.send(command);
    console.log('R2 连接测试成功');
    return true;
  } catch (error) {
    console.error('R2 连接测试失败:', error);
    return false;
  }
}

/**
 * 上传文件到 R2 存储
 * @param key 文件的键/路径
 * @param body 文件内容
 * @param metadata 可选的元数据
 * @param contentType 内容类型
 * @returns 成功返回 true，失败返回 false
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  metadata?: Record<string, string>,
  contentType: string = 'application/octet-stream'
): Promise<boolean> {
  if (!isR2Configured || !r2Client) {
    console.warn('R2 未配置，无法上传文件:', key);
    return false;
  }

  console.log(`开始上传文件到 R2: ${key}, 大小: ${body.length} 字节, 类型: ${contentType}`);
  
  try {
    // 设置一天后的过期时间 (24小时)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 添加创建时间和过期时间到元数据
    const fileMetadata = {
      ...metadata,
      'created-at': new Date().toISOString(),
      'expires-at': expiresAt.toISOString(),
      'content-length': body.length.toString(),
    };

    console.log(`文件元数据: ${JSON.stringify(fileMetadata)}`);

    // 准备上传命令
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      Metadata: fileMetadata,
      ContentType: contentType,
      // 设置缓存控制和过期时间
      CacheControl: 'max-age=86400',
      Expires: expiresAt,
    });

    // 执行上传
    const result = await r2Client.send(command);
    console.log(`文件上传成功: ${key}, ETag: ${result.ETag}`);
    
    // 验证文件是否确实存在
    const exists = await fileExistsInR2(key);
    if (exists) {
      console.log(`已确认文件在 R2 中存在: ${key}`);
    } else {
      console.warn(`警告: 文件上传成功但验证未通过: ${key}`);
    }
    
    return true;
  } catch (error) {
    console.error(`上传文件到 R2 失败 (${key}):`, error);
    return false;
  }
}

/**
 * 从 R2 下载文件
 * @param key 文件键/路径
 * @returns 成功时返回文件内容，失败时返回 null
 */
export async function downloadFromR2(key: string): Promise<Buffer | null> {
  if (!isR2Configured || !r2Client) {
    console.warn('R2 未配置，无法下载文件:', key);
    return null;
  }

  console.log(`开始从 R2 下载文件: ${key}`);
  
  try {
    // 首先检查文件是否存在
    const exists = await fileExistsInR2(key);
    if (!exists) {
      console.error(`文件在 R2 中不存在: ${key}`);
      return null;
    }
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      console.error(`从 R2 下载文件失败 (${key}): 响应中没有文件内容`);
      return null;
    }

    console.log(`文件响应头: ${JSON.stringify({
      ContentType: response.ContentType,
      ContentLength: response.ContentLength,
      Metadata: response.Metadata,
    })}`);

    // 将可读流转换为 Buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as any;
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', (err: Error) => {
        console.error(`从 R2 读取文件流失败 (${key}):`, err);
        reject(err);
      });
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`文件下载成功: ${key} (${buffer.length} 字节)`);
        resolve(buffer);
      });
    });
  } catch (error) {
    console.error(`从 R2 下载文件失败 (${key}):`, error);
    return null;
  }
}

/**
 * 检查 R2 中的文件是否存在
 * @param key 文件键/路径
 * @returns 文件存在返回 true，否则返回 false
 */
export async function fileExistsInR2(key: string): Promise<boolean> {
  if (!isR2Configured || !r2Client) {
    console.warn('R2 未配置，无法检查文件');
    return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    // 如果文件不存在，不记录错误，只返回 false
    return false;
  }
}

/**
 * 从 R2 删除文件
 * @param key 文件键/路径
 * @returns 成功返回 true，失败返回 false
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  if (!isR2Configured || !r2Client) {
    console.warn('R2 未配置，无法删除文件');
    return false;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    console.log(`文件删除成功: ${key}`);
    return true;
  } catch (error) {
    console.error(`从 R2 删除文件失败 (${key}):`, error);
    return false;
  }
}

/**
 * 生成文件的预签名 URL，用于临时访问
 * @param key 文件键/路径
 * @param expirationSeconds URL 有效期（秒）
 * @returns 预签名 URL 或 null（如果失败）
 */
export async function generatePresignedUrl(
  key: string,
  expirationSeconds: number = 86400 // 默认 24 小时
): Promise<string | null> {
  if (!isR2Configured || !r2Client) {
    console.warn('R2 未配置，无法生成预签名 URL:', key);
    return null;
  }

  console.log(`开始为文件生成预签名 URL: ${key}, 有效期: ${expirationSeconds}秒`);
  
  try {
    // 先检查文件是否存在
    const exists = await fileExistsInR2(key);
    if (!exists) {
      console.error(`无法生成预签名 URL，文件在 R2 中不存在: ${key}`);
      return null;
    }
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, {
      expiresIn: expirationSeconds,
    });

    console.log(`预签名 URL 生成成功: ${key}, URL长度: ${url.length}字符`);
    // 不打印完整URL以避免泄露，只打印前30个字符
    console.log(`预签名 URL 前缀: ${url.substring(0, 30)}...`);
    
    return url;
  } catch (error) {
    console.error(`生成预签名 URL 失败 (${key}):`, error);
    return null;
  }
}

/**
 * 列出 R2 存储桶中的文件
 * @param prefix 可选的前缀过滤
 * @returns 文件键列表或空数组（如果失败）
 */
export async function listFilesInR2(prefix?: string): Promise<string[]> {
  if (!isR2Configured || !r2Client) {
    console.warn('R2 未配置，无法列出文件');
    return [];
  }

  try {
    const command = new ListObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await r2Client.send(command);
    
    if (!response.Contents) {
      return [];
    }

    return response.Contents.map(item => item.Key!).filter(Boolean);
  } catch (error) {
    console.error(`列出 R2 文件失败:`, error);
    return [];
  }
}

// 列出R2存储桶中的对象
export async function listR2Objects(prefix: string, limit: number = 100): Promise<Array<{ key: string, size: number, lastModified: string }>> {
  if (!r2Client) {
    console.error('R2 client not initialized');
    return [];
  }
  
  try {
    const options = { prefix, limit };
    const objects = await r2Client.list(options);
    
    if (!objects || !objects.objects) {
      return [];
    }
    
    return objects.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      lastModified: obj.uploaded.toISOString()
    }));
  } catch (error) {
    console.error('Error listing R2 objects:', error);
    return [];
  }
} 
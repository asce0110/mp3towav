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
export const r2Client = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

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
    console.warn('R2 未配置，无法上传文件');
    return false;
  }

  try {
    // 设置一天后的过期时间 (24小时)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 添加创建时间和过期时间到元数据
    const fileMetadata = {
      ...metadata,
      'created-at': new Date().toISOString(),
      'expires-at': expiresAt.toISOString(),
    };

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
    await r2Client.send(command);
    console.log(`文件上传成功: ${key}`);
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
    console.warn('R2 未配置，无法下载文件');
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      console.error(`从 R2 下载文件失败 (${key}): 响应中没有文件内容`);
      return null;
    }

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
    console.warn('R2 未配置，无法生成预签名 URL');
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, {
      expiresIn: expirationSeconds,
    });

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
/**
 * Cloudflare Worker for R2 Cleanup
 * 此Worker用于定期清理R2存储中的过期文件和分享链接
 * 
 * 部署说明:
 * 1. 在Cloudflare Workers中创建新的Worker
 * 2. 设置环境变量: R2_BUCKET_NAME
 * 3. 绑定R2存储桶
 * 4. 设置定时触发器，例如每小时执行一次
 */

// Worker配置
export default {
  // 处理定时任务 
  async scheduled(event, env, ctx) {
    return await cleanupR2Storage(env);
  },
  
  // 处理HTTP请求 - 可以手动触发清理
  async fetch(request, env, ctx) {
    // 获取URL查询参数
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    // 验证安全令牌
    const securityToken = env.SECURITY_TOKEN;
    if (securityToken && token !== securityToken) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // 执行清理并返回结果
    try {
      const result = await cleanupR2Storage(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message || 'Unknown error',
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * 清理R2存储中的过期文件
 * @param {Object} env - Worker环境变量
 */
async function cleanupR2Storage(env) {
  // 获取R2存储桶
  const bucket = env.MP3TOWAV_BUCKET;
  if (!bucket) {
    throw new Error('R2 bucket binding not available');
  }
  
  // 计算24小时前的时间戳
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() - 24);
  
  const result = {
    timestamp: new Date().toISOString(),
    expirationTime: expirationTime.toISOString(),
    shares: { scanned: 0, deleted: 0 },
    wavFiles: { scanned: 0, deleted: 0 },
    errors: []
  };
  
  // 清理分享文件
  try {
    // 列出shares/目录下的所有对象
    let sharesList = await bucket.list({ prefix: 'shares/' });
    result.shares.scanned = sharesList.objects.length;
    
    // 处理分页
    while (sharesList.objects.length > 0) {
      // 删除过期的分享文件
      for (const obj of sharesList.objects) {
        try {
          // 检查文件是否过期
          if (obj.uploaded < expirationTime) {
            await bucket.delete(obj.key);
            result.shares.deleted++;
          }
        } catch (error) {
          result.errors.push({
            operation: 'delete_share',
            key: obj.key,
            error: error.message
          });
        }
      }
      
      // 获取下一页结果
      if (sharesList.truncated) {
        sharesList = await bucket.list({
          prefix: 'shares/',
          cursor: sharesList.cursor
        });
        result.shares.scanned += sharesList.objects.length;
      } else {
        break;
      }
    }
  } catch (error) {
    result.errors.push({
      operation: 'list_shares',
      error: error.message
    });
  }
  
  // 清理WAV文件
  try {
    // 列出wav/目录下的所有对象
    let wavsList = await bucket.list({ prefix: 'wav/' });
    result.wavFiles.scanned = wavsList.objects.length;
    
    // 处理分页
    while (wavsList.objects.length > 0) {
      // 删除过期的WAV文件
      for (const obj of wavsList.objects) {
        try {
          // 检查文件是否过期
          if (obj.uploaded < expirationTime) {
            await bucket.delete(obj.key);
            result.wavFiles.deleted++;
          }
        } catch (error) {
          result.errors.push({
            operation: 'delete_wav',
            key: obj.key,
            error: error.message
          });
        }
      }
      
      // 获取下一页结果
      if (wavsList.truncated) {
        wavsList = await bucket.list({
          prefix: 'wav/',
          cursor: wavsList.cursor
        });
        result.wavFiles.scanned += wavsList.objects.length;
      } else {
        break;
      }
    }
  } catch (error) {
    result.errors.push({
      operation: 'list_wavs',
      error: error.message
    });
  }
  
  return result;
} 
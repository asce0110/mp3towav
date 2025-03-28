/**
 * Cloudflare Worker脚本，用于定时清理R2存储桶中的过期文件
 * 
 * 部署指南:
 * 1. 安装Cloudflare Wrangler: npm install -g wrangler
 * 2. 登录Cloudflare: wrangler login
 * 3. 创建worker: wrangler init r2-cleaner
 * 4. 将此代码复制到worker目录
 * 5. 配置wrangler.toml文件:
 *    [triggers]
 *    crons = ["0 */6 * * *"]  # 每6小时运行一次
 * 6. 设置环境变量: wrangler secret put R2_BUCKET_NAME
 * 7. 部署: wrangler publish
 */

export default {
  async scheduled(event, env, ctx) {
    try {
      const result = await cleanupExpiredFiles(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('清理任务失败:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  
  // 可选：允许通过HTTP触发清理
  async fetch(request, env, ctx) {
    // 检查请求是否来自允许的IP或包含正确的访问令牌
    // 实际部署时应添加适当的安全验证
    
    try {
      const result = await cleanupExpiredFiles(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * 清理R2存储桶中的过期文件
 * @param {Object} env Worker环境变量
 * @returns {Object} 清理结果
 */
async function cleanupExpiredFiles(env) {
  // 确保已经绑定了R2存储桶
  if (!env.MP3TOWAV_BUCKET) {
    throw new Error('未找到R2存储桶绑定。请确保在wrangler.toml中正确配置了[[r2_buckets]]绑定。');
  }
  
  const bucket = env.MP3TOWAV_BUCKET;
  const now = new Date();
  
  // 计算24小时前的时间戳
  const expirationThreshold = new Date(now);
  expirationThreshold.setHours(now.getHours() - 24);
  
  console.log(`开始清理超过 ${expirationThreshold.toISOString()} 的文件`);
  
  // 列出所有对象
  let all_objects = [];
  let cursor;
  
  // 处理分页列表
  do {
    const options = cursor ? { cursor } : {};
    const list = await bucket.list(options);
    all_objects = all_objects.concat(list.objects);
    cursor = list.cursor;
  } while (cursor);
  
  console.log(`存储桶中共有 ${all_objects.length} 个文件`);
  
  // 筛选出过期文件
  const expiredObjects = all_objects.filter(obj => {
    return obj.uploaded < expirationThreshold;
  });
  
  console.log(`找到 ${expiredObjects.length} 个过期文件`);
  
  // 删除过期文件
  const deletionResults = {
    total: expiredObjects.length,
    deletedCount: 0,
    failedCount: 0,
    errors: []
  };
  
  for (const obj of expiredObjects) {
    try {
      await bucket.delete(obj.key);
      deletionResults.deletedCount++;
      console.log(`已删除: ${obj.key}`);
    } catch (error) {
      deletionResults.failedCount++;
      deletionResults.errors.push({
        key: obj.key,
        error: error.message
      });
      console.error(`删除失败: ${obj.key}`, error);
    }
  }
  
  // 返回结果
  return {
    timestamp: now.toISOString(),
    expirationThreshold: expirationThreshold.toISOString(),
    totalFiles: all_objects.length,
    expiredFiles: expiredObjects.length,
    deletionResults
  };
} 
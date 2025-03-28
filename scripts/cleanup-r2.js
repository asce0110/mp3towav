/**
 * R2存储桶定时清理脚本
 * 删除超过24小时的文件
 * 
 * 使用方法:
 * 1. 确保已设置环境变量: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 * 2. 执行: node scripts/cleanup-r2.js
 * 
 * 可以设置为cron任务，每小时运行一次:
 * 0 * * * * node /path/to/scripts/cleanup-r2.js >> /path/to/logs/r2-cleanup.log 2>&1
 */

// 导入必要的模块
require('dotenv').config({ path: '.env.local' });
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// 检查配置
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('错误: 缺少R2配置。请确保设置了所有必要的环境变量。');
  process.exit(1);
}

// 创建R2客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 列出R2存储桶中的所有文件
 * @param {string} [continuationToken] 分页标记
 * @param {Array} [accumulatedFiles=[]] 累积的文件列表
 * @returns {Promise<Array>} 文件对象数组
 */
async function listAllFiles(continuationToken, accumulatedFiles = []) {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    MaxKeys: 1000,
    ContinuationToken: continuationToken,
  });

  const response = await r2Client.send(command);
  
  // 合并结果
  const allFiles = [...accumulatedFiles, ...(response.Contents || [])];
  
  // 如果有更多结果，继续获取
  if (response.IsTruncated) {
    return listAllFiles(response.NextContinuationToken, allFiles);
  }
  
  return allFiles;
}

/**
 * 删除单个文件
 * @param {string} key 文件键
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteFile(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error(`删除文件失败: ${key}`, error);
    return false;
  }
}

/**
 * 主函数 - 清理超过指定时间的文件
 * @param {number} [hoursThreshold=24] 时间阈值(小时)
 */
async function cleanupOldFiles(hoursThreshold = 24) {
  console.log(`===== ${new Date().toISOString()} - 开始R2存储桶清理 =====`);
  console.log(`清理超过 ${hoursThreshold} 小时的文件`);
  
  try {
    // 计算时间阈值
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);
    
    console.log(`时间阈值: ${thresholdDate.toISOString()}`);
    
    // 获取所有文件
    console.log('获取存储桶中的所有文件...');
    const files = await listAllFiles();
    console.log(`共找到 ${files.length} 个文件`);
    
    // 筛选出过期文件
    const expiredFiles = files.filter(file => {
      return new Date(file.LastModified) < thresholdDate;
    });
    
    console.log(`找到 ${expiredFiles.length} 个超过 ${hoursThreshold} 小时的文件`);
    
    // 删除过期文件
    if (expiredFiles.length > 0) {
      console.log('开始删除过期文件...');
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const file of expiredFiles) {
        const success = await deleteFile(file.Key);
        if (success) {
          successCount++;
          console.log(`已删除: ${file.Key} (修改于 ${file.LastModified})`);
        } else {
          failureCount++;
        }
      }
      
      console.log(`删除完成: 成功=${successCount}, 失败=${failureCount}`);
    } else {
      console.log('没有需要删除的文件');
    }
    
    console.log('R2存储桶清理完成');
  } catch (error) {
    console.error('R2存储桶清理失败:', error);
  }
  
  console.log(`===== ${new Date().toISOString()} - 清理结束 =====\n`);
}

// 立即执行清理
cleanupOldFiles()
  .then(() => {
    console.log('清理任务执行完毕');
  })
  .catch(error => {
    console.error('清理任务执行失败:', error);
    process.exit(1);
  }); 
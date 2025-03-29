#!/usr/bin/env node

/**
 * 此脚本用于清理R2存储中的过期文件和分享链接
 * 可以通过Cloudflare Workers或作为定时任务运行
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// 从环境变量获取R2配置
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME;

// 检查配置是否完整
if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
  console.error('错误: R2配置不完整，请设置所有必要的环境变量');
  console.error('需要设置: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  process.exit(1);
}

// 创建S3客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

// 计算过期时间 (24小时之前)
const expirationTime = Date.now() - 24 * 60 * 60 * 1000;
console.log(`清理早于 ${new Date(expirationTime).toISOString()} 的对象`);

// 列出并清理分享信息文件
async function cleanupSharesFiles() {
  console.log('开始清理分享信息文件...');
  
  try {
    // 列出shares/目录中的文件
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      Prefix: 'shares/',
    });
    
    let count = 0;
    let expiredCount = 0;
    
    // 处理分页返回的结果
    let isTruncated = true;
    let continuationToken = undefined;
    
    while (isTruncated) {
      const response = await r2Client.send(
        new ListObjectsV2Command({
          Bucket: r2BucketName,
          Prefix: 'shares/',
          ContinuationToken: continuationToken,
        })
      );
      
      const objects = response.Contents || [];
      count += objects.length;
      
      for (const obj of objects) {
        // 检查对象是否过期
        try {
          // 获取对象的元数据
          const headCommand = new ListObjectsV2Command({
            Bucket: r2BucketName,
            Prefix: obj.Key,
            MaxKeys: 1,
          });
          
          const headResponse = await r2Client.send(headCommand);
          const objDetails = headResponse.Contents && headResponse.Contents[0];
          
          // 检查最后修改时间是否早于过期时间
          if (objDetails && objDetails.LastModified && objDetails.LastModified.getTime() < expirationTime) {
            console.log(`删除过期的分享文件: ${obj.Key}`);
            
            await r2Client.send(
              new DeleteObjectCommand({
                Bucket: r2BucketName,
                Key: obj.Key,
              })
            );
            
            expiredCount++;
          }
        } catch (error) {
          console.error(`获取对象元数据时出错 (${obj.Key}):`, error);
        }
      }
      
      // 检查是否有更多结果
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }
    
    console.log(`扫描了 ${count} 个分享文件，删除了 ${expiredCount} 个过期文件`);
  } catch (error) {
    console.error('清理分享文件时出错:', error);
  }
}

// 列出并清理WAV文件
async function cleanupWavFiles() {
  console.log('开始清理WAV文件...');
  
  try {
    // 列出wav/目录中的文件
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      Prefix: 'wav/',
    });
    
    let count = 0;
    let expiredCount = 0;
    
    // 处理分页返回的结果
    let isTruncated = true;
    let continuationToken = undefined;
    
    while (isTruncated) {
      const response = await r2Client.send(
        new ListObjectsV2Command({
          Bucket: r2BucketName,
          Prefix: 'wav/',
          ContinuationToken: continuationToken,
        })
      );
      
      const objects = response.Contents || [];
      count += objects.length;
      
      for (const obj of objects) {
        // 检查对象是否过期
        try {
          // 获取对象的元数据
          const headCommand = new ListObjectsV2Command({
            Bucket: r2BucketName,
            Prefix: obj.Key,
            MaxKeys: 1,
          });
          
          const headResponse = await r2Client.send(headCommand);
          const objDetails = headResponse.Contents && headResponse.Contents[0];
          
          // 检查最后修改时间是否早于过期时间
          if (objDetails && objDetails.LastModified && objDetails.LastModified.getTime() < expirationTime) {
            console.log(`删除过期的WAV文件: ${obj.Key}`);
            
            await r2Client.send(
              new DeleteObjectCommand({
                Bucket: r2BucketName,
                Key: obj.Key,
              })
            );
            
            expiredCount++;
          }
        } catch (error) {
          console.error(`获取对象元数据时出错 (${obj.Key}):`, error);
        }
      }
      
      // 检查是否有更多结果
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }
    
    console.log(`扫描了 ${count} 个WAV文件，删除了 ${expiredCount} 个过期文件`);
  } catch (error) {
    console.error('清理WAV文件时出错:', error);
  }
}

// 运行清理任务
async function runCleanup() {
  console.log('开始清理R2存储中的过期文件...');
  
  try {
    await cleanupSharesFiles();
    await cleanupWavFiles();
    console.log('R2存储清理完成!');
  } catch (error) {
    console.error('R2存储清理失败:', error);
  }
}

// 执行清理任务
runCleanup().catch(error => {
  console.error('执行清理任务时发生错误:', error);
  process.exit(1);
}); 
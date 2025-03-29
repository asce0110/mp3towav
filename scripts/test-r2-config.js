#!/usr/bin/env node

/**
 * 测试R2配置并验证连接
 * 运行方式: node scripts/test-r2-config.js
 */

const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

// 获取环境变量
const r2AccountId = process.env.R2_ACCOUNT_ID || '';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const r2BucketName = process.env.R2_BUCKET_NAME || '';

console.log('===== R2 配置状态 =====');
console.log(`R2_ACCOUNT_ID: ${r2AccountId ? '已设置' : '未设置'} ${r2AccountId ? `(${r2AccountId.slice(0, 3)}...)` : ''}`);
console.log(`R2_ACCESS_KEY_ID: ${r2AccessKeyId ? '已设置' : '未设置'} ${r2AccessKeyId ? `(${r2AccessKeyId.slice(0, 3)}...)` : ''}`);
console.log(`R2_SECRET_ACCESS_KEY: ${r2SecretAccessKey ? '已设置' : '未设置'} ${r2SecretAccessKey ? '(已隐藏)' : ''}`);
console.log(`R2_BUCKET_NAME: ${r2BucketName ? '已设置' : '未设置'} ${r2BucketName || ''}`);

// 检查R2配置是否完整
const isR2Configured = !!(
  r2AccountId && 
  r2AccessKeyId && 
  r2SecretAccessKey && 
  r2BucketName
);

if (!isR2Configured) {
  console.error('\n❌ R2配置不完整，请在.env文件中设置所有必要的环境变量');
  process.exit(1);
}

console.log('\n正在尝试连接R2...');

// 初始化S3客户端
const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
const r2Client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

// 测试连接并列出对象
async function testConnection() {
  try {
    console.log('测试R2连接中...');
    
    // 获取桶中的内容
    const listCommand = new ListObjectsV2Command({
      Bucket: r2BucketName,
      MaxKeys: 10,
    });
    
    const result = await r2Client.send(listCommand);
    console.log('\n✅ 成功连接到R2!');
    console.log(`存储桶: ${r2BucketName}`);
    console.log(`对象数量: ${result.Contents?.length || 0}`);
    
    if (result.Contents && result.Contents.length > 0) {
      console.log('\n前10个对象:');
      result.Contents.forEach((object, index) => {
        console.log(`${index + 1}. ${object.Key} - ${object.Size} bytes (${new Date(object.LastModified).toISOString()})`);
      });
    } else {
      console.log('\n存储桶为空，没有对象');
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ R2连接失败:', error.message);
    console.error('错误详情:', error);
    return false;
  }
}

// 执行测试
testConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ R2配置测试完成，所有功能正常');
    } else {
      console.error('\n❌ R2配置测试失败，请检查配置并重试');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ 测试执行出错:', err);
    process.exit(1);
  }); 
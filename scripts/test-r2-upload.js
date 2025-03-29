#!/usr/bin/env node

/**
 * 测试R2上传功能
 * 运行方式: node scripts/test-r2-upload.js
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
try {
  // 优先尝试加载.env.local
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
    console.log('已从.env.local加载环境变量');
  } else {
    // 回退到.env
    dotenv.config();
    console.log('已从.env加载环境变量');
  }
} catch (error) {
  console.warn('加载环境变量文件失败:', error);
}

// 检查命令行参数
const args = process.argv.slice(2);
const targetPath = args[0] || 'test/test-upload-' + Date.now() + '.wav';

// 获取R2环境变量
const r2AccountId = process.env.R2_ACCOUNT_ID || '';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const r2BucketName = process.env.R2_BUCKET_NAME || '';

// 初始化S3客户端
let r2Client = null;

// 测试文件的内容和临时路径
const testDataSize = 1044; // 约1KB的测试数据
const tmpFilePath = path.join(process.cwd(), 'tmp', 'r2-test-upload.wav');

// 输出头部
console.log('===== R2 上传测试 =====');

// 检查R2配置
function checkR2Config() {
  console.log(`R2_ACCOUNT_ID: ${r2AccountId ? '已设置 (' + r2AccountId.substring(0, 3) + '...)' : '未设置'}`);
  console.log(`R2_ACCESS_KEY_ID: ${r2AccessKeyId ? '已设置 (' + r2AccessKeyId.substring(0, 3) + '...)' : '未设置'}`);
  console.log(`R2_SECRET_ACCESS_KEY: ${r2SecretAccessKey ? '已设置 (已隐藏)' : '未设置'}`);
  console.log(`R2_BUCKET_NAME: ${r2BucketName ? '已设置 ' + r2BucketName : '未设置'}`);
  console.log('');

  // 检查环境变量是否都已设置
  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
    console.error('❌ R2环境变量配置不完整，请检查');
    process.exit(1);
  }
}

// 初始化R2客户端
function initR2Client() {
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey
      }
    });
    return true;
  } catch (error) {
    console.error('❌ 初始化R2客户端失败:', error.message);
    return false;
  }
}

// 创建测试文件
function createTestFile() {
  try {
    // 确保目录存在
    const tmpDir = path.dirname(tmpFilePath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // 创建测试数据 (包含RIFF WAV头部的模拟数据)
    const buffer = Buffer.alloc(testDataSize);
    buffer.write('RIFF', 0);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.write('data', 36);
    
    // 写入文件
    fs.writeFileSync(tmpFilePath, buffer);
    return true;
  } catch (error) {
    console.error('❌ 创建测试文件失败:', error.message);
    return false;
  }
}

// 上传测试文件到R2
async function uploadTestFile(filePath, targetKey) {
  try {
    console.log('正在上传测试文件到R2...');
    
    // 读取文件数据
    const fileData = fs.readFileSync(filePath);
    const timestamp = new Date().toISOString();
    
    // 构建上传命令
    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: targetKey,
      Body: fileData,
      ContentType: 'audio/wav',
      Metadata: {
        'source': 'test-script',
        'timestamp': timestamp,
        'test-id': `test-${Date.now()}`
      }
    });
    
    // 发送上传命令
    const result = await r2Client.send(command);
    
    console.log('\n✅ 文件上传成功!');
    console.log(`文件路径: ${targetKey}`);
    console.log(`ETag: ${result.ETag}`);
    console.log(`大小: ${fileData.length} bytes`);
    
    return true;
  } catch (error) {
    console.error('\n❌ 文件上传失败:', error.message);
    console.error('错误详情:', error);
    return false;
  }
}

// 检查文件是否已上传成功
async function verifyUpload(key) {
  try {
    console.log('\n检查文件是否已成功上传...');
    
    const command = new HeadObjectCommand({
      Bucket: r2BucketName,
      Key: key
    });
    
    await r2Client.send(command);
    console.log(`✅ 验证成功! 文件已存在于R2: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ 验证失败! 文件不存在于R2: ${key}`);
    console.error('错误详情:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  checkR2Config();
  
  if (!initR2Client()) {
    process.exit(1);
  }
  
  if (!createTestFile()) {
    process.exit(1);
  }
  
  const uploadSuccess = await uploadTestFile(tmpFilePath, targetPath);
  
  if (uploadSuccess) {
    // 验证上传
    await verifyUpload(targetPath);
    console.log('\n✅ R2上传测试成功');
  } else {
    console.log('\n❌ R2上传测试失败');
    process.exit(1);
  }
  
  // 清理临时文件
  try {
    fs.unlinkSync(tmpFilePath);
  } catch (error) {
    // 忽略清理错误
  }
}

// 运行主函数
main().catch(error => {
  console.error('\n❌ 测试过程中出现异常:', error);
  process.exit(1);
}); 
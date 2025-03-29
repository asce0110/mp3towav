#!/usr/bin/env node

/**
 * 测试R2上传功能
 * 运行方式: node scripts/test-r2-upload.js
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 获取环境变量
const r2AccountId = process.env.R2_ACCOUNT_ID || '';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const r2BucketName = process.env.R2_BUCKET_NAME || '';

console.log('===== R2 上传测试 =====');
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

// 创建临时测试文件
function createTestFile() {
  const testDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFilePath = path.join(testDir, 'test.wav');
  
  // 创建一个简单的WAV文件
  const wavHeader = Buffer.alloc(44);
  
  // RIFF标头
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + 1000, 4);
  wavHeader.write('WAVE', 8);
  
  // fmt子块
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // fmt块大小
  wavHeader.writeUInt16LE(1, 20); // 音频格式(PCM)
  wavHeader.writeUInt16LE(1, 22); // 声道数
  wavHeader.writeUInt32LE(44100, 24); // 采样率
  wavHeader.writeUInt32LE(44100 * 1 * 2, 28); // 字节率
  wavHeader.writeUInt16LE(2, 32); // 块对齐
  wavHeader.writeUInt16LE(16, 34); // 位深度
  
  // data子块
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(1000, 40);
  
  // 创建一些示例音频数据 (简单的正弦波)
  const sampleData = Buffer.alloc(1000);
  for (let i = 0; i < 500; i++) {
    const value = Math.floor(Math.sin(i / 10) * 32767);
    sampleData.writeInt16LE(value, i * 2);
  }
  
  // 写入文件
  fs.writeFileSync(testFilePath, Buffer.concat([wavHeader, sampleData]));
  console.log(`\n创建测试文件: ${testFilePath} (${wavHeader.length + sampleData.length} bytes)`);
  
  return testFilePath;
}

// 上传测试文件到R2
async function uploadTestFile(filePath) {
  try {
    console.log('正在上传测试文件到R2...');
    
    // 读取文件数据
    const fileData = fs.readFileSync(filePath);
    const timestamp = new Date().toISOString();
    const key = `test/test-upload-${Date.now()}.wav`;
    
    // 构建上传命令
    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
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
    console.log(`文件路径: ${key}`);
    console.log(`ETag: ${result.ETag}`);
    console.log(`大小: ${fileData.length} bytes`);
    
    return true;
  } catch (error) {
    console.error('\n❌ 文件上传失败:', error.message);
    console.error('错误详情:', error);
    return false;
  }
}

// 执行测试
async function runTest() {
  try {
    const testFilePath = createTestFile();
    const uploadResult = await uploadTestFile(testFilePath);
    
    if (uploadResult) {
      console.log('\n✅ R2上传测试成功');
    } else {
      console.error('\n❌ R2上传测试失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 测试执行出错:', error);
    process.exit(1);
  }
}

// 运行测试
runTest(); 
const S3Client = require('@aws-sdk/client-s3').S3Client;
const { ListObjectsCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 加载环境变量
dotenv.config({ path: '.env.local' });
dotenv.config();

// R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mp3towav';

console.log('检查 Cloudflare R2 配置...');
console.log('-'.repeat(50));

// 检查环境变量
const configCheck = {
  accountId: !!R2_ACCOUNT_ID,
  accessKeyId: !!R2_ACCESS_KEY_ID,
  secretAccessKey: !!R2_SECRET_ACCESS_KEY,
  bucketName: !!R2_BUCKET_NAME,
};

console.log('环境变量检查:');
console.log(` - R2_ACCOUNT_ID: ${configCheck.accountId ? '已设置' : '未设置'}`);
console.log(` - R2_ACCESS_KEY_ID: ${configCheck.accessKeyId ? '已设置' : '未设置'}`);
console.log(` - R2_SECRET_ACCESS_KEY: ${configCheck.secretAccessKey ? '已设置' : '未设置'}`);
console.log(` - R2_BUCKET_NAME: ${configCheck.bucketName ? R2_BUCKET_NAME : '未设置'}`);

const isConfigComplete = Object.values(configCheck).every(Boolean);
console.log(`\n配置完整性: ${isConfigComplete ? '完整' : '不完整'}`);

if (!isConfigComplete) {
  console.error('\n错误: R2 配置不完整。请确保所有必要的环境变量都已设置。');
  process.exit(1);
}

// 测试 R2 连接
async function testR2Connection() {
  console.log('\n测试 R2 连接...');
  
  try {
    // 创建 R2 客户端
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    
    console.log('R2 客户端创建成功');
    
    // 尝试列出存储桶内容以验证连接
    const command = new ListObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      MaxKeys: 5,
    });
    
    console.log(`尝试列出 ${R2_BUCKET_NAME} 存储桶中的对象...`);
    const response = await client.send(command);
    
    if (response.$metadata.httpStatusCode === 200) {
      console.log('连接成功! 能够访问 R2 存储桶。');
      
      // 显示对象信息
      const objectCount = response.Contents ? response.Contents.length : 0;
      console.log(`存储桶中有 ${objectCount} 个对象。`);
      
      if (objectCount > 0) {
        console.log('\n前几个对象:');
        response.Contents.forEach((item, i) => {
          console.log(` ${i+1}. ${item.Key} (${item.Size} 字节, 最后修改: ${item.LastModified})`);
        });
      }
      
      return true;
    } else {
      console.error(`连接测试失败: HTTP 状态码 ${response.$metadata.httpStatusCode}`);
      return false;
    }
  } catch (error) {
    console.error('R2 连接错误:', error.message);
    console.error('\n完整错误:');
    console.error(error);
    return false;
  }
}

// 测试创建测试文件
async function createTestFile() {
  console.log('\n创建测试文件以验证文件操作...');
  
  // 创建本地测试目录
  const testDir = path.join(process.cwd(), 'tmp');
  const testFile = path.join(testDir, 'r2-test.txt');
  
  if (!fs.existsSync(testDir)) {
    console.log(`创建测试目录: ${testDir}`);
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // 写入测试文件
  const testContent = `R2 连接测试文件\n创建时间: ${new Date().toISOString()}\n`;
  fs.writeFileSync(testFile, testContent);
  console.log(`创建了测试文件: ${testFile}`);
  
  return testFile;
}

// 运行测试
async function run() {
  try {
    const connectionSuccess = await testR2Connection();
    
    if (connectionSuccess) {
      await createTestFile();
      console.log('\nR2 配置检查和连接测试成功完成!');
      
      console.log('\n接下来的步骤:');
      console.log('1. 确认 "app/api/test-r2/route.ts" 是否存在并正确配置');
      console.log('2. 访问 "/api/test-r2" 端点以运行完整的 R2 功能测试');
      console.log('3. 检查服务器日志以获取详细的诊断信息');
    } else {
      console.error('\nR2 连接测试失败。请检查凭据和网络连接。');
      process.exit(1);
    }
  } catch (error) {
    console.error('脚本运行错误:', error);
    process.exit(1);
  }
}

run(); 
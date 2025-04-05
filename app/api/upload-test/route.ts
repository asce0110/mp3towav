import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { uploadToR2, isR2Configured, validateR2Connection } from '@/lib/r2';

// 临时文件存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');

// 确保临时目录存在
if (!fs.existsSync(TMP_DIR)) {
  try {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    console.log(`[上传测试] 创建临时目录成功: ${TMP_DIR}`);
  } catch (err) {
    console.error(`[上传测试] 创建临时目录失败: ${TMP_DIR}`, err);
  }
}

/**
 * 上传测试API - 逐步测试上传过程
 */
export async function GET(request: NextRequest) {
  console.log('[上传测试] 开始测试上传流程');
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: {}
  };
  
  // 步骤1: 检查临时目录
  try {
    const testFile = path.join(TMP_DIR, `test-write-${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'test content');
    const content = fs.readFileSync(testFile, 'utf8');
    fs.unlinkSync(testFile);
    
    results.steps.tempDir = {
      success: true,
      path: TMP_DIR,
      testResult: content === 'test content' ? '文件读写测试成功' : '文件内容不匹配'
    };
  } catch (error: any) {
    results.steps.tempDir = {
      success: false,
      path: TMP_DIR,
      error: error.message || String(error)
    };
    console.error('[上传测试] 临时目录测试失败:', error);
  }
  
  // 步骤2: 检查R2配置
  results.steps.r2Config = {
    isConfigured: isR2Configured,
    accountId: !!process.env.R2_ACCOUNT_ID,
    accessKeyId: !!process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
    bucketName: !!process.env.R2_BUCKET_NAME,
    publicUrl: !!process.env.CLOUDFLARE_PUBLIC_URL,
    nodeEnv: process.env.NODE_ENV,
    tlsReject: process.env.NODE_TLS_REJECT_UNAUTHORIZED
  };
  
  // 如果R2未配置，提前结束测试
  if (!isR2Configured) {
    results.steps.r2Config.message = 'R2未配置，测试中止';
    return NextResponse.json(results);
  }
  
  // 步骤3: 测试R2连接
  try {
    const connectionResult = await validateR2Connection();
    results.steps.r2Connection = {
      success: connectionResult,
      message: connectionResult ? 'R2连接成功' : 'R2连接失败但未抛出异常'
    };
  } catch (error: any) {
    results.steps.r2Connection = {
      success: false,
      error: error.message || String(error)
    };
    console.error('[上传测试] R2连接测试失败:', error);
  }
  
  // 如果R2连接失败，提前结束测试
  if (results.steps.r2Connection && !results.steps.r2Connection.success) {
    results.steps.r2Connection.message = 'R2连接失败，测试中止';
    return NextResponse.json(results);
  }
  
  // 步骤4: 创建测试文件
  const testId = uuidv4();
  const testFileName = `test-${testId}.txt`;
  const testFilePath = path.join(TMP_DIR, testFileName);
  const testContent = `这是一个测试文件，用于验证上传流程。\nID: ${testId}\n时间戳: ${new Date().toISOString()}\n`;
  
  try {
    fs.writeFileSync(testFilePath, testContent);
    results.steps.createTestFile = {
      success: true,
      path: testFilePath,
      size: fs.statSync(testFilePath).size,
      content: testContent
    };
  } catch (error: any) {
    results.steps.createTestFile = {
      success: false,
      error: error.message || String(error)
    };
    console.error('[上传测试] 创建测试文件失败:', error);
    return NextResponse.json(results);
  }
  
  // 步骤5: 读取测试文件到Buffer
  let fileBuffer: Buffer;
  try {
    fileBuffer = fs.readFileSync(testFilePath);
    results.steps.readFileBuffer = {
      success: true,
      size: fileBuffer.length,
      matches: fileBuffer.toString('utf8') === testContent
    };
  } catch (error: any) {
    results.steps.readFileBuffer = {
      success: false,
      error: error.message || String(error)
    };
    console.error('[上传测试] 读取文件到Buffer失败:', error);
    return NextResponse.json(results);
  }
  
  // 步骤6: 上传到R2
  try {
    console.log(`[上传测试] 开始上传测试文件到R2: ${testFileName}`);
    const uploadStart = Date.now();
    
    const uploadSuccess = await uploadToR2(
      `test/${testFileName}`,
      fileBuffer,
      {
        'test_id': testId,
        'source': 'upload-test-api',
        'content_type': 'text/plain'
      },
      'text/plain'
    );
    
    const uploadDuration = Date.now() - uploadStart;
    
    results.steps.uploadToR2 = {
      success: uploadSuccess,
      duration: uploadDuration,
      fileKey: `test/${testFileName}`
    };
    
    if (!uploadSuccess) {
      results.steps.uploadToR2.message = '上传到R2失败，但未抛出异常';
    } else {
      // 构建访问URL
      const cloudflarePublicUrl = process.env.CLOUDFLARE_PUBLIC_URL || 
                                 `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      
      const fileUrl = `${cloudflarePublicUrl}/test/${testFileName}`;
      results.steps.uploadToR2.fileUrl = fileUrl;
    }
  } catch (error: any) {
    results.steps.uploadToR2 = {
      success: false,
      error: error.message || String(error)
    };
    console.error('[上传测试] 上传到R2失败:', error);
  }
  
  // 步骤7: 清理测试文件
  try {
    fs.unlinkSync(testFilePath);
    results.steps.cleanup = {
      success: true,
      message: '测试文件已删除'
    };
  } catch (error: any) {
    results.steps.cleanup = {
      success: false,
      error: error.message || String(error)
    };
    console.error('[上传测试] 删除测试文件失败:', error);
  }
  
  // 返回完整测试结果
  return NextResponse.json(results);
} 
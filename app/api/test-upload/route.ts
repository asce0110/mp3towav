import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2, isR2Configured, fileExistsInR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  console.log(`[Test Upload API] 开始测试R2上传 ${testId}`);
  
  // 检查R2配置
  console.log(`[Test Upload API] R2配置状态: ${isR2Configured ? '已配置' : '未配置'}`);
  
  if (!isR2Configured) {
    return NextResponse.json({
      success: false,
      error: 'R2未配置',
      configStatus: {
        R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME
      }
    }, { status: 500 });
  }
  
  // 创建测试内容
  const testContent = Buffer.from(`这是测试上传文件 ${testId} 创建于 ${timestamp}`);
  const key = `test/r2-test-${Date.now()}.txt`;
  
  try {
    console.log(`[Test Upload API] 开始上传测试文件 ${key}, 大小: ${testContent.length} 字节`);
    
    // 执行上传
    const uploadResult = await uploadToR2(
      key,
      testContent,
      { 'test-id': testId, 'timestamp': timestamp },
      'text/plain'
    );
    
    console.log(`[Test Upload API] 上传结果: ${uploadResult ? '成功' : '失败'}`);
    
    // 验证文件是否已上传
    let fileExists = false;
    try {
      fileExists = await fileExistsInR2(key);
      console.log(`[Test Upload API] 文件验证结果: ${fileExists ? '存在' : '不存在'}`);
    } catch (verifyError) {
      console.error(`[Test Upload API] 验证文件时出错:`, verifyError);
    }
    
    return NextResponse.json({
      success: uploadResult,
      key,
      fileExists,
      size: testContent.length,
      metadata: {
        'test-id': testId,
        'timestamp': timestamp
      }
    });
  } catch (error) {
    console.error(`[Test Upload API] 测试过程中出错:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      key
    }, { status: 500 });
  }
} 
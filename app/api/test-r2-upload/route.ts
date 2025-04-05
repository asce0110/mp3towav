import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2, isR2Configured } from '@/lib/r2';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * 测试R2上传功能的API端点
 */
export async function GET(request: NextRequest) {
  console.log('[测试R2上传] 开始测试');
  
  // 检查环境变量
  console.log('[测试R2上传] 环境变量检查:',
    {
      NODE_ENV: process.env.NODE_ENV,
      R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    }
  );
  
  if (!isR2Configured) {
    console.error('[测试R2上传] R2未配置，无法测试上传');
    return NextResponse.json({
      success: false,
      error: 'R2未配置',
      message: '请先配置R2环境变量'
    }, { status: 500 });
  }
  
  // 创建测试文件
  const testId = uuidv4();
  const testContent = Buffer.from(`这是一个测试文件，ID: ${testId}, 创建时间: ${new Date().toISOString()}`);
  const fileName = `test-${testId}.txt`;
  
  try {
    // 上传到R2
    console.log(`[测试R2上传] 开始上传测试文件: ${fileName}`);
    
    const uploadSuccess = await uploadToR2(
      fileName,
      testContent,
      {
        'test_id': testId,
        'source': 'api-test',
        'content_type': 'text/plain'
      },
      'text/plain'
    );
    
    if (!uploadSuccess) {
      console.error(`[测试R2上传] 上传失败: ${fileName}`);
      return NextResponse.json({
        success: false,
        error: '上传到R2失败',
        message: '上传过程中发生错误'
      }, { status: 500 });
    }
    
    // 构建公共访问URL
    const cloudflarePublicUrl = process.env.CLOUDFLARE_PUBLIC_URL || 
                              `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    const fileUrl = `${cloudflarePublicUrl}/${fileName}`;
    
    console.log(`[测试R2上传] 上传成功，文件URL: ${fileUrl}`);
    
    return NextResponse.json({
      success: true,
      message: '测试文件上传成功',
      fileId: testId,
      fileName: fileName,
      fileUrl: fileUrl,
      uploadTime: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[测试R2上传] 测试过程中出错:', error);
    
    // 记录错误详情
    if (error instanceof Error) {
      console.error(`[测试R2上传] 错误类型: ${error.constructor.name}`);
      console.error(`[测试R2上传] 错误消息: ${error.message}`);
      console.error(`[测试R2上传] 错误堆栈: ${error.stack}`);
    }
    
    return NextResponse.json({
      success: false,
      error: '测试上传出错',
      details: error.message || '未知错误',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 
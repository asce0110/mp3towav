import { NextRequest, NextResponse } from 'next/server';
import { 
  isR2Configured, 
  validateR2Connection, 
  r2Client, 
  uploadToR2,
  generatePresignedUrl,
  listFilesInR2
} from '@/lib/r2';
import fs from 'fs';
import path from 'path';

/**
 * API端点测试R2连接状态
 */
export async function GET(request: NextRequest) {
  try {
    // 获取R2配置状态
    const r2Status = {
      isConfigured: isR2Configured,
      clientInitialized: !!r2Client,
    };
    
    console.log('获取R2连接状态...');
    
    // 如果R2配置可用，测试连接并进行高级操作
    if (isR2Configured && r2Client) {
      console.log('R2配置可用，测试连接...');
      
      // 测试R2连接
      const isConnected = await validateR2Connection();
      r2Status.isConnected = isConnected;
      
      if (isConnected) {
        console.log('R2连接成功，执行更多测试...');
        
        // 创建一个测试文件
        const testFileContent = Buffer.from(`R2连接测试 - ${new Date().toISOString()}`);
        const testFileKey = `test/test-connection-${Date.now()}.txt`;
        
        // 上传测试文件
        console.log(`上传测试文件: ${testFileKey}`);
        const uploadSuccess = await uploadToR2(
          testFileKey,
          testFileContent,
          { testFile: 'true' },
          'text/plain'
        );
        
        r2Status.uploadTest = uploadSuccess;
        
        if (uploadSuccess) {
          console.log('测试文件上传成功');
          
          // 生成预签名URL
          console.log('生成预签名URL');
          const url = await generatePresignedUrl(testFileKey, 3600); // 1小时有效期
          r2Status.presignedUrlTest = !!url;
          
          // 列出文件
          console.log('列出测试文件夹内容');
          const files = await listFilesInR2('test/');
          r2Status.listFilesTest = {
            success: true,
            fileCount: files.length,
            sampleFiles: files.slice(0, 3)
          };
        }
      } else {
        console.error('R2连接测试失败');
      }
    } else {
      console.log('R2未配置或客户端初始化失败');
    }
    
    return NextResponse.json({
      success: true,
      r2Status
    });
  } catch (error) {
    console.error('测试R2连接时出错:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to test R2 connection',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
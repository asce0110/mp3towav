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

// 定义R2状态接口
interface R2Status {
  isConfigured: boolean;
  clientInitialized: boolean;
  isConnected?: boolean;
  uploadTest?: boolean;
  presignedUrlTest?: boolean;
  listFilesTest?: {
    success: boolean;
    fileCount: number;
    sampleFiles: string[];
  };
}

/**
 * API端点测试R2连接状态
 */
export async function GET(request: NextRequest) {
  try {
    // 获取R2配置状态
    const r2Status: R2Status = {
      isConfigured: isR2Configured,
      clientInitialized: !!r2Client,
    };
    
    // 如果R2已配置，验证连接
    if (isR2Configured && r2Client) {
      // 测试连接
      r2Status.isConnected = await validateR2Connection();
      
      // 如果连接成功，测试文件操作
      if (r2Status.isConnected) {
        // 创建一个临时文件用于测试
        const testFilePath = path.join(process.cwd(), 'tmp', 'r2-test.txt');
        const testContent = `Test file generated at ${new Date().toISOString()}`;
        
        try {
          // 确保tmp目录存在
          if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
            fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
          }
          
          // 写入测试文件
          fs.writeFileSync(testFilePath, testContent);
          console.log(`R2测试: 创建了测试文件 ${testFilePath}`);
          
          // 测试上传
          const testBuffer = fs.readFileSync(testFilePath);
          const testKey = `test/r2-test-${Date.now()}.txt`;
          r2Status.uploadTest = await uploadToR2(
            testKey, 
            testBuffer,
            { 'source': 'test-api' },
            'text/plain'
          );
          
          // 测试预签名URL
          if (r2Status.uploadTest) {
            const url = await generatePresignedUrl(testKey);
            r2Status.presignedUrlTest = !!url;
          }
          
          // 列出桶中的文件
          try {
            const files = await listFilesInR2();
            r2Status.listFilesTest = {
              success: true,
              fileCount: files.length,
              sampleFiles: files.slice(0, 5)
            };
          } catch (listError) {
            console.error('列出R2文件失败:', listError);
            r2Status.listFilesTest = {
              success: false,
              fileCount: 0,
              sampleFiles: []
            };
          }
        } catch (fileError) {
          console.error('创建测试文件失败:', fileError);
          r2Status.uploadTest = false;
        }
      }
    }
    
    // 返回状态
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: "success",
      r2: r2Status
    });
  } catch (error: any) {
    console.error('R2测试失败:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: "error",
      message: error.message || "Unknown error",
      r2: { isConfigured: isR2Configured }
    }, { status: 500 });
  }
} 
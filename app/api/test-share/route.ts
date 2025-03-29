import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { 
  isR2Configured, 
  fileExistsInR2, 
  validateR2Connection,
  listR2Objects
} from '@/lib/r2';

// 临时文件目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 检查目录存在性和权限
async function checkDirectoryStatus(dir: string) {
  try {
    const exists = fs.existsSync(dir);
    let stats = null;
    let writable = false;
    let readable = false;
    let files = [];
    
    if (exists) {
      stats = fs.statSync(dir);
      
      try {
        // 测试目录可读性
        files = fs.readdirSync(dir);
        readable = true;
      } catch (e) {
        readable = false;
      }
      
      try {
        // 测试目录可写性
        const testFile = path.join(dir, `.test-${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'test');
        writable = true;
        try {
          fs.unlinkSync(testFile);
        } catch (e) {
          // 忽略
        }
      } catch (e) {
        writable = false;
      }
    }
    
    return {
      path: dir,
      exists,
      isDirectory: stats ? stats.isDirectory() : false,
      mode: stats ? stats.mode.toString(8) : null,
      writable,
      readable,
      fileCount: files.length,
      files: files.slice(0, 10) // 只返回前10个文件
    };
  } catch (error) {
    return {
      path: dir,
      exists: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 检查分享状态
export async function GET(request: NextRequest) {
  const shareId = request.nextUrl.searchParams.get('id');
  const fileId = request.nextUrl.searchParams.get('fileId');
  
  console.log(`[API:test-share] 接收到测试请求: shareId=${shareId}, fileId=${fileId}`);
  
  try {
    // 准备结果对象
    const result: any = {
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      environment: {
        platform: process.platform,
        nodeEnv: process.env.NODE_ENV,
        cwd: process.cwd(),
        isVercel: process.env.VERCEL === '1',
        isR2Configured
      },
      directories: {},
      r2Status: {},
      shareStatus: {},
      fileStatus: {}
    };
    
    // 检查目录状态
    result.directories.tmp = await checkDirectoryStatus(TMP_DIR);
    result.directories.shares = await checkDirectoryStatus(SHARES_DIR);
    
    // 检查R2连接
    if (isR2Configured) {
      try {
        const isConnected = await validateR2Connection();
        result.r2Status.connected = isConnected;
        
        // 列出R2对象
        try {
          const objects = await listR2Objects('shares/', 20);
          result.r2Status.shareObjects = objects.map((obj: any) => ({
            key: obj.key,
            size: obj.size,
            lastModified: obj.lastModified
          }));
        } catch (e) {
          result.r2Status.listSharesError = e instanceof Error ? e.message : String(e);
        }
        
        try {
          const objects = await listR2Objects('wav/', 20);
          result.r2Status.wavObjects = objects.map((obj: any) => ({
            key: obj.key,
            size: obj.size,
            lastModified: obj.lastModified
          }));
        } catch (e) {
          result.r2Status.listWavsError = e instanceof Error ? e.message : String(e);
        }
      } catch (error) {
        result.r2Status.error = error instanceof Error ? error.message : String(error);
      }
    }
    
    // 如果提供了shareId，检查分享状态
    if (shareId) {
      // 检查R2中的分享文件
      if (isR2Configured) {
        try {
          const exists = await fileExistsInR2(`shares/${shareId}.json`);
          result.shareStatus.r2Exists = exists;
        } catch (e) {
          result.shareStatus.r2Error = e instanceof Error ? e.message : String(e);
        }
      }
      
      // 检查本地文件系统中的分享文件
      try {
        const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
        const exists = fs.existsSync(sharePath);
        result.shareStatus.localExists = exists;
        
        if (exists) {
          try {
            const content = fs.readFileSync(sharePath, 'utf-8');
            const shareInfo = JSON.parse(content);
            result.shareStatus.shareInfo = shareInfo;
          } catch (e) {
            result.shareStatus.readError = e instanceof Error ? e.message : String(e);
          }
        }
      } catch (e) {
        result.shareStatus.localError = e instanceof Error ? e.message : String(e);
      }
    }
    
    // 如果提供了fileId，检查文件状态
    if (fileId) {
      // 检查R2中的WAV文件
      if (isR2Configured) {
        try {
          const exists = await fileExistsInR2(`wav/${fileId}.wav`);
          result.fileStatus.r2Exists = exists;
        } catch (e) {
          result.fileStatus.r2Error = e instanceof Error ? e.message : String(e);
        }
      }
      
      // 检查本地文件系统中的WAV文件
      try {
        const filePath = path.join(TMP_DIR, `${fileId}.wav`);
        const exists = fs.existsSync(filePath);
        result.fileStatus.localExists = exists;
        
        if (exists) {
          const stats = fs.statSync(filePath);
          result.fileStatus.fileSize = stats.size;
          result.fileStatus.fileCreated = stats.birthtime;
          result.fileStatus.fileModified = stats.mtime;
        }
      } catch (e) {
        result.fileStatus.localError = e instanceof Error ? e.message : String(e);
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to test share',
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    }, { status: 500 });
  }
} 
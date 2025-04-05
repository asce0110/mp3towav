import { NextRequest, NextResponse } from 'next/server';
import { isR2Configured, validateR2Connection, r2Client } from '@/lib/r2';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * 用于调试R2配置和连接的API
 */
export async function GET(request: NextRequest) {
  console.log('[R2调试] 开始检查R2配置和连接');
  
  // 创建临时文件夹路径
  const tmpDir = path.join(process.cwd(), 'tmp');
  const tmpExists = fs.existsSync(tmpDir);
  if (!tmpExists) {
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch (err) {
      console.error('[R2调试] 无法创建临时目录:', err);
    }
  }
  
  // 系统信息
  const systemInfo = {
    platform: os.platform(),
    release: os.release(),
    tmpdir: os.tmpdir(),
    freemem: os.freemem(),
    totalmem: os.totalmem(),
    uptime: os.uptime(),
    cwd: process.cwd(),
    tmpDirExists: tmpExists,
    tmpDirWritable: tmpExists ? await isDirectoryWritable(tmpDir) : false,
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV,
  };
  
  // 检查R2环境变量
  const envVarStatus = {
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
    CLOUDFLARE_PUBLIC_URL: !!process.env.CLOUDFLARE_PUBLIC_URL,
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    isConfigured: isR2Configured,
    clientInitialized: !!r2Client,
  };
  
  // 测试连接
  let connectionStatus = {
    success: false,
    message: '连接测试未执行',
    error: null
  };
  
  if (isR2Configured) {
    try {
      const isConnected = await validateR2Connection();
      connectionStatus = {
        success: isConnected,
        message: isConnected ? 'R2连接成功' : 'R2连接失败，但未抛出异常',
        error: null
      };
    } catch (error: any) {
      connectionStatus = {
        success: false,
        message: 'R2连接测试抛出异常',
        error: error.message || String(error)
      };
      console.error('[R2调试] 连接测试出错:', error);
    }
  } else {
    connectionStatus.message = 'R2未配置，跳过连接测试';
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    systemInfo,
    envVarStatus,
    connectionStatus
  });
}

/**
 * 测试目录是否可写
 */
async function isDirectoryWritable(dir: string): Promise<boolean> {
  const testFile = path.join(dir, `test-${Date.now()}.txt`);
  try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (error) {
    console.error('[R2调试] 目录写入测试失败:', error);
    return false;
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    process: {
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    },
    r2Config: {
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? '已设置' : '未设置',
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? '已设置' : '未设置',
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? '已设置' : '未设置', 
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '未设置'
    },
    files: {
      dotEnv: false,
      dotEnvLocal: false
    }
  };
  
  // 检查.env文件是否存在
  try {
    const envPath = path.join(process.cwd(), '.env');
    results.files.dotEnv = fs.existsSync(envPath);
  } catch (e) {
    console.error('检查.env文件时出错:', e);
  }
  
  // 检查.env.local文件是否存在
  try {
    const envLocalPath = path.join(process.cwd(), '.env.local');
    results.files.dotEnvLocal = fs.existsSync(envLocalPath);
  } catch (e) {
    console.error('检查.env.local文件时出错:', e);
  }
  
  // 输出到控制台用于调试
  console.log('[测试环境变量] 结果:', JSON.stringify(results, null, 2));
  
  return NextResponse.json(results);
} 
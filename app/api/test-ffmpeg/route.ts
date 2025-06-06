import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import os from 'os';
import util from 'util';

const execPromise = util.promisify(exec);

// 增加缓存和错误处理
let cachedResult: any = null;
let lastCheckTime = 0;
const CACHE_TTL = 60 * 1000; // 1分钟缓存

export async function GET() {
  try {
    // 使用缓存结果如果在有效期内
    const now = Date.now();
    if (cachedResult && (now - lastCheckTime) < CACHE_TTL) {
      console.log('返回缓存的FFmpeg检查结果');
      return Response.json(cachedResult);
    }

    const envInfo = {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cwd: process.cwd(),
      tmpdir: os.tmpdir(),
      ffmpegPath: ffmpegStatic || '无'
    };

    console.log('环境信息:', envInfo);
    
    let ffmpegExists = false;
    try {
      ffmpegExists = ffmpegStatic ? fs.existsSync(ffmpegStatic) : false;
      console.log('FFmpeg静态路径存在:', ffmpegExists);
    } catch (fsError) {
      console.error('检查FFmpeg静态路径时出错:', fsError);
    }

    // 检查系统FFmpeg是否可用
    let systemFfmpeg = '';
    let systemFfmpegAvailable = false;
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        try {
          const result = execSync('where ffmpeg', { timeout: 3000 }).toString().trim();
          if (result) {
            systemFfmpeg = result.split('\n')[0];
            systemFfmpegAvailable = true;
            console.log(`找到系统ffmpeg: ${systemFfmpeg}`);
          }
        } catch (e) {
          console.log('系统中未找到ffmpeg命令');
        }
      } else {
        try {
          const result = execSync('which ffmpeg', { timeout: 3000 }).toString().trim();
          if (result) {
            systemFfmpeg = result;
            systemFfmpegAvailable = true;
            console.log(`找到系统ffmpeg: ${systemFfmpeg}`);
          }
        } catch (e) {
          console.log('系统中未找到ffmpeg命令');
        }
      }
    } catch (e) {
      console.error('尝试寻找系统ffmpeg失败:', e);
    }

    // 获取ffmpeg版本信息
    let ffmpegVersion = '';
    try {
      const { execSync } = require('child_process');
      const versionCmd = systemFfmpeg || ffmpegStatic || 'ffmpeg';
      ffmpegVersion = execSync(`${versionCmd} -version`, { timeout: 3000 }).toString().trim().split('\n')[0];
      console.log('FFmpeg版本信息:', ffmpegVersion);
    } catch (e) {
      console.log('获取FFmpeg版本失败:', e);
      ffmpegVersion = '未找到';
    }

    // 确定FFmpeg是否可用
    const ffmpegAvailable = ffmpegExists || systemFfmpegAvailable;

    // 创建并缓存结果
    const result = {
      ffmpegAvailable,
      ffmpegVersion,
      systemFfmpeg: {
        path: systemFfmpeg,
        available: systemFfmpegAvailable
      },
      ffmpegInfo: {
        path: ffmpegStatic,
        exists: ffmpegExists
      },
      environment: envInfo,
      timestamp: now
    };
    
    // 更新缓存
    cachedResult = result;
    lastCheckTime = now;

    // 返回统一格式的结果
    return Response.json(result);
  } catch (error) {
    console.error('FFmpeg检查API出错:', error);
    return Response.json(
      { 
        ffmpegAvailable: false, 
        error: 'API检查失败',
        errorMessage: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 检查文件是否可执行
function checkExecutable(filePath: string): boolean {
  try {
    // 这只是一个简单的存在性检查，不能真正确认文件是否可执行
    const stats = fs.statSync(filePath);
    // 在 Windows 上，任何存在的文件都可能是可执行的
    if (process.platform === 'win32') return true;
    // 在类 Unix 系统上，检查执行权限
    return !!(stats.mode & 0o111);
  } catch {
    return false;
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { listR2Objects, deleteFromR2, isR2Configured } from '@/lib/r2';
import { getSharesDir, getShareFiles, removeShareInfo } from '@/lib/share-service';
import path from 'path';
import fs from 'fs';

// 设置过期时间为24小时
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24小时

/**
 * 清理过期文件API
 * 可以设置为定时触发，例如通过Vercel Cron或外部定时器每小时调用一次
 */
export async function GET(request: NextRequest) {
  try {
    const isAuthorized = checkAuthorization(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      r2Cleanup: { success: false, deleted: 0, errors: 0 },
      sharesCleanup: { success: false, deleted: 0, errors: 0 },
      localCleanup: { success: false, deleted: 0, errors: 0 },
    };

    // 清理R2
    if (isR2Configured) {
      results.r2Cleanup = await cleanupR2Files();
    }

    // 清理分享信息
    results.sharesCleanup = await cleanupShareInfo();

    // 清理本地文件
    results.localCleanup = await cleanupLocalFiles();

    return NextResponse.json({
      success: true,
      message: '清理任务已完成',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error('清理过期文件时出错:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clean up expired files',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * 检查API调用授权
 */
function checkAuthorization(request: NextRequest): boolean {
  // 获取授权密钥
  const apiKey = request.headers.get('x-api-key');
  const secretKey = process.env.CLEANUP_API_KEY;
  
  // 如果环境变量中设置了密钥，则需要验证
  if (secretKey && secretKey.length > 0) {
    return apiKey === secretKey;
  }
  
  // 检查是否来自内部触发
  const isInternal = request.headers.get('x-internal-trigger') === 'true';
  
  // 开发环境或内部触发允许访问
  return process.env.NODE_ENV === 'development' || isInternal;
}

/**
 * 清理R2中的过期文件
 */
async function cleanupR2Files() {
  const result = { success: false, deleted: 0, errors: 0 };
  
  try {
    // 列出R2中的文件
    const objects = await listR2Objects('wav/');
    console.log(`找到 ${objects.length} 个R2文件`);
    
    const now = Date.now();
    let deleted = 0;
    let errors = 0;
    
    // 查找并删除过期文件
    for (const obj of objects) {
      try {
        const key = obj.Key;
        if (!key) continue;
        
        // 获取文件的最后修改时间
        const lastModified = obj.LastModified ? new Date(obj.LastModified).getTime() : 0;
        
        // 如果文件已过期（创建时间超过24小时）
        if (now - lastModified > EXPIRY_TIME) {
          console.log(`删除过期R2文件: ${key}, 创建于: ${new Date(lastModified).toISOString()}`);
          
          // 删除文件
          const deleteSuccess = await deleteFromR2(key);
          
          if (deleteSuccess) {
            deleted++;
          } else {
            errors++;
            console.error(`删除R2文件失败: ${key}`);
          }
        }
      } catch (error) {
        errors++;
        console.error('处理R2文件时出错:', error);
      }
    }
    
    result.success = true;
    result.deleted = deleted;
    result.errors = errors;
    
    console.log(`R2清理完成: 已删除 ${deleted} 个文件, ${errors} 个错误`);
  } catch (error) {
    console.error('清理R2文件时出错:', error);
    result.success = false;
  }
  
  return result;
}

/**
 * 清理分享信息
 */
async function cleanupShareInfo() {
  const result = { success: false, deleted: 0, errors: 0 };
  
  try {
    // 获取所有分享文件
    const shareFiles = await getShareFiles();
    console.log(`找到 ${shareFiles.length} 个分享信息文件`);
    
    const now = Date.now();
    let deleted = 0;
    let errors = 0;
    
    // 检查并清理过期分享
    for (const file of shareFiles) {
      try {
        // 解析分享ID
        const shareId = path.basename(file, '.json');
        
        // 读取分享信息
        const shareData = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        // 检查是否过期
        if (shareData.expiresAt < now) {
          console.log(`删除过期分享: ${shareId}, 过期于: ${new Date(shareData.expiresAt).toISOString()}`);
          
          // 删除分享信息
          removeShareInfo(shareId);
          deleted++;
        }
      } catch (error) {
        errors++;
        console.error('处理分享文件时出错:', error);
      }
    }
    
    result.success = true;
    result.deleted = deleted;
    result.errors = errors;
    
    console.log(`分享清理完成: 已删除 ${deleted} 个分享, ${errors} 个错误`);
  } catch (error) {
    console.error('清理分享信息时出错:', error);
    result.success = false;
  }
  
  return result;
}

/**
 * 清理本地临时文件
 */
async function cleanupLocalFiles() {
  const result = { success: false, deleted: 0, errors: 0 };
  
  try {
    // 获取临时目录
    const tmpDir = process.env.TMP_DIR || path.join(process.cwd(), 'tmp');
    
    // 检查目录是否存在
    if (!fs.existsSync(tmpDir)) {
      console.log(`临时目录不存在: ${tmpDir}`);
      result.success = true;
      return result;
    }
    
    // 读取目录内容
    const files = fs.readdirSync(tmpDir)
      .filter(file => file.endsWith('.wav') || file.endsWith('.mp3'))
      .map(file => path.join(tmpDir, file));
    
    console.log(`找到 ${files.length} 个临时文件`);
    
    const now = Date.now();
    let deleted = 0;
    let errors = 0;
    
    // 检查并删除过期文件
    for (const file of files) {
      try {
        // 获取文件状态
        const stats = fs.statSync(file);
        
        // 如果文件已过期（创建时间超过24小时）
        if (now - stats.birthtime.getTime() > EXPIRY_TIME) {
          console.log(`删除过期本地文件: ${file}, 创建于: ${stats.birthtime.toISOString()}`);
          
          // 删除文件
          fs.unlinkSync(file);
          deleted++;
        }
      } catch (error) {
        errors++;
        console.error('处理本地文件时出错:', error);
      }
    }
    
    result.success = true;
    result.deleted = deleted;
    result.errors = errors;
    
    console.log(`本地文件清理完成: 已删除 ${deleted} 个文件, ${errors} 个错误`);
  } catch (error) {
    console.error('清理本地文件时出错:', error);
    result.success = false;
  }
  
  return result;
}

// 配置定时任务头部，Vercel Cron可以解析这个注释
// 默认每小时运行一次
export const config = {
  runtime: 'edge',
  cron: '0 * * * *' // 每小时运行一次
}; 
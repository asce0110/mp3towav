#!/usr/bin/env node

/**
 * 优化Next.js构建输出，删除大型缓存文件并优化部署包大小
 * 用于解决Cloudflare Pages 25MB文件大小限制问题
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { rimraf } = require('rimraf');

const BUILD_DIR = path.join(process.cwd(), '.next');
const STANDALONE_DIR = path.join(BUILD_DIR, 'standalone');
const CACHE_DIR = path.join(BUILD_DIR, 'cache');
const SIZE_LIMIT = 20 * 1024 * 1024; // 20MB

// 需要移除的目录和文件模式
const PATTERNS_TO_REMOVE = [
  path.join(BUILD_DIR, 'cache/**/*'),
  path.join(BUILD_DIR, 'cache/webpack/**/*'),
  path.join(BUILD_DIR, 'cache/webpack/client-production/**/*'),
  path.join(BUILD_DIR, 'cache/webpack/server-production/**/*'),
  path.join(BUILD_DIR, '**/*.js.map'),
  path.join(BUILD_DIR, '**/*.pack'),
  path.join(BUILD_DIR, '**/*.hot-update.*'),
  path.join(BUILD_DIR, 'server/chunks/*.js.map'),
  path.join(BUILD_DIR, 'static/chunks/*.js.map')
];

// 检查文件大小是否超过限制
async function checkLargeFiles(dir, limit = SIZE_LIMIT) {
  console.log(`检查大型文件 (限制: ${limit / 1024 / 1024}MB)...`);
  
  const largeFiles = [];
  
  function traverseDir(currentPath) {
    try {
      if (!fs.existsSync(currentPath)) {
        return;
      }
      
      const files = fs.readdirSync(currentPath);
      
      for (const file of files) {
        const filePath = path.join(currentPath, file);
        
        try {
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            traverseDir(filePath);
          } else if (stats.size > limit) {
            largeFiles.push({
              path: filePath,
              size: Math.round(stats.size / 1024 / 1024 * 100) / 100 + ' MB'
            });
          }
        } catch (error) {
          console.error(`处理文件 ${filePath} 时出错:`, error.message);
        }
      }
    } catch (error) {
      console.error(`读取目录 ${currentPath} 时出错:`, error.message);
    }
  }
  
  traverseDir(dir);
  
  if (largeFiles.length > 0) {
    console.log(`发现 ${largeFiles.length} 个大文件超过限制:`);
    largeFiles.forEach(file => {
      console.log(`- ${file.path} (${file.size})`);
    });
  } else {
    console.log('没有发现超过限制的大文件。');
  }
  
  return largeFiles;
}

// 强制删除整个缓存目录
async function forceClearCache() {
  console.log('强制清理缓存目录...');
  try {
    await rimraf(path.join(BUILD_DIR, 'cache'));
    console.log('缓存目录已完全清理');
  } catch (error) {
    console.error('清理缓存目录失败:', error);
  }
}

// 删除大型文件
async function removeLargeFiles() {
  console.log('删除大型文件...');
  try {
    const largeFiles = await checkLargeFiles(BUILD_DIR);
    for (const file of largeFiles) {
      try {
        fs.unlinkSync(file.path);
        console.log(`已删除: ${file.path} (${file.size})`);
      } catch (error) {
        console.error(`无法删除 ${file.path}:`, error.message);
      }
    }
  } catch (error) {
    console.error('清理大型文件时出错:', error);
  }
}

// 查找并压缩超大的JS文件
async function compressLargeJsFiles() {
  console.log('开始压缩大型JS文件...');
  const zlib = require('zlib');
  const util = require('util');
  const gzip = util.promisify(zlib.gzip);
  
  function findLargeJsFiles(dir, size = 5 * 1024 * 1024) {
    const result = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        result.push(...findLargeJsFiles(fullPath, size));
      } else if (file.name.endsWith('.js') && !file.name.endsWith('.gz')) {
        const stats = fs.statSync(fullPath);
        if (stats.size > size) {
          result.push(fullPath);
        }
      }
    }
    
    return result;
  }
  
  try {
    const largeJsFiles = findLargeJsFiles(BUILD_DIR);
    console.log(`发现 ${largeJsFiles.length} 个大型JS文件需要压缩`);
    
    for (const file of largeJsFiles) {
      try {
        const content = fs.readFileSync(file);
        const compressed = await gzip(content, { level: 9 });
        fs.writeFileSync(`${file}.gz`, compressed);
        
        // 只有确保压缩文件存在后才删除原始文件
        if (fs.existsSync(`${file}.gz`)) {
          const originalSize = fs.statSync(file).size;
          const compressedSize = fs.statSync(`${file}.gz`).size;
          console.log(`压缩：${file}, ${(originalSize/1024/1024).toFixed(2)}MB -> ${(compressedSize/1024/1024).toFixed(2)}MB`);
          
          // 删除原始文件，保留gzip版本
          fs.unlinkSync(file);
        }
      } catch (error) {
        console.error(`压缩文件 ${file} 失败:`, error);
      }
    }
  } catch (error) {
    console.error('压缩JS文件时出错:', error);
  }
}

// 主函数
async function main() {
  console.log('开始优化构建输出...');
  
  // 确保standalone目录存在
  if (!fs.existsSync(STANDALONE_DIR)) {
    fs.mkdirSync(STANDALONE_DIR, { recursive: true });
  }
  
  // 首先强制清除缓存目录
  await forceClearCache();
  
  // 删除模式匹配的缓存文件
  console.log('删除缓存和大型文件...');
  try {
    for (const pattern of PATTERNS_TO_REMOVE) {
      await rimraf(pattern);
    }
    console.log('缓存文件模式已清理');
  } catch (error) {
    console.error('清理缓存文件失败:', error);
  }
  
  // 删除所有超出大小限制的大文件
  await removeLargeFiles();
  
  // 压缩大型JS文件
  await compressLargeJsFiles();
  
  // 最后再次检查有没有超大文件
  console.log('最终检查...');
  const remainingLargeFiles = await checkLargeFiles(BUILD_DIR);
  
  if (remainingLargeFiles.length > 0) {
    console.warn('警告：仍有大文件未处理！请手动检查以下文件:');
    remainingLargeFiles.forEach(file => {
      console.warn(`- ${file.path} (${file.size})`);
    });
  } else {
    console.log('全部大文件已清理完成！');
  }
  
  console.log('构建优化完成!');
}

main().catch(error => {
  console.error('构建优化失败:', error);
  process.exit(1);
}); 
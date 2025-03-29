#!/usr/bin/env node

/**
 * 优化Next.js构建输出，删除大型缓存文件并优化部署包大小
 * 用于解决Cloudflare Pages 25MB文件大小限制问题
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const rimraf = promisify(require('rimraf'));

const BUILD_DIR = path.join(process.cwd(), '.next');
const STANDALONE_DIR = path.join(BUILD_DIR, 'standalone');
const CACHE_DIR = path.join(BUILD_DIR, 'cache');

// 需要移除的目录和文件模式
const PATTERNS_TO_REMOVE = [
  path.join(BUILD_DIR, 'cache/**/*.pack'),
  path.join(BUILD_DIR, 'cache/**/*.map'),
  path.join(BUILD_DIR, '**/*.js.map'),
  path.join(BUILD_DIR, '**/*.pack'),
  path.join(BUILD_DIR, '**/*.hot-update.*'),
  path.join(BUILD_DIR, 'server/chunks/*.js.map'),
  path.join(BUILD_DIR, 'static/chunks/*.js.map')
];

// 检查文件大小是否超过限制
async function checkLargeFiles(dir, limit = 25 * 1024 * 1024) {
  console.log(`检查大型文件 (限制: ${limit / 1024 / 1024}MB)...`);
  
  const largeFiles = [];
  
  function traverseDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    
    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        traverseDir(filePath);
      } else if (stats.size > limit) {
        largeFiles.push({
          path: filePath,
          size: Math.round(stats.size / 1024 / 1024 * 10) / 10 + ' MB'
        });
      }
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

// 主函数
async function main() {
  console.log('开始优化构建输出...');
  
  // 确保standalone目录存在
  if (!fs.existsSync(STANDALONE_DIR)) {
    fs.mkdirSync(STANDALONE_DIR, { recursive: true });
  }
  
  // 删除缓存文件
  console.log('删除缓存和大型文件...');
  try {
    for (const pattern of PATTERNS_TO_REMOVE) {
      await rimraf(pattern);
    }
    console.log('缓存文件已清理');
  } catch (error) {
    console.error('清理缓存文件失败:', error);
  }
  
  // 检查大文件
  const largeFiles = await checkLargeFiles(BUILD_DIR);
  
  // 如果仍然有大文件，尝试删除它们
  if (largeFiles.length > 0) {
    console.log('尝试删除大型文件...');
    for (const file of largeFiles) {
      try {
        await rimraf(file.path);
        console.log(`已删除: ${file.path}`);
      } catch (error) {
        console.error(`无法删除 ${file.path}:`, error);
      }
    }
  }
  
  console.log('构建优化完成!');
}

main().catch(error => {
  console.error('构建优化失败:', error);
  process.exit(1);
}); 
import { NextResponse } from "next/server"
import { validateR2Connection, fileExistsInR2 } from "@/lib/r2"
import fs from "fs"
import path from "path"

/**
 * 调试API路由 - 检查存储状态
 */
export async function GET(request: Request) {
  // 生成请求ID
  const requestId = `debug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  console.log(`[调试API] 检查存储状态: requestId=${requestId}`)
  
  const result = {
    requestId,
    timestamp: new Date().toISOString(),
    r2: {
      configured: false,
      connected: false,
      error: null as string | null,
    },
    localStorage: {
      tmpDir: {
        exists: false,
        writable: false,
        size: 0,
        files: 0,
      },
      sharesDir: {
        exists: false,
        writable: false,
        size: 0,
        files: 0,
      },
    }
  }
  
  // 检查R2配置和连接状态
  try {
    // 验证R2连接
    const connectionResult = await validateR2Connection()
    result.r2.configured = connectionResult.configured
    result.r2.connected = connectionResult.connected
    
    if (!connectionResult.connected) {
      result.r2.error = connectionResult.error || 'Unknown connection error'
    }
  } catch (error) {
    result.r2.error = error instanceof Error ? error.message : 'Unknown R2 error'
    console.error(`[调试API] R2连接检查失败:`, error)
  }
  
  // 检查本地存储
  const tmpDir = path.join(process.cwd(), 'tmp')
  const sharesDir = path.join(tmpDir, 'shares')
  
  // 检查tmp目录
  try {
    if (fs.existsSync(tmpDir)) {
      result.localStorage.tmpDir.exists = true
      
      // 检查是否可写
      try {
        const testFile = path.join(tmpDir, `test-${Date.now()}.txt`)
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
        result.localStorage.tmpDir.writable = true
      } catch (e) {
        console.error(`[调试API] tmp目录写入测试失败:`, e)
      }
      
      // 获取目录内容
      try {
        const files = fs.readdirSync(tmpDir)
        result.localStorage.tmpDir.files = files.length
        
        // 计算总大小
        let totalSize = 0
        for (const file of files) {
          if (file !== 'shares') { // 排除shares目录
            const filePath = path.join(tmpDir, file)
            try {
              const stats = fs.statSync(filePath)
              if (stats.isFile()) {
                totalSize += stats.size
              }
            } catch (e) {
              console.error(`[调试API] 无法获取文件大小: ${filePath}`, e)
            }
          }
        }
        result.localStorage.tmpDir.size = totalSize
      } catch (e) {
        console.error(`[调试API] 无法读取tmp目录:`, e)
      }
    }
  } catch (e) {
    console.error(`[调试API] 检查tmp目录时出错:`, e)
  }
  
  // 检查shares目录
  try {
    if (fs.existsSync(sharesDir)) {
      result.localStorage.sharesDir.exists = true
      
      // 检查是否可写
      try {
        const testFile = path.join(sharesDir, `test-${Date.now()}.txt`)
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
        result.localStorage.sharesDir.writable = true
      } catch (e) {
        console.error(`[调试API] shares目录写入测试失败:`, e)
      }
      
      // 获取目录内容
      try {
        const files = fs.readdirSync(sharesDir)
        result.localStorage.sharesDir.files = files.length
        
        // 计算总大小
        let totalSize = 0
        for (const file of files) {
          const filePath = path.join(sharesDir, file)
          try {
            const stats = fs.statSync(filePath)
            if (stats.isFile()) {
              totalSize += stats.size
            }
          } catch (e) {
            console.error(`[调试API] 无法获取文件大小: ${filePath}`, e)
          }
        }
        result.localStorage.sharesDir.size = totalSize
      } catch (e) {
        console.error(`[调试API] 无法读取shares目录:`, e)
      }
    }
  } catch (e) {
    console.error(`[调试API] 检查shares目录时出错:`, e)
  }
  
  // 返回检查结果
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  })
} 
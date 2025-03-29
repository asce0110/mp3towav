import { NextResponse } from "next/server"
import { getShareData } from "@/lib/share-service"
import { fileExistsInR2, downloadFromR2 } from "@/lib/r2"
import fs from "fs"
import path from "path"

/**
 * 调试API路由 - 强制刷新分享
 */
export async function GET(request: Request) {
  // 获取分享ID
  const { searchParams } = new URL(request.url)
  const shareId = searchParams.get("id")
  
  // 生成请求ID
  const requestId = `refresh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  console.log(`[调试API] 强制刷新分享: id=${shareId}, requestId=${requestId}`)
  
  if (!shareId) {
    return NextResponse.json({ error: "Missing share ID" }, { status: 400 })
  }
  
  const result = {
    requestId,
    timestamp: new Date().toISOString(),
    shareId,
    operations: [] as string[],
    success: false,
    fileId: null as string | null,
    errors: [] as string[],
  }
  
  try {
    // 尝试获取分享数据
    result.operations.push("查询分享数据")
    const shareData = await getShareData(shareId)
    
    if (!shareData || !shareData.success) {
      const errorMessage = shareData?.error || "Share not found or expired"
      result.errors.push(`分享数据未找到: ${errorMessage}`)
      return NextResponse.json(result, { status: 404 })
    }
    
    // 获取文件ID
    const fileId = shareData.fileId
    result.fileId = fileId
    result.operations.push(`找到分享，文件ID: ${fileId}`)
    
    // 检查临时文件夹
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
      result.operations.push('创建tmp目录')
    }
    
    // 本地文件路径
    const localFilePath = path.join(tmpDir, `${fileId}.wav`)
    
    // 检查本地文件是否存在
    const localFileExists = fs.existsSync(localFilePath)
    result.operations.push(`检查本地文件: ${localFileExists ? '存在' : '不存在'}`)
    
    // 检查R2文件是否存在
    result.operations.push("检查R2文件")
    const r2FileExists = await fileExistsInR2(`wav/${fileId}.wav`)
    result.operations.push(`R2文件检查结果: ${r2FileExists ? '存在' : '不存在'}`)
    
    // 如果R2有文件但本地没有，从R2下载
    if (r2FileExists && !localFileExists) {
      result.operations.push("从R2下载文件")
      const fileBuffer = await downloadFromR2(`wav/${fileId}.wav`)
      
      if (!fileBuffer) {
        result.errors.push("从R2下载文件失败")
        return NextResponse.json(result, { status: 500 })
      }
      
      // 保存到本地
      fs.writeFileSync(localFilePath, fileBuffer)
      result.operations.push(`文件已从R2下载并保存到本地: ${localFilePath}`)
      result.success = true
    } 
    // 如果本地有文件但R2没有，这不是本API负责的事，所以只记录
    else if (localFileExists && !r2FileExists) {
      result.operations.push("本地文件存在，但R2不存在。建议使用上传API上传到R2")
      result.success = true
    }
    // 如果两者都有文件，一切正常
    else if (localFileExists && r2FileExists) {
      result.operations.push("文件在本地和R2都存在，无需操作")
      result.success = true
    }
    // 如果两者都没有文件，无法恢复
    else {
      result.errors.push("文件在本地和R2中均不存在，无法恢复")
      return NextResponse.json(result, { status: 404 })
    }
    
    // 返回成功结果
    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
    })
  } catch (error) {
    // 记录错误并返回
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    result.errors.push(errorMessage)
    console.error(`[调试API] 刷新分享失败:`, error)
    
    return NextResponse.json(result, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
    })
  }
} 
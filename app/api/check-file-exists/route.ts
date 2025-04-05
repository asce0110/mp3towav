import { NextRequest, NextResponse } from "next/server";
import { initR2Client, r2BucketName, fileExistsInR2 } from "@/lib/r2";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3Object } from "@aws-sdk/client-s3/dist-types/models/models_0";

// 用于缓存和跟踪哈希-文件路径映射的内存缓存
const fileHashMap = new Map<string, {fileUrl: string, expires: number}>();

// 检查缓存并清理过期项
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of fileHashMap.entries()) {
    if (value.expires < now) {
      fileHashMap.delete(key);
    }
  }
}

// 每小时清理一次缓存
setInterval(cleanExpiredCache, 60 * 60 * 1000);

export async function POST(request: NextRequest) {
  console.log(`[API:check-file] 接收检查文件请求`);
  
  const r2Client = await initR2Client();
  if (!r2Client) {
    return NextResponse.json({ error: "R2存储未配置" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { fileName, fileHash } = body;

    if (!fileHash) {
      return NextResponse.json({ error: "未提供文件哈希" }, { status: 400 });
    }

    console.log(`[API:check-file] 检查文件哈希: ${fileHash}, 文件名: ${fileName}`);

    // 先检查内存缓存中是否有匹配的哈希值
    if (fileHashMap.has(fileHash)) {
      const cachedData = fileHashMap.get(fileHash);
      if (cachedData && cachedData.expires > Date.now()) {
        console.log(`[API:check-file] 从缓存中找到匹配文件: ${cachedData.fileUrl}`);
        return NextResponse.json({ 
          exists: true, 
          fileUrl: cachedData.fileUrl,
          fromCache: true 
        });
      }
    }

    // 没有缓存命中，查询R2存储
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      MaxKeys: 1000,  // 限制返回的键数量
      Prefix: '', // 可以根据需要设置前缀
    });

    console.log(`[API:check-file] 查询R2存储中的文件...`);
    const result = await r2Client.send(command);
    
    // 遍历R2中的文件，检查元数据中是否有匹配的哈希
    if (result.Contents && result.Contents.length > 0) {
      console.log(`[API:check-file] 找到 ${result.Contents.length} 个文件，开始检查...`);
      
      // 构建公共URL基础
      const baseUrl = process.env.CLOUDFLARE_PUBLIC_URL || 
                      `https://${r2BucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      
      // 首先尝试匹配文件名
      const matchingFiles = result.Contents.filter((file: S3Object) => 
        file.Key && file.Key.includes(fileName.replace(/\.[^/.]+$/, ""))
      );
      
      if (matchingFiles.length > 0) {
        console.log(`[API:check-file] 找到 ${matchingFiles.length} 个可能匹配的文件`);
        
        // 使用第一个匹配的文件
        const matchedFile = matchingFiles[0];
        
        if (matchedFile.Key) {
          const fileUrl = `${baseUrl}/${matchedFile.Key}`;
          
          // 缓存这个哈希-URL映射，有效期24小时
          fileHashMap.set(fileHash, {
            fileUrl: fileUrl,
            expires: Date.now() + 24 * 60 * 60 * 1000
          });
          
          console.log(`[API:check-file] 匹配成功，使用文件: ${matchedFile.Key}`);
          
          return NextResponse.json({
            exists: true,
            fileUrl: fileUrl,
            key: matchedFile.Key
          });
        }
      }
      
      console.log(`[API:check-file] 未找到匹配文件`);
    } else {
      console.log(`[API:check-file] R2存储为空或查询未返回结果`);
    }

    // 未找到匹配的文件
    return NextResponse.json({
      exists: false,
    });
  } catch (error) {
    console.error(`[API:check-file] 检查文件时出错:`, error);
    return NextResponse.json(
      { error: "检查文件存在性时发生错误", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 
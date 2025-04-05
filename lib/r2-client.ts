// 客户端r2工具

// 检查R2是否已配置
export const isR2Configured = true; // 在客户端我们假设R2已配置，实际由API处理

// 客户端检查文件是否存在于R2（通过API）
export async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    // 从key中提取文件ID
    const match = key.match(/wav\/(.+)\.wav/);
    if (!match || !match[1]) {
      return false;
    }
    
    const fileId = match[1];
    const response = await fetch(`/api/convert?fileId=${fileId}&check=true&storage=r2`);
    if (response.ok) {
      const data = await response.json();
      return data.r2Exists;
    }
    return false;
  } catch (error) {
    console.error('客户端检查R2文件存在性失败:', error);
    return false;
  }
} 
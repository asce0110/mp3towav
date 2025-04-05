import { NextRequest } from 'next/server';

/**
 * 将NextRequest的FormData对象解析为文件和字段
 * 
 * @param request NextRequest对象
 * @returns 包含文件和字段的对象
 */
export async function parseFormWithFiles(request: NextRequest) {
  // 解析FormData
  const formData = await request.formData();
  const files: File[] = [];
  const fields: Record<string, string | string[]> = {};

  // 处理FormData中的每一项
  for (const [name, value] of formData.entries()) {
    // 如果是File对象，添加到files数组
    if (value instanceof File) {
      files.push(value);
    } else {
      // 否则添加到fields对象
      // 如果已经存在同名字段，则转换为数组
      if (fields[name]) {
        if (Array.isArray(fields[name])) {
          (fields[name] as string[]).push(value);
        } else {
          fields[name] = [fields[name] as string, value];
        }
      } else {
        fields[name] = value;
      }
    }
  }

  return { files, fields };
} 
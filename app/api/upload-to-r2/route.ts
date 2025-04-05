import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }
    
    console.log(`[Upload API] Received file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // 生成唯一文件名，保留原始文件扩展名
    const fileExtension = file.name.split('.').pop() || 'wav';
    const uniqueId = uuidv4();
    const fileKey = `mp3_to_wav_${uniqueId}.${fileExtension}`;
    
    // 这里仅返回成功响应，不实际上传文件
    return NextResponse.json({
      success: true,
      fileId: uniqueId,
      fileKey: fileKey,
      originalName: file.name
    });
    
  } catch (error) {
    console.error('[Upload API] Error processing upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
} 
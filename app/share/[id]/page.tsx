import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from "@/components/site-header"
import fs from 'fs';
import path from 'path';

// 临时文件和分享信息存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 直接检查文件系统中的文件是否存在，作为备用方案
async function checkFileInFileSystem(fileId: string): Promise<boolean> {
  try {
    const filePath = path.join(TMP_DIR, `${fileId}.wav`);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Error checking file in filesystem:', error);
    return false;
  }
}

// 从文件系统检查分享信息是否存在
async function checkShareInFileSystem(shareId: string): Promise<any> {
  try {
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    if (!fs.existsSync(sharePath)) {
      console.log(`Share JSON file not found for ID: ${shareId}`);
      return null;
    }
    
    const shareData = fs.readFileSync(sharePath, 'utf-8');
    const shareInfo = JSON.parse(shareData);
    
    // 检查文件是否存在
    const fileExists = await checkFileInFileSystem(shareInfo.fileId);
    if (!fileExists) {
      console.log(`Share file not found for ID: ${shareId}, fileId: ${shareInfo.fileId}`);
      return null;
    }
    
    // 检查是否过期
    if (Date.now() > shareInfo.expiresAt) {
      console.log(`Share expired for ID: ${shareId}`);
      return null;
    }
    
    // 从shareInfo构造需要的数据结构
    return {
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: `/api/convert?fileId=${shareInfo.fileId}`,
      createdAt: new Date(shareInfo.createdAt).toISOString(),
      expiresAt: new Date(shareInfo.expiresAt).toISOString(),
      remainingMinutes: Math.floor((shareInfo.expiresAt - Date.now()) / 60000)
    };
  } catch (error) {
    console.error(`Error loading share from filesystem for ${shareId}:`, error);
    return null;
  }
}

// Fetch share data on the server
async function getShareData(id: string) {
  console.log(`Getting share data for ID: ${id}`);
  
  try {
    // 设置基础URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NODE_ENV === 'production' ? 'https://mp3towav.net' : 'http://localhost:3000');
    
    // 构建完整的API URL
    const apiUrl = `${baseUrl}/api/share?id=${id}`;
    console.log(`Fetching from API: ${apiUrl}`);
    
    // 使用服务端fetch获取分享数据
    const response = await fetch(apiUrl, {
      next: { revalidate: 60 }, // 缓存1分钟
      cache: 'no-store' // 确保总是获取最新数据
    });
    
    // 检查HTTP状态
    if (!response.ok) {
      console.error(`API returned error status: ${response.status}`);
      
      // 尝试从文件系统直接获取
      console.log('Trying to get share data directly from filesystem');
      const fileSystemData = await checkShareInFileSystem(id);
      
      if (fileSystemData) {
        console.log('Found share data in filesystem');
        return fileSystemData;
      }
      
      console.error('Share data not found in API or filesystem');
      throw new Error(`API error: ${response.status}`);
    }
    
    // 解析JSON响应
    const data = await response.json();
    console.log(`API response: ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    console.error('Error fetching share data:', error);
    
    // 作为备选方案，直接从文件系统获取
    console.log('Trying to get share data directly from filesystem after error');
    const fileSystemData = await checkShareInFileSystem(id);
    return fileSystemData;
  }
}

export default async function SharePage({ params }: { params: { id: string } }) {
  console.log(`Rendering share page for ID: ${params.id}`);
  
  const shareData = await getShareData(params.id);
  const isValid = shareData && shareData.success;
  
  console.log(`Share data found: ${isValid}, originalName: ${shareData?.originalName || 'N/A'}`);
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg">
            <CardHeader className="bg-[#2A6FDB] text-white">
              <CardTitle className="text-2xl font-bold text-center">
                Shared WAV File
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6">
              {isValid ? (
                <div className="space-y-6 text-center">
                  <div>
                    <h3 className="text-xl font-medium mb-2">
                      {shareData.originalName || 'WAV File'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {shareData.remainingMinutes !== undefined ? (
                        shareData.remainingMinutes > 60 
                          ? `This shared file will expire in ${Math.floor(shareData.remainingMinutes / 60)} hours and ${shareData.remainingMinutes % 60} minutes`
                          : `This shared file will expire in ${shareData.remainingMinutes} minutes`
                      ) : 'This shared file will be available for 24 hours'}
                    </p>
                  </div>
                  
                  <Button
                    className="bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 w-full"
                    size="lg"
                    asChild
                  >
                    <a href={shareData.downloadUrl} download>
                      <Download className="h-5 w-5 mr-2" />
                      Download WAV File
                    </a>
                  </Button>
                  
                  <div className="pt-4 border-t mt-6">
                    <p className="text-sm text-gray-500 mb-4">
                      Want to convert your own MP3 files?
                    </p>
                    <Button variant="outline" asChild>
                      <Link href="/">
                        Go to MP3 to WAV Converter
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="p-4">
                    <h3 className="text-xl font-medium mb-2 text-red-500">
                      Shared File Not Available
                    </h3>
                    <p className="text-gray-500">
                      This shared file has expired or doesn't exist. Shared files are available for 24 hours.
                    </p>
                  </div>
                  
                  <Button variant="outline" asChild>
                    <Link href="/">
                      Go to MP3 to WAV Converter
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
} 
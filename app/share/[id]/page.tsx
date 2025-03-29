import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { SiteHeader } from "@/components/site-header"
import fs from 'fs';
import path from 'path';
import { DebugButtons } from '@/components/debug-buttons';
import { notFound } from "next/navigation"
import { getShareData } from "@/lib/share-service"
import { formatFileSize } from "@/lib/utils"
import { DownloadButton } from "@/components/download-button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

// 始终启用客户端调试 - 临时修改，便于排查问题
const CLIENT_DEBUG = true;

// 客户端日志函数
function clientLog(...args: any[]) {
  if (typeof window !== 'undefined') {
    console.log('[SHARE CLIENT]', ...args);
    // 将日志添加到页面上的调试区域
    setTimeout(() => {
      if (document.getElementById('debug-log')) {
        const logElem = document.getElementById('debug-log');
        if (logElem) {
          const time = new Date().toISOString().split('T')[1].split('.')[0];
          const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          logElem.innerHTML += `<div>${time}: ${msg}</div>`;
        }
      }
    }, 0);
  }
}

// 临时文件和分享信息存储目录
const TMP_DIR = path.join(process.cwd(), 'tmp');
const SHARES_DIR = path.join(TMP_DIR, 'shares');

// 直接检查文件系统中的文件是否存在，作为备用方案
async function checkFileInFileSystem(fileId: string): Promise<boolean> {
  try {
    // 确保tmp目录存在
    if (!fs.existsSync(TMP_DIR)) {
      console.log(`TMP_DIR不存在: ${TMP_DIR}, 尝试创建`);
      try {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        console.log(`成功创建TMP_DIR: ${TMP_DIR}`);
      } catch (mkdirError: any) {
        console.error(`创建TMP_DIR失败: ${mkdirError.message}`);
        return false;
      }
    }
    
    const filePath = path.join(TMP_DIR, `${fileId}.wav`);
    const exists = fs.existsSync(filePath);
    console.log(`检查文件是否存在: ${filePath}, 结果: ${exists}`);
    
    if (exists) {
      const stats = fs.statSync(filePath);
      console.log(`文件大小: ${stats.size} bytes, 创建时间: ${stats.birthtime}`);
    }
    
    return exists;
  } catch (error: any) {
    console.error(`检查文件系统中的文件时出错: ${error.message}`);
    return false;
  }
}

// 从文件系统检查分享信息是否存在
async function checkShareInFileSystem(shareId: string): Promise<any> {
  try {
    // 确保shares目录存在
    if (!fs.existsSync(SHARES_DIR)) {
      console.log(`SHARES_DIR不存在: ${SHARES_DIR}, 尝试创建`);
      try {
        fs.mkdirSync(SHARES_DIR, { recursive: true });
        console.log(`成功创建SHARES_DIR: ${SHARES_DIR}`);
      } catch (mkdirError: any) {
        console.error(`创建SHARES_DIR失败: ${mkdirError.message}`);
        return null;
      }
    }
    
    const sharePath = path.join(SHARES_DIR, `${shareId}.json`);
    
    if (!fs.existsSync(sharePath)) {
      console.log(`分享JSON文件未找到: ${sharePath}`);
      // 列出目录内容，用于调试
      try {
        if (fs.existsSync(SHARES_DIR)) {
          const files = fs.readdirSync(SHARES_DIR);
          console.log(`SHARES_DIR中的文件: ${files.join(', ') || '无文件'}`);
        }
      } catch (readError: any) {
        console.error(`无法读取SHARES_DIR: ${readError.message}`);
      }
      return null;
    }
    
    let shareInfo;
    try {
      const shareData = fs.readFileSync(sharePath, 'utf-8');
      shareInfo = JSON.parse(shareData);
      console.log(`成功读取分享信息: ${JSON.stringify(shareInfo)}`);
    } catch (readError: any) {
      console.error(`读取或解析分享文件失败: ${readError.message}`);
      return null;
    }
    
    // 检查文件是否存在
    const fileExists = await checkFileInFileSystem(shareInfo.fileId);
    if (!fileExists) {
      console.log(`分享文件未找到: shareId=${shareId}, fileId=${shareInfo.fileId}`);
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now > shareInfo.expiresAt) {
      console.log(`分享已过期: shareId=${shareId}, 过期时间=${new Date(shareInfo.expiresAt).toISOString()}, 当前时间=${new Date(now).toISOString()}`);
      return null;
    }
    
    // 从shareInfo构造需要的数据结构
    const remainingMinutes = Math.floor((shareInfo.expiresAt - now) / 60000);
    console.log(`分享有效: shareId=${shareId}, 剩余时间=${remainingMinutes}分钟`);
    
    return {
      success: true,
      fileId: shareInfo.fileId,
      originalName: shareInfo.originalName,
      downloadUrl: `/api/convert?fileId=${shareInfo.fileId}`,
      createdAt: new Date(shareInfo.createdAt).toISOString(),
      expiresAt: new Date(shareInfo.expiresAt).toISOString(),
      remainingMinutes: remainingMinutes
    };
  } catch (error: any) {
    console.error(`从文件系统加载分享时出错: ${error.message}`);
    return null;
  }
}

// Fetch share data on the server
async function getShareData(id: string) {
  console.log(`[分享页面] 获取分享数据开始: ID=${id}`);
  
  try {
    // 首先尝试从文件系统获取作为最直接的方法
    console.log('首先尝试从文件系统直接获取数据...');
    const directFileSystemData = await checkShareInFileSystem(id);
    
    if (directFileSystemData) {
      console.log('在文件系统中直接找到分享数据');
      return directFileSystemData;
    }
    
    console.log('文件系统中未找到数据，尝试通过API获取...');
    
    // 设置基础URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NODE_ENV === 'production' ? 'https://mp3towav.net' : 'http://localhost:3000');
    
    // 构建完整的API URL - 添加调试参数
    const apiUrl = `${baseUrl}/api/share?id=${id}&_t=${Date.now()}&browser=true`;
    console.log(`[分享页面] API请求URL: ${apiUrl}`);
    
    // 使用服务端fetch获取分享数据，添加详细日志
    try {
      console.log(`[分享页面] 开始发送API请求...`);
      const response = await fetch(apiUrl, {
        next: { revalidate: 0 }, // 不缓存，总是获取最新数据
        cache: 'no-store',
        headers: {
          'x-debug': 'true',
          'x-request-id': `share-page-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          'x-client': 'browser'
        }
      });
      
      console.log(`[分享页面] API响应状态: ${response.status}, 状态文本: ${response.statusText}`);
      
      // 检查HTTP状态
      if (!response.ok) {
        console.error(`[分享页面] API返回错误状态: ${response.status}`);
        
        // 尝试读取错误详情
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
          console.error(`[分享页面] API错误详情: ${errorDetails}`);
        } catch (e) {
          console.error(`[分享页面] 无法解析API错误详情`);
        }
        
        // 如果是404，则明确表示分享不存在
        if (response.status === 404) {
          console.log(`[分享页面] 分享未找到: ${id}, 错误详情: ${errorDetails}`);
          return { 
            success: false, 
            error: 'not_found',
            message: 'Share not found',
            details: errorDetails
          };
        }
        
        // 如果是410，则明确表示分享已过期
        if (response.status === 410) {
          console.log(`[分享页面] 分享已过期: ${id}, 错误详情: ${errorDetails}`);
          return { 
            success: false, 
            error: 'expired',
            message: 'Share has expired',
            details: errorDetails
          };
        }
        
        console.error(`[分享页面] API未知错误: ${response.status}, 详情: ${errorDetails}`);
        return {
          success: false,
          error: 'api_error',
          message: `API error: ${response.status}`,
          details: errorDetails
        };
      }
      
      // 解析JSON响应
      console.log(`[分享页面] 尝试解析API响应...`);
      const data = await response.json();
      console.log(`[分享页面] API响应数据: ${JSON.stringify(data)}`);
      return data;
    } catch (fetchError: any) {
      console.error(`[分享页面] 从API获取数据时网络错误:`, fetchError);
      return {
        success: false,
        error: 'network_error',
        message: fetchError.message || 'Network error',
        details: JSON.stringify(fetchError)
      };
    }
  } catch (error: any) {
    console.error('[分享页面] 获取分享数据时出错:', error);
    
    // 返回错误状态
    return {
      success: false,
      error: 'unknown',
      message: error.message || 'Unknown error occurred',
      details: JSON.stringify(error)
    };
  }
}

// 客户端调试组件 - 始终显示
function DebugPanel({ data }: { data: any }) {
  return (
    <div className="mt-8 p-4 border border-gray-300 rounded bg-gray-50 text-xs font-mono">
      <h3 className="font-bold mb-2">调试信息 (当前时间: {new Date().toISOString()})</h3>
      <div className="mb-4">
        <div><strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : '服务器端'}</div>
        <div><strong>ShareID:</strong> {data?.params?.id || 'N/A'}</div>
        <div><strong>Error:</strong> {data?.error || 'none'}</div>
        <div><strong>Success:</strong> {data?.success ? 'true' : 'false'}</div>
        {data.details && <div><strong>Details:</strong> {data.details}</div>}
        {data.message && <div><strong>Message:</strong> {data.message}</div>}
      </div>
      <div className="mb-2 font-bold">请求追踪:</div>
      <div className="mb-4">
        <div><strong>Server time:</strong> {data?.serverTime || 'unknown'}</div>
        <div><strong>Request ID:</strong> {data?.requestId || 'unknown'}</div>
        <div><strong>Storage:</strong> R2={data?.storage?.r2 ? 'true' : 'false'}, Local={data?.storage?.local ? 'true' : 'false'}</div>
      </div>
      <div className="mb-2 font-bold">实时客户端日志:</div>
      <div id="debug-log" className="max-h-60 overflow-y-auto p-2 bg-black text-white text-xs">
        <div>{new Date().toISOString()}: 调试面板已加载</div>
      </div>
      <div className="mt-2">
        <a href={`/api/test-share?id=${data?.params?.id || ''}`} target="_blank" className="text-blue-500 hover:underline">
          查看完整存储状态
        </a>
      </div>
    </div>
  );
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const id = params.id;
  console.log(`[分享页面-服务器] 请求分享: ID=${id}`);
  
  // 获取分享数据
  const shareData = await getShareData(id);
  console.log(`[分享页面-服务器] 获取到分享数据:`, shareData);
  
  // 如果分享不存在或已过期，返回404
  if (!shareData || !shareData.success) {
    console.log(`[分享页面-服务器] 分享无效或过期: ${id}`);
    return notFound();
  }
  
  // 格式化分享数据
  const { fileId, originalName, downloadUrl, remainingMinutes } = shareData;
  
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md mx-auto">
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-medium">
                Shared WAV File
              </CardTitle>
              <CardDescription>
                This file will be available for{" "}
                <Badge variant="secondary" className="font-normal">
                  {remainingMinutes} minutes
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium leading-none">
                  Original filename
                </h3>
                <p className="text-sm text-muted-foreground break-all">
                  {originalName || "Unknown"}
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <DownloadButton 
                  fileId={fileId} 
                  downloadUrl={downloadUrl} 
                  originalName={originalName}
                />
              </div>
            </CardContent>
            <CardFooter className="pt-1 flex justify-between">
              <Link href="/" passHref>
                <Button variant="ghost" size="sm">
                  Back to converter
                </Button>
              </Link>
              
              {/* 调试按钮在服务器组件中使用 */}
              <DebugButtons />
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}

// 添加客户端脚本，会在页面加载时执行
export function generateMetadata({ params }: { params: { id: string }}) {
  return {
    title: `Shared File - ${params.id}`,
    description: 'Access your shared WAV file',
    // 添加客户端脚本
    script: [
      {
        id: 'share-debug-script',
        type: 'text/javascript',
        dangerouslySetInnerHTML: {
          __html: `
            console.log('[SHARE CLIENT] 页面加载, shareId=${params.id}, 时间=${new Date().toISOString()}');
            window.addEventListener('DOMContentLoaded', function() {
              console.log('[SHARE CLIENT] DOM内容加载完成, 时间=${new Date().toISOString()}');
            });
            
            window.addEventListener('load', function() {
              console.log('[SHARE CLIENT] 页面完全加载, 时间=${new Date().toISOString()}');
              
              // 记录当前URL和参数
              const url = new URL(window.location.href);
              const params = {};
              for (const [key, value] of url.searchParams.entries()) {
                params[key] = value;
              }
              console.log('[SHARE CLIENT] URL信息:', {
                href: window.location.href,
                origin: window.location.origin,
                pathname: window.location.pathname,
                search: window.location.search,
                params: params
              });
              
              // 添加错误日志
              window.addEventListener('error', function(e) {
                console.error('[SHARE CLIENT ERROR]', e.message, e.filename, e.lineno);
                if (document.getElementById('debug-log')) {
                  document.getElementById('debug-log').innerHTML += 
                    '<div style="color:red">错误: ' + e.message + '</div>';
                }
              });
              
              // 添加网络请求日志
              const originalFetch = window.fetch;
              window.fetch = function(...args) {
                const url = args[0];
                console.log('[SHARE CLIENT] 发起网络请求:', url);
                if (document.getElementById('debug-log')) {
                  document.getElementById('debug-log').innerHTML += 
                    '<div>网络请求: ' + url + '</div>';
                }
                return originalFetch.apply(this, args)
                  .then(response => {
                    console.log('[SHARE CLIENT] 网络响应:', url, response.status);
                    if (document.getElementById('debug-log')) {
                      document.getElementById('debug-log').innerHTML += 
                        '<div>网络响应: ' + url + ' - ' + response.status + '</div>';
                    }
                    return response;
                  })
                  .catch(error => {
                    console.error('[SHARE CLIENT] 网络错误:', url, error);
                    if (document.getElementById('debug-log')) {
                      document.getElementById('debug-log').innerHTML += 
                        '<div style="color:red">网络错误: ' + url + ' - ' + error.message + '</div>';
                    }
                    throw error;
                  });
              };
            });
          `
        }
      }
    ]
  };
} 
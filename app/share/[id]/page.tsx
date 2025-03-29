import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from "@/components/site-header"
import fs from 'fs';
import path from 'path';

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
  console.log(`[分享页面] 开始渲染分享页面: ID=${params.id}, 类型=${typeof params.id}, 长度=${params.id?.length || 0}`);
  
  // 验证分享ID参数
  if (!params.id || !/^[a-zA-Z0-9_-]+$/.test(params.id)) {
    console.error(`无效的分享ID格式: "${params.id}"`);
    return (
      <>
        <SiteHeader />
        <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
          <div className="container mx-auto max-w-4xl px-4 py-12">
            <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg">
              <CardHeader className="bg-red-500 text-white">
                <CardTitle className="text-2xl font-bold text-center">
                  Invalid Share ID
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center space-y-6">
                  <div className="p-4">
                    <h3 className="text-xl font-medium mb-2 text-red-500">
                      Invalid Share URL Format
                    </h3>
                    <p className="text-gray-500 mb-4">
                      The share URL you're trying to access has an invalid format.
                    </p>
                    <Button variant="outline" asChild>
                      <Link href="/">
                        Go to MP3 to WAV Converter
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DebugPanel data={{ params, error: 'invalid_format', success: false }} />
          </div>
        </main>
      </>
    );
  }
  
  const shareData = await getShareData(params.id);
  const isValid = shareData && shareData.success;
  
  console.log(`[分享页面] 分享数据获取结果: 是否有效=${isValid}, 文件名=${shareData?.originalName || 'N/A'}, 错误类型=${shareData?.error || 'none'}`);
  
  // 如果分享数据无效，提供更详细的错误信息显示
  if (!isValid && shareData) {
    console.error(`[分享页面] 分享无效, 错误类型: ${shareData.error}, 消息: ${shareData.message}, 详情: ${shareData.details || 'none'}`);
  }
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg">
            <CardHeader className={isValid ? "bg-[#2A6FDB] text-white" : "bg-red-500 text-white"}>
              <CardTitle className="text-2xl font-bold text-center">
                {isValid ? "Shared WAV File" : "Shared File Not Available"}
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
                    {shareData && shareData.error === 'expired' ? (
                      <p className="text-gray-500">
                        This shared file has expired. Shared files are only available for 24 hours after creation.
                      </p>
                    ) : shareData && shareData.error === 'not_found' ? (
                      <p className="text-gray-500">
                        This shared file could not be found. It may have been deleted or never existed.
                      </p>
                    ) : (
                      <p className="text-gray-500">
                        This shared file is not available. {shareData?.message || 'Shared files are available for 24 hours.'}
                      </p>
                    )}
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
          
          <DebugPanel data={{ 
            params, 
            ...shareData, 
            serverTime: new Date().toISOString(),
            clientTime: typeof window !== 'undefined' ? new Date().toISOString() : null,
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
          }} />
          
          {/* 添加直接检查按钮 */}
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  clientLog('正在手动检查存储...');
                  window.location.href = `/api/test-share?id=${params.id}&fileId=${shareData?.fileId || ''}&_=${Date.now()}`;
                }
              }}
            >
              检查存储状态
            </Button>
            {' '}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  clientLog('正在强制刷新分享...');
                  window.location.href = `/api/share?id=${params.id}&debug=true&force=true&_=${Date.now()}`;
                }
              }}
            >
              强制刷新分享
            </Button>
          </div>
        </div>
      </main>
    </>
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
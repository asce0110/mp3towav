"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ShareButtonProps {
  fileId: string | null;
  originalName: string | null;
}

export function ShareButton({ fileId, originalName }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!fileId) {
      console.error('没有可用的fileId进行分享');
      toast({
        title: "分享失败",
        description: "没有可用的文件进行分享，请先转换文件",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSharing(true);
      console.log(`[分享] 开始创建分享链接: fileId=${fileId}, 原始文件名=${originalName || 'unknown'}`);
      
      // 生成请求ID用于追踪
      const requestId = `share-req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      
      // 标记开始时间用于性能监控
      const startTime = Date.now();
      
      // 首先验证文件是否存在并确保已上传到R2存储
      try {
        console.log(`[分享] 验证文件是否存在并且已上传到R2: fileId=${fileId}`);
        const checkResponse = await fetch(`/api/convert?fileId=${fileId}&check=true&storage=r2`, {
          headers: {
            'x-request-id': `${requestId}-check`,
            'x-debug': 'true'
          }
        });
        
        if (!checkResponse.ok) {
          // 如果文件不存在或未上传到R2，尝试上传
          console.log(`[分享] 文件状态检查失败，状态码: ${checkResponse.status}, 尝试上传文件`);
          
          // 显示上传中通知
          toast({
            title: "正在准备文件",
            description: "文件正在上传到服务器中，请稍候...",
          });
          
          try {
            // 触发文件上传到R2
            const uploadResponse = await fetch(`/api/convert?fileId=${fileId}&uploadToR2=true`, {
              headers: {
                'x-request-id': `${requestId}-upload`,
                'x-debug': 'true'
              }
            });
            
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              console.error(`[分享] 上传文件失败:`, errorData);
              throw new Error(errorData.error || `文件上传失败: ${uploadResponse.status}`);
            }
            
            console.log(`[分享] 文件成功上传到R2: fileId=${fileId}`);
          } catch (uploadError) {
            console.error(`[分享] 上传文件时出错:`, uploadError);
            throw new Error('无法上传文件。请尝试重新转换。');
          }
        } else {
          console.log(`[分享] 文件验证成功，可以继续创建分享: fileId=${fileId}`);
        }
      } catch (checkError) {
        console.error(`[分享] 验证文件时出错:`, checkError);
        // 继续尝试创建分享，因为API会再次进行验证
      }
      
      // 创建分享
      console.log(`[分享] 发送创建分享请求: fileId=${fileId}`);
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          'x-debug': 'true'
        },
        body: JSON.stringify({
          fileId,
          originalName: originalName || `${fileId}.wav`,
          clientTime: new Date().toISOString(),
          ensureUploaded: true  // 新增参数，确保文件已上传到R2
        })
      });
      
      console.log(`[分享] API响应状态: ${response.status}`);
      
      if (!response.ok) {
        // 尝试读取错误消息
        try {
          const errorData = await response.json();
          console.error(`[分享] API错误: ${JSON.stringify(errorData)}`);
          throw new Error(errorData.error || `服务器返回 ${response.status}`);
        } catch (e) {
          console.error(`[分享] 无法解析API错误:`, e);
          throw new Error(`API错误: ${response.status}`);
        }
      }
      
      // 解析响应
      const data = await response.json();
      console.log(`[分享] 创建分享成功: shareId=${data.shareId}, 存储=${data.storageType || 'unknown'}, 耗时=${Date.now() - startTime}ms`);
      
      // 构建分享URL
      const origin = window.location.origin;
      const fullShareUrl = `${origin}/share/${data.shareId}`;
      
      console.log(`[分享] 重定向到分享页面: ${fullShareUrl}`);
      
      // 添加额外的调试信息用于跟踪
      const debugInfo = encodeURIComponent(JSON.stringify({
        time: Date.now(),
        requestId,
        fileId,
        shareId: data.shareId
      }));
      
      // 带调试信息重定向
      window.location.href = `/share/${data.shareId}?_=${Date.now()}&src=direct`;
      
    } catch (error) {
      console.error('[分享] 分享错误:', error);
      toast({
        title: "分享失败",
        description: error instanceof Error ? error.message : "无法创建分享链接，请重试",
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button 
      onClick={handleShare}
      disabled={!fileId || isSharing}
    >
      <Share2 className="h-4 w-4 mr-2" />
      {isSharing ? "创建分享..." : "分享文件"}
    </Button>
  );
} 
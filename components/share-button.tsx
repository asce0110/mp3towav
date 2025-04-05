"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useToast } from '@/components/ui/use-toast';

interface ShareButtonProps {
  fileId: string | null;
  originalName: string | null;
}

export function ShareButton({ fileId, originalName }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleShare = async () => {
    try {
      setIsSharing(true);
      
      // 生成请求ID用于跟踪
      const requestId = `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[分享] 开始分享流程, fileId=${fileId}, requestId=${requestId}`);
      
      // 首先验证文件是否存在并确保已上传到R2存储
      try {
        console.log(`[分享] 验证文件是否存在并且已上传到R2: fileId=${fileId}`);
        const checkResponse = await fetch(`/api/convert?fileId=${fileId}&check=true&storage=r2`, {
          headers: {
            'x-request-id': `${requestId}-check`,
            'x-debug': 'true'
          }
        });
        
        if (!checkResponse.ok || !(await checkResponse.json()).r2Exists) {
          // 如果文件不存在或未上传到R2，尝试上传
          console.log(`[分享] 文件尚未上传到R2，开始上传...`);
          
          // 显示上传中通知
          toast({
            title: "正在准备文件",
            description: "文件正在上传到云存储中，请稍候...",
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
          console.log(`[分享] 文件已存在于R2，可以继续创建分享: fileId=${fileId}`);
        }
      } catch (checkError) {
        console.error(`[分享] 检查文件存在性时出错:`, checkError);
        toast({
          title: "分享准备失败",
          description: "无法验证文件状态，请重试或重新转换。",
          variant: "destructive",
        });
        setIsSharing(false);
        return;
      }
      
      // 调用分享API创建分享链接
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId
        },
        body: JSON.stringify({
          fileId,
          originalName: originalName || `${fileId}.wav`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('分享创建失败:', errorData);
        throw new Error(errorData.error || '创建分享失败，请重试');
      }
      
      const data = await response.json();
      console.log('分享创建成功:', data);
      
      // 构建完整的分享URL
      const origin = window.location.origin;
      const fullShareUrl = `${origin}/share/${data.shareId}`;
      setShareUrl(fullShareUrl);
      
      // 将分享链接复制到剪贴板
      await navigator.clipboard.writeText(fullShareUrl);
      
      toast({
        title: "分享链接已创建",
        description: "链接已复制到剪贴板，有效期24小时",
      });
      
      // 跳转到分享页面，并在URL参数中携带分享链接
      window.location.href = `/share?url=${encodeURIComponent(fullShareUrl)}`;
    } catch (error) {
      console.error('分享过程出错:', error);
      toast({
        title: "分享失败",
        description: error instanceof Error ? error.message : "创建分享链接失败，请重试",
        variant: "destructive",
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
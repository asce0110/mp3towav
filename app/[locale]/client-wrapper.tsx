"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// 动态导入HomeClient组件
export const DynamicHomeClient = dynamic(
  () => import('./home-client').then(mod => mod.HomeClient), 
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl">加载中...</span>
      </div>
    )
  }
);

// 动态导入ShareClient组件
export const DynamicShareClient = dynamic(
  () => import('./share-client').then(mod => mod.ShareClient), 
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl">加载中...</span>
      </div>
    )
  }
); 
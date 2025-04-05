import dynamic from 'next/dynamic';
import { SiteHeader } from "@/components/site-header";
import { MP3toWAVConverter } from "@/components/mp3-to-wav-converter";
import { useTranslations } from 'next-intl';

// 动态导入英文版组件，移除ssr:false选项
const LocalizedHome = dynamic(() => import('./[locale]/page'), {
  loading: () => <div className="flex justify-center items-center min-h-screen">Loading...</div>
});

export default function Home() {
  return (
    <LocalizedHome />
  );
}


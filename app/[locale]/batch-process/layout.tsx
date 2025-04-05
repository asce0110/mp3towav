import type { Metadata } from 'next'
import { locales, defaultLocale } from "@/lib/i18n.config"
import { Toaster } from "@/components/ui/toaster"

// 动态元数据生成
export async function generateMetadata(props: {
  params: { locale: string };
}): Promise<Metadata> {
  // 使用await解包Promise
  const params = await props.params;
  const locale = params.locale || defaultLocale;
  
  // Validate that the locale exists
  if (!locales.includes(locale as (typeof locales)[number])) {
    return {
      title: 'MP3 to WAV Batch Processor | Convert Multiple Files',
      description: 'Convert multiple MP3 files to WAV format at once with our batch processing tool. Save time and process audio files in bulk.',
      metadataBase: new URL('https://mp3towav.vercel.app'),
      alternates: {
        canonical: '/batch-process'
      }
    };
  }
  
  return {
    title: 'MP3 to WAV Batch Processor | Convert Multiple Files',
    description: 'Convert multiple MP3 files to WAV format at once with our batch processing tool. Save time and process audio files in bulk.',
    metadataBase: new URL('https://mp3towav.vercel.app'),
    alternates: {
      canonical: locale === defaultLocale ? '/batch-process' : `/${locale}/batch-process`
    }
  };
}

export default function BatchProcessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
} 
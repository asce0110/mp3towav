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
      title: 'MP3 to WAV Share | Access Shared Audio Files',
      description: 'Access and share WAV audio files converted from MP3 format. Easy file sharing with our online converter.',
      metadataBase: new URL('https://mp3towav.net'),
      alternates: {
        canonical: '/share'
      }
    };
  }
  
  return {
    title: 'MP3 to WAV Share | Access Shared Audio Files',
    description: 'Access and share WAV audio files converted from MP3 format. Easy file sharing with our online converter.',
    metadataBase: new URL('https://mp3towav.net'),
    alternates: {
      canonical: locale === defaultLocale ? '/share' : `/${locale}/share`
    }
  };
}

export default function ShareLayout({
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
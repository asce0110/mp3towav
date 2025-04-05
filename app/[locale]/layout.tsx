import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { locales, defaultLocale } from "@/lib/i18n.config"
import { NextIntlClientProvider } from 'next-intl'
import "@/app/globals.css"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { notFound } from "next/navigation"
import React from "react"

const inter = Inter({ subsets: ["latin"] })

// 定义静态参数，使构建时生成所有语言版本
export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

// 定义locales的类型
type LocaleType = typeof locales[number];

// 动态元数据
export async function generateMetadata(props: {
  params: { locale: string };
}) {
  // 使用await解包Promise
  const params = await props.params;
  const locale = params.locale || defaultLocale;
  
  // Validate that the locale exists
  if (!locales.includes(locale as LocaleType)) {
    return {
      title: 'MP3 to WAV Converter',
      description: 'Convert MP3 files to WAV format easily online',
      keywords: 'mp3, wav, conversion, audio, online converter',
      metadataBase: new URL('https://mp3towav.net'),
      alternates: {
        canonical: '/'
      }
    };
  }

  try {
    const messages = await import(`@/messages/${locale}/index.json`).then(m => m.default);
    
    // Load site metadata from translation file if it exists
    return {
      title: messages.app?.title || 'MP3 to WAV Converter',
      description: messages.app?.description || 'Convert MP3 files to WAV format easily online',
      keywords: messages.metadata?.keywords || 'mp3, wav, conversion, audio, online converter',
      metadataBase: new URL('https://mp3towav.net'),
      alternates: {
        canonical: '/'
      }
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    
    // Fallback metadata
    return {
      title: 'MP3 to WAV Converter',
      description: 'Convert MP3 files to WAV format easily online',
      keywords: 'mp3, wav, conversion, audio, online converter',
      metadataBase: new URL('https://mp3towav.net'),
      alternates: {
        canonical: '/'
      }
    };
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // 正确使用async/await解决警告
  const locale = (await params).locale || defaultLocale;
  
  if (!locales.includes(locale as LocaleType)) {
    console.error(`Invalid locale: ${locale}`);
    notFound();
  }

  // 使用同步导入以提高性能
  let messages;
  try {
    // 在构建时导入所有可能的消息文件
    messages = require(`@/messages/${locale}/index.json`);
  } catch (error) {
    console.error(`Could not load messages for locale "${locale}"`, error);
    try {
      messages = require(`@/messages/${defaultLocale}/index.json`);
    } catch (fallbackError) {
      console.error('Failed to load fallback messages', fallbackError);
      notFound();
    }
  }

  return (
    <div lang={locale} className={cn(inter.className, "h-full")} suppressHydrationWarning>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="min-h-screen bg-background font-sans antialiased">
            {children}
          </div>
        </NextIntlClientProvider>
        <Toaster />
      </ThemeProvider>
    </div>
  )
}
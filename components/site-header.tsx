"use client";

import LanguageSwitcher from "@/components/lang-switcher";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { locales, defaultLocale } from "@/lib/i18n.config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

// 定义locales的类型
type LocaleType = typeof locales[number];

// 内联实现ModeToggle组件，避免import错误
function ModeToggle() {
  const { setTheme } = useTheme();
  const t = useTranslations("header");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('theme')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const t = useTranslations("header");
  const [locale, setLocale] = useState<string>(defaultLocale);
  const pathname = usePathname();
  
  useEffect(() => {
    const extractedLocale = pathname.split('/')[1];
    const localesList = Array.isArray(locales) ? locales : [];
    
    if (extractedLocale && localesList.includes(extractedLocale as LocaleType)) {
      setLocale(extractedLocale);
    } else {
      setLocale(defaultLocale);
    }
  }, [pathname]);

  // 获取历史页面链接
  const getHistoryLink = () => {
    return locale === defaultLocale ? '/history' : `/${locale}/history`;
  };

  // 获取首页链接
  const getHomeLink = () => {
    return locale === defaultLocale ? '/' : `/${locale}`;
  };

  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center">
          <a 
            href={getHomeLink()}
            className="flex items-center gap-2"
            suppressHydrationWarning
          >
            <div className="relative w-8 h-8 mr-1">
              <Image 
                src="/icon1.png" 
                alt="MP3 to WAV" 
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-lg tracking-tight">MP3 to WAV</span>
          </a>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild 
            className="rounded-full"
          >
            <Link href={getHistoryLink()} title={t('history')}>
              <History className="h-5 w-5" />
              <span className="sr-only">{t('history')}</span>
            </Link>
          </Button>
          
          <div className="h-5 border-r border-gray-200 dark:border-gray-700"></div>
          {/* 使用新的语言切换器组件 */}
          <LanguageSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
} 
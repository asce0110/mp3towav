"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";
import { locales, defaultLocale } from "@/lib/i18n.config";
import { Globe, Check, ChevronDown } from "lucide-react";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // 客户端组件挂载检查
  useEffect(() => {
    setMounted(true);
    console.log("当前路径:", pathname);
    console.log("当前语言:", currentLocale);
  }, [pathname, currentLocale]);
  
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="h-9 w-9 md:w-auto gap-1 relative overflow-hidden">
        <Globe className="h-4 w-4" />
      </Button>
    );
  }

  // 提取不带语言前缀的路径部分
  const getPathWithoutLocale = (path: string) => {
    // 匹配形如 /en/path 或 /en 的路径
    const langPathRegex = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?:\/(.*))?$/;
    const matches = path.match(langPathRegex);
    
    if (matches) {
      return matches[2] ? `/${matches[2]}` : '/';
    }
    
    // 如果没有语言前缀，返回原始路径
    return path;
  };

  // 获取切换语言后的完整URL
  const getLanguageUrl = (locale: string) => {
    const pathWithoutLocale = getPathWithoutLocale(pathname);
    
    // 如果是默认语言，不显示语言前缀
    if (locale === defaultLocale) {
      return pathWithoutLocale;
    }
    
    // 否则添加语言前缀
    return `/${locale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`;
  };

  // 当前选中的语言信息
  const currentLanguage = locales.find(locale => locale.code === currentLocale) || locales[0];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-3 md:px-4 relative overflow-hidden group"
        >
          <motion.div 
            className="flex items-center gap-1.5"
            initial={{ y: 0 }}
            animate={{ y: isOpen ? -30 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Globe className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="hidden md:inline-flex font-medium">
              {currentLanguage.label}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-all duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
          </motion.div>
          <motion.div 
            className="flex items-center gap-1.5 absolute inset-0 justify-center"
            initial={{ y: 30 }}
            animate={{ y: isOpen ? 0 : 30 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-sm font-medium">选择语言</span>
          </motion.div>
        </Button>
      </DropdownMenuTrigger>
      <AnimatePresence>
        {isOpen && (
          <DropdownMenuContent 
            align="end" 
            className="w-[180px] p-2"
            asChild
            forceMount
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div className="grid grid-cols-1 gap-1">
                {locales.map((locale) => {
                  const isActive = currentLocale === locale.code;
                  const localeUrl = getLanguageUrl(locale.code);
                  
                  console.log(`${locale.code} 链接:`, localeUrl);
                  
                  return (
                    <a 
                      key={locale.code}
                      href={localeUrl}
                      className="no-underline"
                      onClick={(e) => {
                        e.preventDefault();
                        console.log("点击语言", locale.code, "跳转到:", localeUrl);
                        router.push(localeUrl);
                        setIsOpen(false);
                      }}
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg data-[highlighted]:bg-accent/50 ${
                          isActive ? 'bg-accent font-medium' : ''
                        }`}
                      >
                        <span className="text-lg">{locale.icon}</span>
                        <span className="flex-1 text-sm">{locale.label}</span>
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </motion.div>
                        )}
                      </DropdownMenuItem>
                    </a>
                  );
                })}
              </div>
            </motion.div>
          </DropdownMenuContent>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
} 
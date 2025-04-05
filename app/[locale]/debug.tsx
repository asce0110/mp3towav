"use client";

import { useTranslations } from "next-intl";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { localesList } from "@/lib/i18n.config";

export default function DebugPage() {
  const params = useParams();
  const pathname = usePathname();
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  let t;
  try {
    t = useTranslations("header");
    
    // 加载成功后更新状态
    useEffect(() => {
      try {
        const translationTests = {
          "header.home": t("home"),
          "header.history": t("history"),
          "header.github": t("github") || "未定义",
          "header.feedback": t("feedback") || "未定义"
        };
        setTranslations(translationTests);
      } catch (e) {
        if (e instanceof Error) {
          setError(`翻译加载错误: ${e.message}`);
        } else {
          setError("翻译加载错误");
        }
      }
    }, [t]);
  } catch (e) {
    if (e instanceof Error) {
      setError(`翻译初始化错误: ${e.message}`);
    } else {
      setError("翻译初始化错误");
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">调试页面</h1>
      
      <div className="mb-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">国际化参数</h2>
        <div className="space-y-2">
          <p><strong>当前语言参数:</strong> {JSON.stringify(params)}</p>
          <p><strong>当前路径:</strong> {pathname}</p>
          <p><strong>支持的语言:</strong> {localesList.join(', ')}</p>
        </div>
      </div>
      
      {error ? (
        <div className="p-6 bg-red-100 dark:bg-red-900 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-2 text-red-700 dark:text-red-300">错误</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div className="mb-8 p-6 bg-green-100 dark:bg-green-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-green-700 dark:text-green-300">翻译测试</h2>
          <div className="space-y-2">
            {Object.entries(translations).map(([key, value]) => (
              <p key={key}><strong>{key}:</strong> {value}</p>
            ))}
          </div>
        </div>
      )}
      
      <div className="mb-8 p-6 bg-blue-100 dark:bg-blue-900 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-300">语言切换测试</h2>
        <div className="flex flex-wrap gap-2">
          {localesList.map(locale => (
            <Link key={locale} href={`/${locale === 'en' ? '' : locale}/debug`}>
              <Button 
                variant={params.locale === locale ? "default" : "outline"}
                className="mr-2 mb-2"
              >
                切换到 {locale}
              </Button>
            </Link>
          ))}
        </div>
      </div>
      
      <div className="mt-8 flex space-x-4">
        <Link href="/">
          <Button variant="outline">返回首页</Button>
        </Link>
      </div>
    </div>
  );
} 
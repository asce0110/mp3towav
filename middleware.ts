import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n.config';

// 创建中间件之前的调试信息
console.log(`[Middleware] 初始化中间件，默认语言: ${defaultLocale}, 支持语言: ${locales.join(', ')}`);

// 创建一个自定义中间件
const nextIntlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: locales,
  
  // If this locale is matched, pathnames work without a prefix (e.g. `/about`)
  defaultLocale,
  
  // 修改为"as-needed"，这样默认语言(英文)的URL不会带前缀
  localePrefix: 'as-needed',
  
  // Don't use auto detection to ensure consistent behavior
  localeDetection: false
});

// 包装中间件，添加调试信息
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`[Middleware] 处理请求: ${request.method} ${pathname}`);
  
  // 检查是否有语言前缀
  const pathnameHasLocale = locales.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  
  console.log(`[Middleware] 路径是否包含语言前缀: ${pathnameHasLocale}`);
  
  // 如果路径以默认语言(英语)开头，移除前缀以保持URL干净
  if (pathname.startsWith(`/${defaultLocale}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(`/${defaultLocale}`, '');
    console.log(`[Middleware] 重定向到不带英语前缀的路径: ${url.pathname}`);
    return NextResponse.redirect(url);
  }
  
  // 如果路径没有语言前缀且不是英语路径，且不在排除列表中，则重定向到指定语言路径
  if (!pathnameHasLocale && 
      !pathname.startsWith('/api/') && 
      !pathname.startsWith('/_next/') && 
      !pathname.includes('.')) {
    // 不添加默认语言前缀，因为默认语言(英语)不需要前缀
    // 这里保持URL不变，交给nextIntlMiddleware处理
    console.log(`[Middleware] 不添加默认语言前缀，保持路径: ${pathname}`);
  }
  
  // 执行原始中间件处理
  const response = nextIntlMiddleware(request);
  
  // 输出重定向信息（如果有）
  if (response.headers.get('Location')) {
    console.log(`[Middleware] 重定向到: ${response.headers.get('Location')}`);
  }
  
  return response;
}

// 中间件配置
export const config = {
  // Skip all paths that should not be internationalized.
  // This skips the folders for API routes, static files, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}; 
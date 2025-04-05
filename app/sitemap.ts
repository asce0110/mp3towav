import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/lib/i18n.config'

// 站点URL
const baseUrl = 'https://mp3towav.vercel.app'

// 主要页面路径
const routes = [
  '',                // 首页
  '/share',          // 分享页面
  '/batch-process',  // 批处理页面
]

// 生成网站地图
export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date().toISOString()
  const sitemapEntries: MetadataRoute.Sitemap = []
  
  // 添加主页（英文默认版本）
  sitemapEntries.push({
    url: baseUrl,
    lastModified: currentDate,
    changeFrequency: 'weekly',
    priority: 1.0,
  })
  
  // 添加所有语言版本的页面（除了默认英文）
  for (const locale of locales) {
    // 跳过默认语言（已经添加为根路径）
    if (locale === defaultLocale) continue
    
    // 为每种语言添加主页
    sitemapEntries.push({
      url: `${baseUrl}/${locale}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    })
    
    // 为每种语言添加其他页面
    for (const route of routes) {
      // 跳过主页（已处理）
      if (route === '') continue
      
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: currentDate,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  }
  
  // 添加英文版的其他页面（不带语言前缀）
  for (const route of routes) {
    // 跳过主页（已处理）
    if (route === '') continue
    
    sitemapEntries.push({
      url: `${baseUrl}${route}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    })
  }
  
  return sitemapEntries
} 
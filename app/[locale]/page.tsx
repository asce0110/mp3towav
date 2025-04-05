import dynamic from 'next/dynamic'

// 使用动态导入延迟加载客户端组件，防止服务器预渲染时出现问题
const HomeClient = dynamic(() => import('./home-client').then(mod => mod.HomeClient), {
  ssr: false, // 关闭服务器端渲染
})

// 纯服务器组件
export default function LocalizedHome() {
  return <HomeClient />
} 
import { DynamicHomeClient } from './client-wrapper'

// 服务器组件直接导入并使用客户端包装的组件
export default function LocalizedHome() {
  return <DynamicHomeClient />
} 
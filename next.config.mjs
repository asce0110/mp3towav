let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      bodySizeLimit: '500mb',
      timeLimit: 300, // 5分钟
    },
    // 提高Cloudflare Worker兼容性
    modularizeImports: {
      'react-icons': {
        transform: 'react-icons/{{member}}',
      },
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
  // 不再需要重写sitemap.xml，因为我们有了直接的路由
  /* 注释掉旧的重写规则
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
    ];
  },
  */
  serverRuntimeConfig: {
    maxBodySize: '500mb', // 设置最大上传大小为 500MB
  },
  // 迁移到新的配置位置
  serverExternalPackages: ['ffmpeg-static'],
  
  // Cloudflare Pages配置
  output: 'standalone',
  
  // 压缩和减小构建大小
  webpack: (config, { dev, isServer }) => {
    // 仅在生产环境下优化
    if (!dev) {
      config.optimization.minimize = true;
      
      // 减小chunk大小，避免超过Cloudflare 25MB限制
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        maxSize: 20 * 1024 * 1024, // 20MB
      };
    }
    
    return config;
  },
}

// 显式配置API上传大小限制
if (!process.env.NEXT_PUBLIC_API_BODYPARSER_SIZE_LIMIT) {
  process.env.NEXT_PUBLIC_API_BODYPARSER_SIZE_LIMIT = '100mb';
}

// 设置全局变量
process.env.NEXT_BODY_SIZE_LIMIT = '4mb'; // 设置单次请求体大小限制为4MB

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig

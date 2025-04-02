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
  serverRuntimeConfig: {
    maxBodySize: '500mb', // 设置最大上传大小为 500MB
  },
  // 迁移到新的配置位置
  serverExternalPackages: ['ffmpeg-static'],
  
  // Cloudflare Pages配置
  output: 'standalone',
  swcMinify: true, // 使用SWC压缩
  productionBrowserSourceMaps: false, // 禁用源码映射
  
  // 压缩和减小构建大小
  webpack: (config, { dev, isServer, webpack }) => {
    // 仅在生产环境下优化
    if (!dev) {
      // 启用最大化压缩
      config.optimization.minimize = true;
      
      // 启用源码裁剪(Tree Shaking)
      config.optimization.usedExports = true;
      
      // 启用模块拼接
      config.optimization.concatenateModules = true;
      
      // 减小chunk大小，避免超过Cloudflare 25MB限制
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 50, // 增加请求数以减小文件大小
        maxAsyncRequests: 50,
        minSize: 10000, // 减小最小尺寸
        maxSize: 1 * 1024 * 1024, // 减小到1MB
        enforceSizeThreshold: 1 * 1024 * 1024, // 强制为超过1MB的chunk进行分割
        cacheGroups: {
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler)[\\/]/,
            priority: 50,
            chunks: 'all',
            enforce: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 30,
            reuseExistingChunk: true,
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              // 将node_modules中的库拆分为单独的chunks
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
              return `npm.${packageName.replace('@', '')}`;
            },
            priority: 40,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          styles: {
            name: 'styles',
            test: /\.css$/,
            chunks: 'all',
            enforce: true,
          }
        }
      };
      
      // 优化CSS
      if (!isServer) {
        const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
        if (!config.optimization.minimizer) {
          config.optimization.minimizer = [];
        }
        config.optimization.minimizer.push(new CssMinimizerPlugin({
          minimizerOptions: {
            preset: ['default', { discardComments: { removeAll: true } }],
          },
        }));
      }
      
      // 禁止生成source maps减小文件大小
      if (!isServer) {
        config.devtool = false;
      }
      
      // 添加自定义插件以去除开发特性
      config.plugins = config.plugins || [];
      
      // 修复: 使用传入的webpack参数而不是config.webpack
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('production')
        }),
        // 添加一个插件忽略moment的locale文件来减小体积
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\/locale$/,
          contextRegExp: /moment$/
        })
      );
      
      // 修改缓存策略，避免生成超大.pack文件
      config.cache = {
        type: 'filesystem',
        version: `${process.env.BUILD_ID || 'dev'}`,
        cacheDirectory: path.resolve('.next/cache'),
        store: 'pack',
        buildDependencies: {
          config: [__filename],
        },
        maxAge: 604800000, // 7天
        compression: 'gzip'
      };
    }
    
    return config;
  },
  
  // 配置额外忽略的文件和目录
  distDir: '.next',
  generateBuildId: async () => {
    return `build-${new Date().getTime()}`;
  },
  poweredByHeader: false
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

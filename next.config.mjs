import createNextIntlPlugin from 'next-intl/plugin';

// 创建next-intl插件
const withNextIntl = createNextIntlPlugin('./app/i18n/messages.ts');

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
  }
};

// 导出配置，使用 withNextIntl 包装配置
export default withNextIntl(nextConfig);

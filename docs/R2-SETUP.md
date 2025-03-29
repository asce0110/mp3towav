# Cloudflare R2存储设置指南

本文档提供了如何设置和配置Cloudflare R2存储以及文件生命周期管理的详细说明。

## 什么是R2存储？

Cloudflare R2存储是一种兼容S3的对象存储服务，提供低延迟和无出口费用的特点。在MP3toWAV转换器应用中，我们使用R2存储：

1. 存储转换后的WAV文件
2. 存储分享链接的元数据
3. 实现24小时后自动清理过期文件

## 配置步骤

### 1. 创建R2存储桶

1. 登录Cloudflare控制面板: https://dash.cloudflare.com/
2. 导航到 R2 > 创建存储桶
3. 创建一个名为 `mp3towav` 的存储桶
4. 保持所有默认设置

### 2. 创建R2访问密钥

1. 导航到 R2 > 管理R2 API令牌
2. 点击 "创建API令牌"
3. 创建一个具有 "对象读写" 权限的令牌
4. 保存生成的访问密钥ID和密钥

### 3. 配置环境变量

在应用的环境变量中配置以下值：

```
R2_ACCOUNT_ID=您的Cloudflare账户ID（例如：9a54200354c496d0e610009d7ab97c17）
R2_ACCESS_KEY_ID=您的R2访问密钥ID
R2_SECRET_ACCESS_KEY=您的R2密钥
R2_BUCKET_NAME=mp3towav
```

### 4. 验证R2配置

可以使用我们提供的测试脚本验证R2配置是否正确：

```bash
node scripts/check-r2.js
```

该脚本将测试连接、上传和下载功能，确保R2存储配置正确。

## 文件生命周期管理

我们提供了两种方法来管理R2存储中的文件生命周期：

### 方法1: 使用Cloudflare Workers（推荐）

这是最可靠的方法，因为它即使在应用服务器关闭时也能运行。

1. 在Cloudflare Workers中创建一个新的Worker
2. 使用 `workers/r2-cleanup.js` 中的代码
3. 绑定您的R2存储桶（在Worker的设置中）
4. 设置触发器为定时触发，例如每小时执行一次

配置示例：
```js
name = "mp3towav-r2-cleanup"
main = "r2-cleanup.js"
compatibility_date = "2023-10-30"

[[r2_buckets]]
binding = "MP3TOWAV_BUCKET"
bucket_name = "mp3towav"

[vars]
SECURITY_TOKEN = "your-secret-token"

[triggers]
crons = ["0 * * * *"] # 每小时执行一次
```

### 方法2: 使用Node.js脚本

如果您无法使用Cloudflare Workers，可以通过cron作业运行Node.js脚本。

1. 确保已安装所需的npm包：`npm install @aws-sdk/client-s3`
2. 设置定时任务执行 `scripts/cleanup-r2.js`

示例cron配置：
```
0 * * * * node /path/to/scripts/cleanup-r2.js >> /path/to/logs/r2-cleanup.log 2>&1
```

## 文件存储结构

R2存储桶中的文件组织如下：

```
mp3towav/
  ├── mp3/                # 原始MP3文件（可选）
  │   └── {fileId}.mp3
  ├── wav/                # 转换后的WAV文件
  │   └── {fileId}.wav
  └── shares/             # 分享链接元数据
      └── {shareId}.json
```

## 故障排除

如果遇到R2相关问题，请检查：

1. 环境变量是否正确配置
2. R2访问密钥是否有效
3. 应用日志中的R2错误信息
4. Cloudflare控制面板中的使用统计和错误

## 其他资源

- [Cloudflare R2 官方文档](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/) 
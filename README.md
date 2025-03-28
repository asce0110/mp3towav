# MP3 to WAV Converter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Made with Node.js](https://img.shields.io/badge/Node.js-14.x-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> An efficient and user-friendly tool for converting MP3 audio files to WAV format with high-quality output.

## 🎵 Features

- **Simple Conversion**: Convert MP3 files to WAV format with just a few clicks
- **Batch Processing**: Convert multiple files at once
- **High Quality**: Maintain audio quality during conversion
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Lightweight**: Minimal system requirements

## 📋 Requirements

- Node.js 14.x or higher
- pnpm (for package management)

## 🚀 Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/asce0110/mp3towav.git
   cd mp3towav
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

## 💻 Usage

### Command Line Interface

Convert a single file:
```bash
pnpm start --input="path/to/audio.mp3" --output="path/to/output.wav"
```

Convert multiple files:
```bash
pnpm start --input="path/to/directory" --output="path/to/output/directory"
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--input`, `-i` | Input MP3 file or directory | - |
| `--output`, `-o` | Output WAV file or directory | Same as input with .wav extension |
| `--quality`, `-q` | Output quality (1-10) | 5 |
| `--verbose`, `-v` | Show detailed conversion information | false |

## 📚 API Documentation

If you want to use this tool programmatically:

```javascript
const { convertToWav } = require('mp3towav');

// Convert a single file
convertToWav('input.mp3', 'output.wav', { quality: 8 })
  .then(() => console.log('Conversion complete!'))
  .catch(error => console.error('Conversion failed:', error));
```

## 🤝 Contributing

Contributions, issues and feature requests are welcome! Feel free to check [issues page](https://github.com/asce0110/mp3towav/issues).

## 📝 License

This project is [MIT](LICENSE) licensed.

## 🙏 Acknowledgements

- [FFMPEG](https://ffmpeg.org/) for the underlying audio conversion
- [Node.js](https://nodejs.org/) for the runtime environment
- All contributors who have helped this project

## R2存储清理

为确保R2存储不会累积过多未使用文件，项目提供了两种清理方案：

### 方案1：Node.js脚本（适合本地/服务器运行）

可以通过cron任务定期运行Node.js脚本清理过期文件：

```bash
# 每小时运行一次
0 * * * * node /path/to/scripts/cleanup-r2.js >> /path/to/logs/r2-cleanup.log 2>&1
```

脚本位置：`scripts/cleanup-r2.js`

### 方案2：Cloudflare Worker（推荐）

使用Cloudflare Worker定时清理R2存储桶：

1. 安装Wrangler CLI：
   ```bash
   pnpm install -g wrangler
   ```

2. 登录Cloudflare账户：
   ```bash
   wrangler login
   ```

3. 部署Worker：
   ```bash
   cd scripts
   wrangler publish
   ```

配置文件位置：`scripts/wrangler.toml`
Worker代码：`scripts/r2-cleaner-worker.js`

此Worker会每6小时自动清理一次超过24小时的文件。

---

Made with ❤️ by [Asce](https://github.com/asce0110) 
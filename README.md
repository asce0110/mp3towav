# MP3 to WAV Converter - Free Online Audio Conversion

[![Visit Website](https://img.shields.io/badge/Visit-mp3towav.net-blue.svg)](https://mp3towav.net)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Made with Next.js](https://img.shields.io/badge/Next.js-15.x-black.svg)](https://nextjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> 🎵 **[MP3toWAV.net](https://mp3towav.net)** - The most advanced free online MP3 to WAV converter with high-quality lossless conversion, batch processing, and customizable audio settings.

## 🚀 Features

- **🌐 [Free Online Access](https://mp3towav.net)**: No installation needed, works directly in your browser
- **🔊 High-Quality Conversion**: Maintain the highest audio fidelity during MP3 to WAV conversion
- **📦 Batch Processing**: Convert multiple MP3 files to WAV format simultaneously
- **⚙️ Advanced Settings**: Customize sample rate, bit depth, and volume during conversion
- **🔒 Privacy Focused**: Files processed locally in your browser - nothing uploaded to our servers
- **🌍 Multi-language Support**: Available in 8+ languages including English, Chinese, Spanish, and more
- **📱 Mobile Friendly**: Responsive design works on all devices
- **⚡ Lightning Fast**: Optimized conversion engine for quick processing
- **💾 Simple File Sharing**: Share converted WAV files with friends or across devices

## 🔗 Quick Links

- **[Official Website](https://mp3towav.net)**: Visit our free online MP3 to WAV converter
- **[Batch Processing](https://mp3towav.net/batch-process)**: Convert multiple files at once
- **[File Sharing](https://mp3towav.net/share)**: Access our file sharing features

## 🤔 Why Convert MP3 to WAV?

WAV files offer **lossless audio quality** that's essential for:
- Professional audio editing and production
- Archiving music in the highest quality format
- Audio analysis and processing
- Compatibility with professional audio equipment
- Avoiding quality loss in further editing

## 💻 Technical Information

This project is built with modern web technologies:

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Audio Processing**: Web Audio API, AudioContext
- **Backend**: Node.js, Cloudflare R2 Storage
- **Infrastructure**: Vercel for hosting

## 🌟 What Makes MP3toWAV.net Special?

- **Zero Installation**: No software to download - works entirely in your browser
- **No File Size Limits**: Convert large MP3 files without restrictions
- **Cross-Platform**: Works on Windows, macOS, Linux, iOS, and Android
- **No Watermarks**: Clean, professional WAV files without any added watermarks
- **Metadata Preservation**: Maintains audio metadata when possible

## 🤝 Contributing

Contributions, issues and feature requests are welcome! Feel free to check our [issues page](https://github.com/asce0110/mp3towav/issues).

## 📝 License

This project is [MIT](LICENSE) licensed.

## 🧹 Storage Management

For R2 storage management, we provide two cleaning solutions:

### Option 1: Node.js script (for local/server execution)

Set up cron jobs to periodically clean expired files:

```bash
# Run hourly
0 * * * * node /path/to/scripts/cleanup-r2.js >> /path/to/logs/r2-cleanup.log 2>&1
```

Script location: `scripts/cleanup-r2.js`

### Option 2: Cloudflare Worker (recommended)

Use Cloudflare Workers to automatically clean R2 storage:

1. Install Wrangler CLI:
   ```bash
   pnpm install -g wrangler
   ```

2. Log in to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy Worker:
   ```bash
   cd scripts
   wrangler publish
   ```

Configuration: `scripts/wrangler.toml`
Worker code: `scripts/r2-cleaner-worker.js`

This worker automatically cleans files older than 24 hours every 6 hours.

---

🌟 **[Visit MP3toWAV.net](https://mp3towav.net)** - The ultimate free MP3 to WAV converter online! 
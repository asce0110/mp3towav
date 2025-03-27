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

---

Made with ❤️ by [Asce](https://github.com/asce0110) 
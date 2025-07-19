# Getting Started with mkdemo

Welcome to mkdemo! This guide will help you set up and run your first AI-powered web demo video.

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **FFmpeg** - [Installation guide](https://ffmpeg.org/download.html)
- **API Keys**:
  - OpenAI API key (GPT-4 access recommended)
  - ElevenLabs API key

### 2. Installation

```bash
# Clone or download the project
cd mkdemo

# Install dependencies
pnpm install

# Run setup script
pnpm run setup
```

### 3. Configuration

Edit the `.env` file with your API keys:

```env
# Required: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-key-here

# Required: ElevenLabs API Key  
ELEVENLABS_API_KEY=your-elevenlabs-key-here

# Optional: Specific voice ID (uses default if not set)
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
```

### 4. Your First Demo

```bash
mkdemo create \
  --user your@email.com \
  --password yourpassword \
  --url https://example.com \
  --verbose
```

## 📋 Command Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--user, -u` | Login email | ✅ | - |
| `--password, -p` | Login password | ✅ | - |
| `--url` | Website URL | ✅ | - |
| `--output, -o` | Output directory | ❌ | `./output` |
| `--verbose, -v` | Verbose logging | ❌ | `false` |
| `--max-interactions` | Max AI interactions | ❌ | `10` |
| `--headless` | Headless browser | ❌ | `true` |

## 🎯 Example Workflows

### Basic Demo
```bash
mkdemo create --user demo@company.com --password demo123 --url https://app.company.com
```

### Detailed Demo with Custom Settings
```bash
mkdemo create \
  --user admin@startup.io \
  --password securepass \
  --url https://dashboard.startup.io \
  --output ./demos/startup \
  --max-interactions 15 \
  --verbose
```

### Debug Mode (Non-headless)
```bash
mkdemo create \
  --user test@example.com \
  --password testpass \
  --url https://staging.example.com \
  --headless false \
  --verbose
```

## 📁 Output Files

After successful completion, you'll find:

```
output/
├── demo_2024-01-15T10-30-45-123Z.mp4     # Main video file
├── transcription_2024-01-15T10-30-45-123Z.txt  # Text transcript
├── transcription_2024-01-15T10-30-45-123Z.srt  # Subtitle file
└── mkdemo_2024-01-15T10-30-45-123Z.log         # Execution log
```

## 🔧 Development

### Running Tests
```bash
# All tests
pnpm test

# Watch mode
pnpm run test:watch

# Coverage report
pnpm run test:coverage
```

### Code Quality
```bash
# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix

# Format code
pnpm run format
```

## 🐛 Troubleshooting

### Common Issues

**1. "FFmpeg not found"**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

**2. "OpenAI API Error"**
- Verify your API key is correct
- Check you have sufficient credits
- Ensure GPT-4 access (recommended)

**3. "ElevenLabs API Error"**
- Verify your API key is correct
- Check your character quota
- Try a different voice ID

**4. "Browser Launch Failed"**
```bash
# Install missing dependencies (Linux)
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

**5. "Authentication Failed"**
- Verify credentials are correct
- Check if the website has CAPTCHA
- Try with `--headless false` to debug visually

### Debug Mode

For detailed debugging, run with verbose logging:

```bash
mkdemo create --verbose --headless false --user your@email.com --password yourpass --url https://example.com
```

This will:
- Show detailed logs
- Run browser in visible mode
- Help identify issues step-by-step

## 🎨 Customization

### Voice Settings

You can customize the voice by setting different ElevenLabs voice IDs:

```env
# Professional male voice
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB

# Professional female voice  
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
```

### Video Quality

Modify video settings in your environment:

```env
# Video settings
VIDEO_FPS=30
VIDEO_QUALITY=high  # high, medium, low
```

## 📚 Advanced Usage

### Programmatic Usage

```javascript
import { createDemo } from './src/index.js';

const result = await createDemo({
  user: 'demo@example.com',
  password: 'password123',
  url: 'https://app.example.com',
  outputDir: './custom-output',
  verbose: true,
  maxInteractions: 8,
  headless: true,
});

console.log('Video created:', result.videoPath);
console.log('Transcript:', result.transcriptPath);
```

### Custom AI Prompts

The AI decision-making can be customized by modifying the prompts in `src/ai/decision-maker.js`.

## 🤝 Support

- **Issues**: Check the logs in your output directory
- **Questions**: Review this guide and the main README.md
- **Bugs**: Create detailed issue reports with logs

## 🎉 Success Tips

1. **Start Simple**: Test with a basic website first
2. **Use Verbose Mode**: Always use `--verbose` when testing
3. **Check Logs**: Review the generated log files for insights
4. **Verify APIs**: Test your API keys work independently
5. **Monitor Usage**: Keep track of API usage and costs

Happy demo creating! 🚀
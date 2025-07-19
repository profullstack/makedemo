# mkdemo - AI-Powered Web Demo Video Generator

A CLI tool that automates generating high-quality web demo MP4 videos by intelligently interacting with websites using AI-driven decision making.

## Features

- 🤖 **AI-Driven Interactions**: Uses OpenAI GPT-4+ to intelligently decide website interactions
- 🎬 **High-Quality Video**: Records 1080p 30fps MP4 videos optimized for web streaming
- 🗣️ **Natural Narration**: Generates speech using ElevenLabs for professional voiceovers
- 🔐 **Automatic Authentication**: Handles login forms automatically
- 📝 **Transcription Export**: Provides text transcripts of all narration
- 🛠️ **Robust Error Handling**: Comprehensive logging and error management

## Installation

### Prerequisites

- Node.js 20 or newer
- FFmpeg (for video processing)

### Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Configure your API keys in `.env`:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_preferred_voice_id_here
```

## Usage

### Basic Command

```bash
mkdemo create --user <email> --password <password> --url <website-url>
```

### Example

```bash
mkdemo create --user anthony@chovy.com --password mypassword --url https://propozio.com
```

### Command Options

- `--user, -u <email>`: User email for authentication (required)
- `--password, -p <password>`: User password for authentication (required)
- `--url <url>`: Website URL to create demo from (required)
- `--output, -o <directory>`: Output directory for generated files (default: ./output)
- `--verbose, -v`: Enable verbose logging
- `--max-interactions <number>`: Maximum number of interactions (default: 10)
- `--headless`: Run browser in headless mode (default: true)

## Output Files

Upon successful completion, the CLI generates:

- `demo_<timestamp>.mp4` - Main video file
- `transcription_<timestamp>.txt` - Narration transcript
- `mkdemo_<timestamp>.log` - Detailed execution log

## Development

### Project Structure

```
mkdemo/
├── src/
│   ├── cli/           # CLI command handling
│   ├── auth/          # Authentication logic
│   ├── browser/       # Browser automation
│   ├── ai/            # OpenAI integration
│   ├── audio/         # ElevenLabs integration
│   ├── video/         # FFmpeg video processing
│   ├── utils/         # Utilities (logging, filesystem)
│   └── index.js       # Main orchestration
├── test/              # Test files
├── output/            # Generated output files
└── README.md
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run tests in watch mode
pnpm run test:watch
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix

# Format code
pnpm run format

# Check formatting
pnpm run format:check
```

### Development Mode

```bash
# Run with file watching
pnpm run dev
```

## Technical Architecture

### Core Components

1. **CLI Parser** (`src/cli/`): Handles command-line argument parsing and validation
2. **Browser Manager** (`src/browser/`): Puppeteer-based browser automation
3. **Authentication Handler** (`src/auth/`): Automatic login form detection and filling
4. **AI Decision Maker** (`src/ai/`): OpenAI integration for intelligent interactions
5. **Audio Generator** (`src/audio/`): ElevenLabs speech synthesis
6. **Video Processor** (`src/video/`): FFmpeg-based video recording and processing
7. **Utilities** (`src/utils/`): Logging, filesystem operations, and helpers

### Workflow

1. Parse CLI arguments and validate configuration
2. Initialize browser and navigate to target URL
3. Detect and handle authentication if required
4. Capture initial page state for AI analysis
5. Generate interaction plan using OpenAI
6. Execute interactions while recording video
7. Generate narration audio for each interaction
8. Combine video and audio into final MP4
9. Export transcription and logs

## API Requirements

### OpenAI API

- **Model**: GPT-4 Turbo or newer recommended
- **Usage**: Interaction planning and narration generation
- **Rate Limits**: Consider your plan's token limits

### ElevenLabs API

- **Voice**: Choose a professional voice ID
- **Usage**: Speech synthesis for narration
- **Rate Limits**: Consider your plan's character limits

## Troubleshooting

### Common Issues

1. **Browser Launch Fails**
   - Ensure you have sufficient system resources
   - Try running with `--headless=false` for debugging

2. **Authentication Fails**
   - Verify credentials are correct
   - Check if the website has CAPTCHA or 2FA
   - Review logs for specific error messages

3. **Video Processing Fails**
   - Ensure FFmpeg is installed and in PATH
   - Check available disk space
   - Verify output directory permissions

4. **API Errors**
   - Verify API keys are correct and active
   - Check API rate limits and quotas
   - Review network connectivity

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
mkdemo create --verbose --user <email> --password <password> --url <url>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
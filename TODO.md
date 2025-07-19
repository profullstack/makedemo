# mkdemo CLI Tool Development Plan

## Project Overview
Build a CLI tool that automates generating high-quality web demo MP4 videos by intelligently interacting with websites using AI-driven decision making.

## Development Phases

### Phase 1: Project Setup and Foundation
- [x] Create project structure and configuration files
- [ ] Set up package.json with all required dependencies
- [ ] Create environment configuration (.env template)
- [ ] Set up ESLint and Prettier configuration
- [ ] Initialize Git repository and .gitignore

### Phase 2: Core CLI Infrastructure
- [ ] Create CLI command structure and argument parsing
- [ ] Implement configuration management
- [ ] Create logging and error handling system
- [ ] Set up basic project entry points

### Phase 3: Browser Automation
- [ ] Implement authentication module (login handling)
- [ ] Create browser automation module with Puppeteer
- [ ] Add element detection and interaction capabilities
- [ ] Implement screenshot and state capture functionality

### Phase 4: AI Integration
- [ ] Implement OpenAI integration for intelligent decision-making
- [ ] Create prompt engineering for website interaction
- [ ] Add action sequence planning and execution
- [ ] Implement interaction limit management (5-10 actions)

### Phase 5: Audio and Video Processing
- [ ] Create ElevenLabs integration for speech synthesis
- [ ] Implement FFmpeg video recording and processing
- [ ] Add audio-video synchronization
- [ ] Create final video output and file management

### Phase 6: Output and Transcription
- [ ] Add transcription export functionality
- [ ] Implement file naming and organization
- [ ] Create output optimization for web streaming
- [ ] Add metadata and logging to output files

### Phase 7: Testing and Quality Assurance
- [ ] Write comprehensive tests for all modules
- [ ] Create integration tests for end-to-end workflow
- [ ] Add error handling and edge case testing
- [ ] Performance testing and optimization

### Phase 8: Final Integration
- [ ] Test end-to-end workflow with real websites
- [ ] Documentation and usage examples
- [ ] Final code review and cleanup
- [ ] Prepare for deployment

## Technical Requirements

### Dependencies
- **CLI**: commander.js for argument parsing
- **Browser**: puppeteer for automation
- **AI**: openai SDK for GPT-4+ integration
- **Audio**: elevenlabs SDK for speech synthesis
- **Video**: fluent-ffmpeg for video processing
- **Utils**: dotenv, winston (logging), fs-extra

### File Structure
```
mkdemo/
├── src/
│   ├── cli/
│   ├── auth/
│   ├── browser/
│   ├── ai/
│   ├── audio/
│   ├── video/
│   ├── utils/
│   └── index.js
├── test/
├── config/
├── .env.example
├── package.json
└── README.md
```

### Output Files
- `demo_<timestamp>.mp4` - Main video output
- `transcription_<timestamp>.txt` - Narration transcript
- `mkdemo_<timestamp>.log` - Execution log

## Success Criteria
- Successfully generates MP4 demos for interactive websites
- Audio narration matches performed actions
- High-quality, web-ready output (1080p, 30fps)
- Intelligent AI-driven interactions with minimal human intervention
- Robust error handling and logging
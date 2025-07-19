import { expect } from 'chai';
import { VideoProcessor } from '../src/video/processor.js';
import { createLogger } from '../src/utils/logger.js';

describe('Video Processor', () => {
  let videoProcessor;
  let logger;
  let mockPage;

  beforeEach(() => {
    logger = createLogger({ level: 'error', enableFile: false });
    videoProcessor = new VideoProcessor({ logger, outputDir: './test-output' });
    
    // Mock Puppeteer page object
    mockPage = {
      setViewport: async () => {},
      screenshot: async () => Buffer.from('fake-screenshot'),
      evaluate: async () => ({}),
    };
  });

  describe('initialization', () => {
    it('should create video processor with default options', () => {
      const processor = new VideoProcessor({ logger });
      
      expect(processor).to.have.property('logger');
      expect(processor).to.have.property('outputDir');
      expect(processor).to.have.property('fps', 30);
      expect(processor).to.have.property('quality', 'high');
    });

    it('should create video processor with custom options', () => {
      const processor = new VideoProcessor({
        logger,
        outputDir: './custom-output',
        fps: 60,
        quality: 'medium',
        resolution: { width: 1280, height: 720 },
      });
      
      expect(processor.outputDir).to.equal('./custom-output');
      expect(processor.fps).to.equal(60);
      expect(processor.quality).to.equal('medium');
      expect(processor.resolution).to.deep.equal({ width: 1280, height: 720 });
    });
  });

  describe('recording lifecycle', () => {
    it('should start recording successfully', async () => {
      await videoProcessor.startRecording(mockPage);
      
      expect(videoProcessor.isRecording).to.be.true;
      expect(videoProcessor.frames).to.be.an('array');
      expect(videoProcessor.audioSegments).to.be.an('array');
    });

    it('should stop recording successfully', async () => {
      await videoProcessor.startRecording(mockPage);
      await videoProcessor.stopRecording();
      
      expect(videoProcessor.isRecording).to.be.false;
    });

    it('should handle multiple stop calls gracefully', async () => {
      await videoProcessor.startRecording(mockPage);
      await videoProcessor.stopRecording();
      
      // Should not throw
      await videoProcessor.stopRecording();
    });
  });

  describe('frame capture', () => {
    beforeEach(async () => {
      await videoProcessor.startRecording(mockPage);
    });

    afterEach(async () => {
      await videoProcessor.stopRecording();
    });

    it('should capture frames during recording', async () => {
      const initialFrameCount = videoProcessor.frames.length;
      
      await videoProcessor.captureFrame();
      
      expect(videoProcessor.frames.length).to.be.greaterThan(initialFrameCount);
    });

    it('should not capture frames when not recording', async () => {
      await videoProcessor.stopRecording();
      
      const frameCount = videoProcessor.frames.length;
      await videoProcessor.captureFrame();
      
      expect(videoProcessor.frames.length).to.equal(frameCount);
    });
  });

  describe('audio segment management', () => {
    beforeEach(async () => {
      await videoProcessor.startRecording(mockPage);
    });

    afterEach(async () => {
      await videoProcessor.stopRecording();
    });

    it('should add audio segments with timing', async () => {
      const audioBuffer = Buffer.from('fake-audio-data');
      const duration = 3000;
      
      await videoProcessor.addAudioSegment(audioBuffer, duration);
      
      expect(videoProcessor.audioSegments).to.have.length(1);
      expect(videoProcessor.audioSegments[0]).to.have.property('buffer');
      expect(videoProcessor.audioSegments[0]).to.have.property('startTime');
      expect(videoProcessor.audioSegments[0]).to.have.property('duration', duration);
    });

    it('should calculate correct timing for multiple segments', async () => {
      const audioBuffer1 = Buffer.from('audio1');
      const audioBuffer2 = Buffer.from('audio2');
      
      await videoProcessor.addAudioSegment(audioBuffer1, 2000);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      await videoProcessor.addAudioSegment(audioBuffer2, 3000);
      
      expect(videoProcessor.audioSegments).to.have.length(2);
      expect(videoProcessor.audioSegments[1].startTime).to.be.greaterThan(
        videoProcessor.audioSegments[0].startTime
      );
    });
  });

  describe('video finalization', () => {
    it('should finalize video with frames and audio', async () => {
      // Mock FFmpeg operations
      videoProcessor.ffmpeg = {
        input: () => videoProcessor.ffmpeg,
        fps: () => videoProcessor.ffmpeg,
        size: () => videoProcessor.ffmpeg,
        videoCodec: () => videoProcessor.ffmpeg,
        audioCodec: () => videoProcessor.ffmpeg,
        output: () => videoProcessor.ffmpeg,
        on: (event, callback) => {
          if (event === 'end') {
            setTimeout(callback, 10);
          }
          return videoProcessor.ffmpeg;
        },
        run: () => {},
      };

      await videoProcessor.startRecording(mockPage);
      await videoProcessor.captureFrame();
      await videoProcessor.addAudioSegment(Buffer.from('audio'), 2000);
      await videoProcessor.stopRecording();
      
      const outputPath = './test-video.mp4';
      const result = await videoProcessor.finalizeVideo(outputPath);
      
      expect(result).to.equal(outputPath);
    });

    it('should handle finalization without audio', async () => {
      videoProcessor.ffmpeg = {
        input: () => videoProcessor.ffmpeg,
        fps: () => videoProcessor.ffmpeg,
        size: () => videoProcessor.ffmpeg,
        videoCodec: () => videoProcessor.ffmpeg,
        output: () => videoProcessor.ffmpeg,
        on: (event, callback) => {
          if (event === 'end') {
            setTimeout(callback, 10);
          }
          return videoProcessor.ffmpeg;
        },
        run: () => {},
      };

      await videoProcessor.startRecording(mockPage);
      await videoProcessor.captureFrame();
      await videoProcessor.stopRecording();
      
      const outputPath = './test-video-no-audio.mp4';
      const result = await videoProcessor.finalizeVideo(outputPath);
      
      expect(result).to.equal(outputPath);
    });
  });

  describe('frame rate management', () => {
    it('should maintain consistent frame rate', async () => {
      await videoProcessor.startRecording(mockPage);
      
      const startTime = Date.now();
      await videoProcessor.captureFrame();
      await videoProcessor.captureFrame();
      const endTime = Date.now();
      
      const expectedInterval = 1000 / videoProcessor.fps;
      const actualInterval = (endTime - startTime) / 2;
      
      // Allow some tolerance for timing
      expect(actualInterval).to.be.closeTo(expectedInterval, 50);
      
      await videoProcessor.stopRecording();
    });
  });

  describe('quality settings', () => {
    it('should apply correct quality settings for high quality', () => {
      const processor = new VideoProcessor({ logger, quality: 'high' });
      const settings = processor.getQualitySettings();
      
      expect(settings).to.have.property('videoBitrate');
      expect(settings).to.have.property('audioBitrate');
      expect(settings.videoBitrate).to.be.a('string');
    });

    it('should apply correct quality settings for medium quality', () => {
      const processor = new VideoProcessor({ logger, quality: 'medium' });
      const settings = processor.getQualitySettings();
      
      expect(settings).to.have.property('videoBitrate');
      expect(settings).to.have.property('audioBitrate');
    });

    it('should apply correct quality settings for low quality', () => {
      const processor = new VideoProcessor({ logger, quality: 'low' });
      const settings = processor.getQualitySettings();
      
      expect(settings).to.have.property('videoBitrate');
      expect(settings).to.have.property('audioBitrate');
    });
  });

  describe('error handling', () => {
    it('should handle FFmpeg errors gracefully', async () => {
      videoProcessor.ffmpeg = {
        input: () => videoProcessor.ffmpeg,
        fps: () => videoProcessor.ffmpeg,
        size: () => videoProcessor.ffmpeg,
        videoCodec: () => videoProcessor.ffmpeg,
        output: () => videoProcessor.ffmpeg,
        on: (event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('FFmpeg error')), 10);
          }
          return videoProcessor.ffmpeg;
        },
        run: () => {},
      };

      await videoProcessor.startRecording(mockPage);
      await videoProcessor.stopRecording();
      
      try {
        await videoProcessor.finalizeVideo('./test-error.mp4');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video processing failed');
      }
    });
  });
});
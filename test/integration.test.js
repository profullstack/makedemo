import { expect } from 'chai';
import { createDemo } from '../src/index.js';
import { createLogger } from '../src/utils/logger.js';

describe('Integration Tests', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger({ level: 'error', enableFile: false });
  });

  describe('createDemo function', () => {
    it('should be defined and exportable', () => {
      expect(createDemo).to.be.a('function');
    });

    it('should validate required configuration parameters', async () => {
      try {
        await createDemo({});
        expect.fail('Should have thrown an error for missing config');
      } catch (error) {
        expect(error.message).to.include('user');
      }
    });

    it('should validate email format in configuration', async () => {
      try {
        await createDemo({
          user: 'invalid-email',
          password: 'test',
          url: 'https://example.com',
        });
        expect.fail('Should have thrown an error for invalid email');
      } catch (error) {
        expect(error.message).to.include('email');
      }
    });

    it('should validate URL format in configuration', async () => {
      try {
        await createDemo({
          user: 'test@example.com',
          password: 'test',
          url: 'not-a-url',
        });
        expect.fail('Should have thrown an error for invalid URL');
      } catch (error) {
        expect(error.message).to.include('URL');
      }
    });
  });

  describe('Module Integration', () => {
    it('should import all required modules without errors', async () => {
      // Test that all modules can be imported
      const { BrowserManager } = await import('../src/browser/manager.js');
      const { AuthenticationHandler } = await import('../src/auth/handler.js');
      const { AIDecisionMaker } = await import('../src/ai/decision-maker.js');
      const { AudioGenerator } = await import('../src/audio/generator.js');
      const { VideoProcessor } = await import('../src/video/processor.js');

      expect(BrowserManager).to.be.a('function');
      expect(AuthenticationHandler).to.be.a('function');
      expect(AIDecisionMaker).to.be.a('function');
      expect(AudioGenerator).to.be.a('function');
      expect(VideoProcessor).to.be.a('function');
    });

    it('should create instances of all modules', () => {
      const { BrowserManager } = require('../src/browser/manager.js');
      const { AuthenticationHandler } = require('../src/auth/handler.js');
      const { AIDecisionMaker } = require('../src/ai/decision-maker.js');
      const { AudioGenerator } = require('../src/audio/generator.js');
      const { VideoProcessor } = require('../src/video/processor.js');

      const browserManager = new BrowserManager({ logger });
      const authHandler = new AuthenticationHandler({ logger });
      const aiDecisionMaker = new AIDecisionMaker({ logger });
      const audioGenerator = new AudioGenerator({ logger });
      const videoProcessor = new VideoProcessor({ logger });

      expect(browserManager).to.be.instanceOf(BrowserManager);
      expect(authHandler).to.be.instanceOf(AuthenticationHandler);
      expect(aiDecisionMaker).to.be.instanceOf(AIDecisionMaker);
      expect(audioGenerator).to.be.instanceOf(AudioGenerator);
      expect(videoProcessor).to.be.instanceOf(VideoProcessor);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle missing environment variables gracefully', () => {
      // Save original env vars
      const originalOpenAI = process.env.OPENAI_API_KEY;
      const originalElevenLabs = process.env.ELEVENLABS_API_KEY;

      // Remove env vars
      delete process.env.OPENAI_API_KEY;
      delete process.env.ELEVENLABS_API_KEY;

      try {
        // Should not throw during module creation
        const { AIDecisionMaker } = require('../src/ai/decision-maker.js');
        const { AudioGenerator } = require('../src/audio/generator.js');

        const ai = new AIDecisionMaker({ logger });
        const audio = new AudioGenerator({ logger });

        expect(ai).to.be.instanceOf(AIDecisionMaker);
        expect(audio).to.be.instanceOf(AudioGenerator);
      } finally {
        // Restore env vars
        if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
        if (originalElevenLabs) process.env.ELEVENLABS_API_KEY = originalElevenLabs;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock a network error scenario
      const config = {
        user: 'test@example.com',
        password: 'testpass',
        url: 'https://nonexistent-domain-12345.com',
        outputDir: './test-output',
        verbose: false,
        maxInteractions: 1,
        headless: true,
      };

      try {
        await createDemo(config);
        expect.fail('Should have thrown a network error');
      } catch (error) {
        expect(error.message).to.be.a('string');
        // Should be a meaningful error message
        expect(error.message.length).to.be.greaterThan(0);
      }
    });
  });

  describe('File System Operations', () => {
    it('should handle output directory creation', async () => {
      const { ensureOutputDirectory } = await import('../src/utils/filesystem.js');
      
      const testDir = './test-integration-output';
      
      // Should not throw
      await ensureOutputDirectory(testDir);
      
      // Cleanup
      const fs = await import('fs/promises');
      try {
        await fs.rmdir(testDir);
      } catch {
        // Directory might not exist or might not be empty
      }
    });
  });

  describe('Logging System', () => {
    it('should create logger with different configurations', () => {
      const defaultLogger = createLogger();
      const verboseLogger = createLogger({ level: 'debug' });
      const fileLogger = createLogger({ enableFile: true, outputDir: './test-logs' });

      expect(defaultLogger).to.have.property('info');
      expect(verboseLogger).to.have.property('debug');
      expect(fileLogger).to.have.property('error');
    });

    it('should handle logging without errors', () => {
      const testLogger = createLogger({ level: 'debug', enableFile: false });
      
      // Should not throw
      expect(() => testLogger.info('Test info message')).to.not.throw();
      expect(() => testLogger.error('Test error message')).to.not.throw();
      expect(() => testLogger.debug('Test debug message')).to.not.throw();
      expect(() => testLogger.warn('Test warn message')).to.not.throw();
    });
  });
});
import { expect } from 'chai';
import { AudioGenerator } from '../src/audio/generator.js';
import { createLogger } from '../src/utils/logger.js';

describe('Audio Generator', () => {
  let audioGenerator;
  let logger;

  beforeEach(() => {
    logger = createLogger({ level: 'error', enableFile: false });
    audioGenerator = new AudioGenerator({ logger });
  });

  describe('initialization', () => {
    it('should create audio generator with default options', () => {
      const generator = new AudioGenerator({ logger });
      
      expect(generator).to.have.property('logger');
      expect(generator).to.have.property('voiceId');
      expect(generator).to.have.property('model');
    });

    it('should create audio generator with custom options', () => {
      const generator = new AudioGenerator({
        logger,
        voiceId: 'custom-voice-id',
        model: 'eleven_multilingual_v2',
      });
      
      expect(generator.voiceId).to.equal('custom-voice-id');
      expect(generator.model).to.equal('eleven_multilingual_v2');
    });
  });

  describe('generateSpeech', () => {
    it('should generate speech from text', async () => {
      const text = 'Hello, this is a test narration.';
      
      // Mock ElevenLabs API response
      audioGenerator.elevenlabs = {
        generate: async () => Buffer.from('fake-audio-data'),
      };

      const audioBuffer = await audioGenerator.generateSpeech(text);
      
      expect(audioBuffer).to.be.instanceOf(Buffer);
      expect(audioBuffer.length).to.be.greaterThan(0);
    });

    it('should handle empty text input', async () => {
      try {
        await audioGenerator.generateSpeech('');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Text is required');
      }
    });

    it('should handle API errors gracefully', async () => {
      audioGenerator.elevenlabs = {
        generate: async () => {
          throw new Error('API Error');
        },
      };

      try {
        await audioGenerator.generateSpeech('Test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate speech');
      }
    });

    it('should respect voice settings', async () => {
      let capturedOptions;
      
      audioGenerator.elevenlabs = {
        generate: async (options) => {
          capturedOptions = options;
          return Buffer.from('fake-audio-data');
        },
      };

      await audioGenerator.generateSpeech('Test text', {
        stability: 0.8,
        similarityBoost: 0.7,
      });
      
      expect(capturedOptions).to.have.property('voice_settings');
      expect(capturedOptions.voice_settings.stability).to.equal(0.8);
      expect(capturedOptions.voice_settings.similarity_boost).to.equal(0.7);
    });
  });

  describe('validateText', () => {
    it('should validate correct text input', () => {
      const text = 'This is a valid narration text.';
      
      const isValid = audioGenerator.validateText(text);
      
      expect(isValid).to.be.true;
    });

    it('should reject empty or whitespace-only text', () => {
      expect(audioGenerator.validateText('')).to.be.false;
      expect(audioGenerator.validateText('   ')).to.be.false;
      expect(audioGenerator.validateText('\n\t')).to.be.false;
    });

    it('should reject text that is too long', () => {
      const longText = 'a'.repeat(6000); // Assuming 5000 char limit
      
      const isValid = audioGenerator.validateText(longText);
      
      expect(isValid).to.be.false;
    });

    it('should accept text within character limits', () => {
      const normalText = 'a'.repeat(1000);
      
      const isValid = audioGenerator.validateText(normalText);
      
      expect(isValid).to.be.true;
    });
  });

  describe('optimizeTextForSpeech', () => {
    it('should clean up text for better speech synthesis', () => {
      const rawText = 'Click the "Submit" button & wait for response...';
      
      const optimized = audioGenerator.optimizeTextForSpeech(rawText);
      
      expect(optimized).to.not.include('"');
      expect(optimized).to.not.include('&');
      expect(optimized).to.not.include('...');
    });

    it('should handle URLs in text', () => {
      const textWithUrl = 'Navigate to https://example.com for more info.';
      
      const optimized = audioGenerator.optimizeTextForSpeech(textWithUrl);
      
      expect(optimized).to.include('example dot com');
    });

    it('should handle special characters', () => {
      const textWithSpecialChars = 'Price: $29.99 (50% off!)';
      
      const optimized = audioGenerator.optimizeTextForSpeech(textWithSpecialChars);
      
      expect(optimized).to.include('dollars');
      expect(optimized).to.include('percent');
    });
  });

  describe('estimateAudioDuration', () => {
    it('should estimate duration based on text length', () => {
      const shortText = 'Hello world.';
      const longText = 'This is a much longer piece of text that should take more time to speak aloud.';
      
      const shortDuration = audioGenerator.estimateAudioDuration(shortText);
      const longDuration = audioGenerator.estimateAudioDuration(longText);
      
      expect(shortDuration).to.be.a('number');
      expect(longDuration).to.be.a('number');
      expect(longDuration).to.be.greaterThan(shortDuration);
    });

    it('should return reasonable duration estimates', () => {
      const text = 'This is a test sentence for duration estimation.';
      
      const duration = audioGenerator.estimateAudioDuration(text);
      
      // Should be between 2-10 seconds for this length
      expect(duration).to.be.greaterThan(2000);
      expect(duration).to.be.lessThan(10000);
    });
  });

  describe('saveAudioToFile', () => {
    it('should save audio buffer to file', async () => {
      const audioBuffer = Buffer.from('fake-audio-data');
      const filePath = './test-audio.mp3';
      
      // Mock fs operations
      const mockFs = {
        writeFile: async (path, data) => {
          expect(path).to.equal(filePath);
          expect(data).to.equal(audioBuffer);
        },
      };
      
      audioGenerator.fs = mockFs;
      
      await audioGenerator.saveAudioToFile(audioBuffer, filePath);
      
      // Test passes if no error is thrown
      expect(true).to.be.true;
    });
  });
});
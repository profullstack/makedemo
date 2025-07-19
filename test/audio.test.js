import { expect } from 'chai';
import { 
  generateSpeech, 
  getAvailableVoices, 
  estimateAudioDuration,
  VOICES,
  getRandomVoice,
  getMaleVoices,
  getFemaleVoices,
  CONVERSATIONAL_VOICE_SETTINGS,
  DEFAULT_VOICE_SETTINGS
} from '../src/audio/generator.js';
import fs from 'fs/promises';
import path from 'path';

describe('Audio Generator', () => {
  const testOutputDir = './test-output';
  const testAudioPath = path.join(testOutputDir, 'test-audio.mp3');

  beforeEach(async () => {
    // Ensure test output directory exists
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(testAudioPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('Voice Management', () => {
    it('should have predefined voices', () => {
      expect(VOICES).to.be.an('object');
      expect(Object.keys(VOICES)).to.have.length.greaterThan(0);
      
      // Check that we have both male and female voices
      expect(VOICES).to.have.property('rachel');
      expect(VOICES).to.have.property('adam');
    });

    it('should get male voices', () => {
      const maleVoices = getMaleVoices();
      
      expect(maleVoices).to.be.an('object');
      expect(maleVoices).to.have.property('antoni');
      expect(maleVoices).to.have.property('adam');
      expect(maleVoices).to.not.have.property('rachel');
    });

    it('should get female voices', () => {
      const femaleVoices = getFemaleVoices();
      
      expect(femaleVoices).to.be.an('object');
      expect(femaleVoices).to.have.property('rachel');
      expect(femaleVoices).to.have.property('bella');
      expect(femaleVoices).to.not.have.property('adam');
    });

    it('should get random voice', () => {
      const randomVoice = getRandomVoice();
      
      expect(randomVoice).to.be.a('string');
      expect(Object.values(VOICES)).to.include(randomVoice);
    });

    it('should get random male voice', () => {
      const maleVoice = getRandomVoice('male');
      const maleVoices = getMaleVoices();
      
      expect(maleVoice).to.be.a('string');
      expect(Object.values(maleVoices)).to.include(maleVoice);
    });

    it('should get random female voice', () => {
      const femaleVoice = getRandomVoice('female');
      const femaleVoices = getFemaleVoices();
      
      expect(femaleVoice).to.be.a('string');
      expect(Object.values(femaleVoices)).to.include(femaleVoice);
    });
  });

  describe('Voice Settings', () => {
    it('should have default voice settings', () => {
      expect(DEFAULT_VOICE_SETTINGS).to.be.an('object');
      expect(DEFAULT_VOICE_SETTINGS).to.have.property('stability');
      expect(DEFAULT_VOICE_SETTINGS).to.have.property('similarity_boost');
      expect(DEFAULT_VOICE_SETTINGS).to.have.property('style');
      expect(DEFAULT_VOICE_SETTINGS).to.have.property('use_speaker_boost');
    });

    it('should have conversational voice settings', () => {
      expect(CONVERSATIONAL_VOICE_SETTINGS).to.be.an('object');
      expect(CONVERSATIONAL_VOICE_SETTINGS).to.have.property('stability');
      expect(CONVERSATIONAL_VOICE_SETTINGS).to.have.property('similarity_boost');
      expect(CONVERSATIONAL_VOICE_SETTINGS).to.have.property('style');
      expect(CONVERSATIONAL_VOICE_SETTINGS).to.have.property('use_speaker_boost');
    });
  });

  describe('generateSpeech', () => {
    it('should generate speech from text (mock mode)', async () => {
      const text = 'Hello, this is a test narration for our demo video.';
      
      // This will use mock implementation since no API key is set
      const outputPath = await generateSpeech(text, testAudioPath);
      
      expect(outputPath).to.equal(testAudioPath);
      
      // Verify file was created
      const stats = await fs.stat(testAudioPath);
      expect(stats.size).to.be.greaterThan(0);
    });

    it('should handle empty text input', async () => {
      try {
        await generateSpeech('', testAudioPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Text is required');
      }
    });

    it('should handle null text input', async () => {
      try {
        await generateSpeech(null, testAudioPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Text is required');
      }
    });

    it('should handle whitespace-only text', async () => {
      try {
        await generateSpeech('   \n\t   ', testAudioPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Text is required');
      }
    });

    it('should accept custom voice options', async () => {
      const text = 'Testing custom voice options.';
      const options = {
        voice: VOICES.rachel,
        gender: 'female',
        voiceSettings: {
          stability: 0.8,
          similarity_boost: 0.9,
          style: 0.1,
          use_speaker_boost: true
        }
      };
      
      const outputPath = await generateSpeech(text, testAudioPath, options);
      
      expect(outputPath).to.equal(testAudioPath);
      
      // Verify file was created
      const stats = await fs.stat(testAudioPath);
      expect(stats.size).to.be.greaterThan(0);
    });

    it('should validate gender parameter', async () => {
      const text = 'Testing invalid gender parameter.';
      const options = { gender: 'invalid' };
      
      try {
        await generateSpeech(text, testAudioPath, options);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Gender must be');
      }
    });

    it('should create output directory if it does not exist', async () => {
      const nestedPath = path.join(testOutputDir, 'nested', 'deep', 'audio.mp3');
      const text = 'Testing directory creation.';
      
      const outputPath = await generateSpeech(text, nestedPath);
      
      expect(outputPath).to.equal(nestedPath);
      
      // Verify file was created in nested directory
      const stats = await fs.stat(nestedPath);
      expect(stats.size).to.be.greaterThan(0);
      
      // Clean up nested directory
      await fs.rm(path.join(testOutputDir, 'nested'), { recursive: true, force: true });
    });
  });

  describe('getAvailableVoices', () => {
    it('should return predefined voices when no API key', async () => {
      // This will return predefined voices since no API key is set
      const voices = await getAvailableVoices();
      
      expect(voices).to.be.an('array');
      expect(voices.length).to.be.greaterThan(0);
      
      // Check structure of returned voices
      const voice = voices[0];
      expect(voice).to.have.property('voice_id');
      expect(voice).to.have.property('name');
      expect(voice).to.have.property('category');
    });

    it('should include both male and female voices', async () => {
      const voices = await getAvailableVoices();
      
      const maleVoices = voices.filter(v => v.category === 'Male');
      const femaleVoices = voices.filter(v => v.category === 'Female');
      
      expect(maleVoices.length).to.be.greaterThan(0);
      expect(femaleVoices.length).to.be.greaterThan(0);
    });
  });

  describe('estimateAudioDuration', () => {
    it('should estimate duration based on text length', () => {
      const shortText = 'Hello world.';
      const longText = 'This is a much longer piece of text that should take significantly more time to speak aloud when converted to speech audio.';
      
      const shortDuration = estimateAudioDuration(shortText);
      const longDuration = estimateAudioDuration(longText);
      
      expect(shortDuration).to.be.a('number');
      expect(longDuration).to.be.a('number');
      expect(longDuration).to.be.greaterThan(shortDuration);
    });

    it('should return reasonable duration estimates', () => {
      const text = 'This is a test sentence for duration estimation that contains a reasonable amount of words.';
      
      const duration = estimateAudioDuration(text);
      
      // Should be between 3-15 seconds for this length (155 words per minute average)
      expect(duration).to.be.greaterThan(3);
      expect(duration).to.be.lessThan(15);
    });

    it('should handle empty text', () => {
      expect(estimateAudioDuration('')).to.equal(0);
      expect(estimateAudioDuration(null)).to.equal(0);
      expect(estimateAudioDuration(undefined)).to.equal(0);
    });

    it('should handle non-string input', () => {
      expect(estimateAudioDuration(123)).to.equal(0);
      expect(estimateAudioDuration({})).to.equal(0);
      expect(estimateAudioDuration([])).to.equal(0);
    });
  });

  describe('Text Processing', () => {
    it('should handle long text by truncating appropriately', async () => {
      // Create text longer than 4500 characters
      const longText = 'This is a very long text. '.repeat(200);
      
      const outputPath = await generateSpeech(longText, testAudioPath);
      
      expect(outputPath).to.equal(testAudioPath);
      
      // Verify file was created (text should be truncated internally)
      const stats = await fs.stat(testAudioPath);
      expect(stats.size).to.be.greaterThan(0);
    });

    it('should handle text with special characters', async () => {
      const textWithSpecialChars = 'Navigate to https://example.com & click "Submit" button! Price: $29.99 (50% off)';
      
      const outputPath = await generateSpeech(textWithSpecialChars, testAudioPath);
      
      expect(outputPath).to.equal(testAudioPath);
      
      // Verify file was created
      const stats = await fs.stat(testAudioPath);
      expect(stats.size).to.be.greaterThan(0);
    });

    it('should enhance text for natural speech', async () => {
      const text = 'Welcome to our demo! This is amazing. Overall, this is excellent.';
      
      const outputPath = await generateSpeech(text, testAudioPath);
      
      expect(outputPath).to.equal(testAudioPath);
      
      // Verify file was created (text enhancement happens internally)
      const stats = await fs.stat(testAudioPath);
      expect(stats.size).to.be.greaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist/audio.mp3';
      const text = 'Testing file system error handling.';
      
      try {
        await generateSpeech(text, invalidPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate speech');
      }
    });
  });
});
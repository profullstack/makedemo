import { ElevenLabsAPI } from 'elevenlabs';
import fs from 'fs/promises';

/**
 * Audio generator using ElevenLabs API for speech synthesis
 */
export class AudioGenerator {
  constructor(options = {}) {
    this.logger = options.logger;
    this.voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB'; // Default voice
    this.model = options.model ?? 'eleven_monolingual_v1';
    this.maxCharacters = options.maxCharacters ?? 5000;
    this.wordsPerMinute = options.wordsPerMinute ?? 150; // Average speaking rate
    
    // Initialize ElevenLabs client
    this.elevenlabs = new ElevenLabsAPI({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    // For testing purposes
    this.fs = fs;
  }

  /**
   * Generate speech audio from text
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Voice settings options
   * @param {number} options.stability - Voice stability (0-1)
   * @param {number} options.similarityBoost - Similarity boost (0-1)
   * @param {number} options.style - Style setting (0-1)
   * @returns {Promise<Buffer>} Audio buffer
   */
  async generateSpeech(text, options = {}) {
    if (!this.validateText(text)) {
      throw new Error('Text is required and must be within character limits');
    }

    this.logger?.info('Generating speech audio', {
      textLength: text.length,
      voiceId: this.voiceId,
    });

    try {
      // Optimize text for speech synthesis
      const optimizedText = this.optimizeTextForSpeech(text);
      
      // Prepare voice settings
      const voiceSettings = {
        stability: options.stability ?? 0.75,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.0,
        use_speaker_boost: true,
      };

      // Generate audio using ElevenLabs
      const audioBuffer = await this.elevenlabs.generate({
        voice: this.voiceId,
        text: optimizedText,
        model_id: this.model,
        voice_settings: voiceSettings,
      });

      this.logger?.info('Speech generation completed', {
        audioSize: audioBuffer.length,
        estimatedDuration: this.estimateAudioDuration(text),
      });

      return audioBuffer;
    } catch (error) {
      this.logger?.error('Speech generation failed', {
        error: error.message,
        textLength: text.length,
      });
      throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }

  /**
   * Validate text input for speech generation
   * @param {string} text - Text to validate
   * @returns {boolean} True if valid
   */
  validateText(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    // Check if text is not just whitespace
    if (text.trim().length === 0) {
      return false;
    }

    // Check character limit
    if (text.length > this.maxCharacters) {
      return false;
    }

    return true;
  }

  /**
   * Optimize text for better speech synthesis
   * @param {string} text - Raw text
   * @returns {string} Optimized text
   */
  optimizeTextForSpeech(text) {
    let optimized = text;

    // Replace common symbols and abbreviations
    const replacements = {
      // URLs
      'https://': 'https ',
      'http://': 'http ',
      '.com': ' dot com',
      '.org': ' dot org',
      '.net': ' dot net',
      
      // Currency
      '$': 'dollars ',
      '€': 'euros ',
      '£': 'pounds ',
      
      // Percentages
      '%': ' percent',
      
      // Common symbols
      '&': ' and ',
      '@': ' at ',
      '#': ' hash ',
      
      // Quotation marks (can cause issues)
      '"': '',
      "'": '',
      
      // Multiple dots
      '...': ' pause ',
      '..': ' pause ',
      
      // Brackets and parentheses (simplify)
      '(': ' ',
      ')': ' ',
      '[': ' ',
      ']': ' ',
      '{': ' ',
      '}': ' ',
      
      // Excessive punctuation
      '!!': '!',
      '??': '?',
      
      // Common abbreviations
      ' vs ': ' versus ',
      ' etc.': ' etcetera',
      ' e.g.': ' for example',
      ' i.e.': ' that is',
    };

    // Apply replacements
    for (const [search, replace] of Object.entries(replacements)) {
      optimized = optimized.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replace);
    }

    // Clean up multiple spaces
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Ensure proper sentence endings for natural pauses
    optimized = optimized.replace(/([.!?])\s*([A-Z])/g, '$1 $2');

    return optimized;
  }

  /**
   * Estimate audio duration based on text length
   * @param {string} text - Text to analyze
   * @returns {number} Estimated duration in milliseconds
   */
  estimateAudioDuration(text) {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    // Count words (rough estimation)
    const wordCount = text.trim().split(/\s+/).length;
    
    // Calculate duration based on average speaking rate
    const durationMinutes = wordCount / this.wordsPerMinute;
    const durationMs = durationMinutes * 60 * 1000;
    
    // Add buffer time for pauses and natural speech patterns
    const bufferTime = durationMs * 0.2; // 20% buffer
    
    return Math.round(durationMs + bufferTime);
  }

  /**
   * Save audio buffer to file
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} filePath - Output file path
   */
  async saveAudioToFile(audioBuffer, filePath) {
    try {
      await this.fs.writeFile(filePath, audioBuffer);
      
      this.logger?.info('Audio saved to file', {
        filePath,
        size: audioBuffer.length,
      });
    } catch (error) {
      this.logger?.error('Failed to save audio file', {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to save audio file: ${error.message}`);
    }
  }

  /**
   * Generate speech and save to file
   * @param {string} text - Text to convert
   * @param {string} outputPath - Output file path
   * @param {Object} options - Voice settings
   * @returns {Promise<string>} Path to saved file
   */
  async generateAndSave(text, outputPath, options = {}) {
    const audioBuffer = await this.generateSpeech(text, options);
    await this.saveAudioToFile(audioBuffer, outputPath);
    return outputPath;
  }

  /**
   * Get available voices from ElevenLabs
   * @returns {Promise<Array>} List of available voices
   */
  async getAvailableVoices() {
    try {
      const voices = await this.elevenlabs.voices.getAll();
      
      this.logger?.debug('Retrieved available voices', {
        count: voices.voices?.length || 0,
      });
      
      return voices.voices || [];
    } catch (error) {
      this.logger?.error('Failed to get available voices', {
        error: error.message,
      });
      throw new Error(`Failed to get available voices: ${error.message}`);
    }
  }

  /**
   * Get voice information by ID
   * @param {string} voiceId - Voice ID to lookup
   * @returns {Promise<Object>} Voice information
   */
  async getVoiceInfo(voiceId = this.voiceId) {
    try {
      const voice = await this.elevenlabs.voices.get(voiceId);
      
      this.logger?.debug('Retrieved voice information', {
        voiceId,
        name: voice.name,
      });
      
      return voice;
    } catch (error) {
      this.logger?.error('Failed to get voice information', {
        voiceId,
        error: error.message,
      });
      throw new Error(`Failed to get voice information: ${error.message}`);
    }
  }

  /**
   * Test voice with sample text
   * @param {string} voiceId - Voice ID to test
   * @param {string} sampleText - Text to test with
   * @returns {Promise<Buffer>} Test audio buffer
   */
  async testVoice(voiceId, sampleText = 'Hello, this is a test of the voice synthesis.') {
    const originalVoiceId = this.voiceId;
    
    try {
      this.voiceId = voiceId;
      const audioBuffer = await this.generateSpeech(sampleText);
      
      this.logger?.info('Voice test completed', {
        voiceId,
        sampleLength: sampleText.length,
      });
      
      return audioBuffer;
    } finally {
      this.voiceId = originalVoiceId;
    }
  }
}
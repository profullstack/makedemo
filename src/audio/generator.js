import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Audio Generator Module
 * Handles speech synthesis using ElevenLabs API
 * Based on proven implementation from amazon-affiliate project
 */

/**
 * Recommended ElevenLabs Voices for Demo Videos
 * 
 * This collection includes high-quality voices optimized for demo narration.
 * The system can select voices based on preference or randomly for variety.
 */
const VOICES = {
  // Male Voices
  antoni: 'ErXwobaYiN019PkySvjV',   // Antoni: Professional, Clear
  adam: 'pNInz6obpgDQGcFmaJgB',     // Adam: Authoritative, Deep
  sam: 'yoZ06aMxZJJ28mfd3POQ',      // Sam: Friendly, Conversational
  jake: 'onwK4e9ZLuTAKqWW03F9',     // Jake: Upbeat, Dynamic
  drew: '29vD33N1CtxCmqQRPOHJ',     // Drew: Warm, Confident

  // Female Voices
  rachel: '21m00Tcm4TlvDq8ikWAM',   // Rachel: Clear, Professional, Trustworthy
  bella: 'EXAVITQu4vr4xnSDxMaL',    // Bella: Warm, Friendly, Engaging
  elli: 'MF3mGyEYCl7XYWbV9V6O',     // Elli: Bright, Energetic, Youthful
  grace: 'oWAxZDx7w5VEj9dCyTzz',    // Grace: Calm, Sophisticated, Clear
  charlotte: 'XB0fDUnXU5powFXDhCwa' // Charlotte: Smooth, Authoritative
};

/**
 * Gets male voices from the VOICES object
 * @returns {Object} - Object containing male voices
 */
const getMaleVoices = () => {
  return {
    antoni: VOICES.antoni,
    adam: VOICES.adam,
    sam: VOICES.sam,
    jake: VOICES.jake,
    drew: VOICES.drew
  };
};

/**
 * Gets female voices from the VOICES object
 * @returns {Object} - Object containing female voices
 */
const getFemaleVoices = () => {
  return {
    rachel: VOICES.rachel,
    bella: VOICES.bella,
    elli: VOICES.elli,
    grace: VOICES.grace,
    charlotte: VOICES.charlotte
  };
};

/**
 * Randomly selects a voice from the available voices array
 * @param {string} gender - Optional gender preference ('male', 'female', or undefined for random)
 * @returns {string} - Voice ID for ElevenLabs API
 */
const getRandomVoice = (gender = null) => {
  let availableVoices;
  
  if (gender === 'male') {
    availableVoices = getMaleVoices();
    logger.info('🎤 Using male voice selection');
  } else if (gender === 'female') {
    availableVoices = getFemaleVoices();
    logger.info('🎤 Using female voice selection');
  } else {
    availableVoices = VOICES;
    logger.info('🎤 Using random voice selection');
  }
  
  const voiceNames = Object.keys(availableVoices);
  const randomIndex = Math.floor(Math.random() * voiceNames.length);
  const selectedVoiceName = voiceNames[randomIndex];
  const selectedVoiceId = availableVoices[selectedVoiceName];
  
  logger.info(`🎤 Selected voice: ${selectedVoiceName} (${selectedVoiceId})`);
  return selectedVoiceId;
};

/**
 * Default voice settings for Eleven Labs API
 */
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,        // Lower stability for more natural variation
  similarity_boost: 0.8, // Higher similarity for consistency
  style: 0.2,            // Add some style for expressiveness
  use_speaker_boost: true
};

/**
 * Conversational voice settings for demo-style content
 * Optimized for stable, natural speech without speed variations
 */
const CONVERSATIONAL_VOICE_SETTINGS = {
  stability: 0.6,        // Higher stability to prevent speed variations
  similarity_boost: 0.85, // High similarity for consistency
  style: 0.2,            // Lower style to reduce artificial effects
  use_speaker_boost: true
};

/**
 * Enhances text for more natural speech by adding pauses and emphasis
 * @param {string} text - Text to enhance
 * @returns {string} - Enhanced text with natural speech patterns
 */
const enhanceTextForSpeech = text => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let enhanced = text;

  // Add natural pauses after introductory phrases
  enhanced = enhanced.replace(/(Welcome|Hello|Hi there|Let's|Now)[!.]?\s*/gi, '$1! ');
  
  // Add emphasis to important phrases
  enhanced = enhanced.replace(/\b(amazing|incredible|fantastic|excellent|outstanding|important|key|essential)\b/gi, '*$1*');
  
  // Add pauses before conclusions
  enhanced = enhanced.replace(/\b(Overall|In conclusion|To sum up|Finally|Next)\b/gi, '... $1');
  
  // Add natural breathing pauses after long sentences
  enhanced = enhanced.replace(/([.!?])\s+([A-Z])/g, '$1 ... $2');
  
  // Add pauses around technical terms or URLs
  enhanced = enhanced.replace(/\b(https?:\/\/[^\s]+)\b/g, '... $1 ...');

  return enhanced;
};

/**
 * Preprocesses text for voiceover generation
 * @param {string} text - Raw text to preprocess
 * @returns {string} - Cleaned and processed text
 */
const preprocessText = text => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove excessive whitespace and normalize
  let cleanText = text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Remove special characters that might cause issues
  cleanText = cleanText.replace(/[^\w\s.,!?;:()\-'"]/g, '');

  // Ensure English-only content by removing non-ASCII characters
  cleanText = cleanText.replace(/[^\x00-\x7F]/g, '');

  // Clean up any double spaces created by removals
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  // Truncate if too long (Eleven Labs has character limits)
  const maxLength = 4500;
  if (cleanText.length > maxLength) {
    // Try to truncate at sentence boundary
    const truncated = cleanText.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.8) {
      cleanText = truncated.substring(0, lastSentence + 1);
    } else {
      cleanText = truncated + '...';
    }
  }

  return cleanText;
};

/**
 * Validates environment variables for Eleven Labs API
 * @throws {Error} When required environment variables are missing
 */
const validateEnvironment = () => {
  const { ELEVENLABS_API_KEY } = process.env;

  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required in environment variables');
  }

  return { ELEVENLABS_API_KEY };
};

/**
 * Makes API request to Eleven Labs with retry logic
 * @param {string} text - Text to convert to speech
 * @param {string} apiKey - Eleven Labs API key
 * @param {string} voiceId - Voice ID to use
 * @param {Object} voiceSettings - Voice configuration settings
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<ArrayBuffer>} - Audio data
 */
const makeApiRequest = async (text, apiKey, voiceId, voiceSettings, retries = 3) => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  const requestBody = {
    text,
    voice_settings: voiceSettings,
    model_id: 'eleven_monolingual_v1',  // English-only model
    output_format: 'mp3_44100_128'      // Fixed format for consistent audio
  };

  const requestOptions = {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Eleven Labs API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      logger.warn(`API request attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt === retries - 1) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};

/**
 * Mock implementation for testing without API key
 */
const mockGenerateAudio = async (text, outputPath) => {
  logger.info('Using mock audio generation (no ElevenLabs API key)');
  
  // Create a minimal MP3 file for testing
  const mockAudioData = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, // MP3 header
    ...Array(1000).fill(0x00) // Minimal audio data
  ]);
  
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, mockAudioData);
  
  logger.info(`Mock audio file created: ${outputPath}`);
  return outputPath;
};

/**
 * Generate speech audio from text using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @param {string} outputPath - Path to save the audio file
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Path to generated audio file
 */
export const generateSpeech = async (text, outputPath, options = {}) => {
  try {
    const {
      voice = null,
      gender = null,
      voiceSettings = CONVERSATIONAL_VOICE_SETTINGS
    } = options;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Text is required and must be a non-empty string');
    }

    // Validate gender parameter
    if (gender && !['male', 'female'].includes(gender)) {
      throw new Error('Gender must be "male", "female", or null');
    }

    logger.info(`Generating speech for ${text.length} characters`);

    // Check if API key is available
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      logger.warn('ELEVENLABS_API_KEY not found, using mock implementation');
      return await mockGenerateAudio(text, outputPath);
    }

    try {
      // Get voice ID based on preference or random selection
      const voiceId = voice || getRandomVoice(gender);
      
      // Enhance text for natural speech, then preprocess
      const enhancedText = enhanceTextForSpeech(text);
      const processedText = preprocessText(enhancedText);
      
      if (processedText.length === 0) {
        throw new Error('Text becomes empty after preprocessing');
      }

      logger.info(`Processing ${processedText.length} characters of enhanced text`);

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Make API request
      const audioBuffer = await makeApiRequest(
        processedText,
        apiKey,
        voiceId,
        voiceSettings
      );

      // Save audio file
      await fs.writeFile(outputPath, Buffer.from(audioBuffer));

      // Verify file was created and has content
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Generated voiceover file is empty');
      }

      logger.info(`Speech generated successfully: ${outputPath} (${stats.size} bytes)`);
      return outputPath;

    } catch (apiError) {
      logger.error(`ElevenLabs API error: ${apiError.message}`);
      logger.info('Falling back to mock audio generation');
      return await mockGenerateAudio(text, outputPath);
    }

  } catch (error) {
    logger.error(`Speech generation failed: ${error.message}`);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
};

/**
 * Get available voices from ElevenLabs
 * @returns {Promise<Array>} List of available voices
 */
export const getAvailableVoices = async () => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      logger.warn('ELEVENLABS_API_KEY not found, returning predefined voices');
      return Object.entries(VOICES).map(([name, id]) => ({
        voice_id: id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        category: getMaleVoices()[name] ? 'Male' : 'Female'
      }));
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    logger.error(`Failed to fetch voices: ${error.message}`);
    // Return predefined voices as fallback
    return Object.entries(VOICES).map(([name, id]) => ({
      voice_id: id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      category: getMaleVoices()[name] ? 'Male' : 'Female'
    }));
  }
};

/**
 * Estimate audio duration based on text length
 * @param {string} text - Text to analyze
 * @returns {number} Estimated duration in seconds
 */
export const estimateAudioDuration = (text) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const processedText = preprocessText(text);
  const wordCount = processedText.split(/\s+/).length;
  
  // Average speaking rate is about 150-160 words per minute
  const wordsPerMinute = 155;
  const durationMinutes = wordCount / wordsPerMinute;
  
  return Math.ceil(durationMinutes * 60); // Return seconds
};

// Export voice settings and voices for external use
export {
  DEFAULT_VOICE_SETTINGS,
  CONVERSATIONAL_VOICE_SETTINGS,
  VOICES,
  getRandomVoice,
  getMaleVoices,
  getFemaleVoices
};
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.js';
import { ensureOutputDirectory } from './utils/filesystem.js';
import { BrowserManager } from './browser/manager.js';
import { AuthenticationHandler } from './auth/handler.js';
import { AIDecisionMaker } from './ai/decision-maker.js';
import { generateSpeech, estimateAudioDuration } from './audio/generator.js';
import { VideoProcessor } from './video/processor.js';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Main function to create a demo video
 * @param {Object} config - Configuration object
 * @param {string} config.user - User email for authentication
 * @param {string} config.password - User password for authentication
 * @param {string} config.url - Website URL to create demo from
 * @param {string} config.outputDir - Output directory for generated files
 * @param {boolean} config.verbose - Enable verbose logging
 * @param {number} config.maxInteractions - Maximum number of interactions
 * @param {boolean} config.headless - Run browser in headless mode
 * @returns {Promise<Object>} Result object with file paths
 */
export async function createDemo(config) {
  const {
    user,
    password,
    url,
    outputDir = './output',
    verbose = false,
    maxInteractions = 10,
    headless = true,
  } = config;

  // Initialize logger
  const logger = createLogger({
    level: verbose ? 'debug' : 'info',
    outputDir,
  });

  logger.info('Starting mkdemo video creation', {
    url,
    user,
    maxInteractions,
    headless,
  });

  try {
    // Ensure output directory exists
    await ensureOutputDirectory(outputDir);

    // Initialize components
    const browserManager = new BrowserManager({ headless, logger });
    const authHandler = new AuthenticationHandler({ logger });
    const aiDecisionMaker = new AIDecisionMaker({ logger, maxInteractions });
    // Audio generation will use the function-based API
    const videoProcessor = new VideoProcessor({ logger, outputDir });

    // Generate timestamp for file naming
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFiles = {
      video: path.join(outputDir, `demo_${timestamp}.mp4`),
      transcript: path.join(outputDir, `transcription_${timestamp}.txt`),
      log: path.join(outputDir, `mkdemo_${timestamp}.log`),
    };

    logger.info('Initializing browser session');
    await browserManager.initialize();

    logger.info('Navigating to target URL', { url });
    await browserManager.navigateTo(url);

    logger.info('Attempting authentication', { user });
    const authSuccess = await authHandler.authenticate(
      browserManager.getPage(),
      { user, password }
    );

    if (!authSuccess) {
      throw new Error('Authentication failed');
    }

    logger.info('Authentication successful, starting AI-driven interactions');
    
    // Start video recording
    await videoProcessor.startRecording(browserManager.getPage());

    // Get initial page state and begin AI decision making
    const interactions = await aiDecisionMaker.planInteractions(
      browserManager.getPage()
    );

    const transcriptSegments = [];
    
    // Select a consistent voice for the entire video
    const { getRandomVoice } = await import('./audio/generator.js');
    const selectedVoice = getRandomVoice(); // Pick one voice for the entire demo
    logger.info('Selected consistent voice for entire demo', { voiceId: selectedVoice });

    // Execute planned interactions
    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      
      logger.info(`Executing interaction ${i + 1}/${interactions.length}`, {
        type: interaction.type,
        description: interaction.description,
      });

      // Generate narration for this interaction
      const narrationText = await aiDecisionMaker.generateNarration(interaction);
      transcriptSegments.push(narrationText);

      // Generate audio for narration using the consistent voice
      const tempAudioPath = path.join(outputDir, `temp_audio_${i}.mp3`);
      const audioPath = await generateSpeech(narrationText, tempAudioPath, {
        voice: selectedVoice // Use the same voice throughout
      });
      
      // Execute the interaction
      await browserManager.executeInteraction(interaction);
      
      // Add the audio to video timeline
      const estimatedDuration = estimateAudioDuration(narrationText);
      await videoProcessor.addAudioSegment(audioPath, estimatedDuration);
      
      // Wait for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('All interactions completed, finalizing video');

    // Stop recording first (this stops frame capture)
    await videoProcessor.stopRecording();
    
    // Now it's safe to close the browser since we're no longer capturing frames
    await browserManager.close();
    
    // Process final video (this doesn't need the browser anymore)
    const finalVideoPath = await videoProcessor.finalizeVideo(outputFiles.video);

    // Save transcript
    await saveTranscript(outputFiles.transcript, transcriptSegments);

    logger.info('Demo creation completed successfully', {
      videoPath: finalVideoPath,
      transcriptPath: outputFiles.transcript,
      logPath: outputFiles.log,
    });

    return {
      videoPath: finalVideoPath,
      transcriptPath: outputFiles.transcript,
      logPath: outputFiles.log,
    };

  } catch (error) {
    logger.error('Demo creation failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Save transcript to file
 * @param {string} filePath - Path to save transcript
 * @param {string[]} segments - Transcript segments
 */
async function saveTranscript(filePath, segments) {
  const fs = await import('fs/promises');
  
  // Create both plain text and SRT format
  const plainText = segments.join('\n\n');
  
  // Generate SRT format with timestamps
  const srtContent = segments.map((segment, index) => {
    const startTime = formatSRTTime(index * 3000); // Assume 3 seconds per segment
    const endTime = formatSRTTime((index + 1) * 3000);
    
    return `${index + 1}\n${startTime} --> ${endTime}\n${segment}\n`;
  }).join('\n');
  
  // Save plain text transcript
  await fs.writeFile(filePath, plainText, 'utf8');
  
  // Save SRT subtitle file
  const srtPath = filePath.replace('.txt', '.srt');
  await fs.writeFile(srtPath, srtContent, 'utf8');
}

/**
 * Format time for SRT subtitle format
 * @param {number} milliseconds - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatSRTTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}
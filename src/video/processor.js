import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

/**
 * Video processor using FFmpeg for recording and processing
 */
export class VideoProcessor {
  constructor(options = {}) {
    this.logger = options.logger;
    this.outputDir = options.outputDir ?? './output';
    this.fps = options.fps ?? parseInt(process.env.VIDEO_FPS || '30', 10);
    this.quality = options.quality ?? process.env.VIDEO_QUALITY ?? 'high';
    this.resolution = options.resolution ?? { width: 1920, height: 1080 };
    
    // Recording state
    this.isRecording = false;
    this.recordingStartTime = null;
    this.frames = [];
    this.audioSegments = [];
    this.frameInterval = null;
    this.currentPage = null;
    
    // For testing purposes
    this.ffmpeg = ffmpeg;
  }

  /**
   * Start recording video from a Puppeteer page
   * @param {Object} page - Puppeteer page object
   */
  async startRecording(page) {
    if (this.isRecording) {
      this.logger?.warn('Recording already in progress');
      return;
    }

    this.logger?.info('Starting video recording', {
      fps: this.fps,
      quality: this.quality,
      resolution: this.resolution,
    });

    try {
      this.currentPage = page;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.frames = [];
      this.audioSegments = [];

      // Set page viewport to recording resolution
      await page.setViewport(this.resolution);

      // Start capturing frames at specified FPS
      const frameIntervalMs = 1000 / this.fps;
      this.frameInterval = setInterval(async () => {
        await this.captureFrame();
      }, frameIntervalMs);

      this.logger?.info('Video recording started successfully');
    } catch (error) {
      this.isRecording = false;
      this.logger?.error('Failed to start video recording', {
        error: error.message,
      });
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Stop video recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      return;
    }

    this.logger?.info('Stopping video recording');

    try {
      this.isRecording = false;
      
      if (this.frameInterval) {
        clearInterval(this.frameInterval);
        this.frameInterval = null;
      }

      this.logger?.info('Video recording stopped', {
        totalFrames: this.frames.length,
        audioSegments: this.audioSegments.length,
        duration: Date.now() - this.recordingStartTime,
      });
    } catch (error) {
      this.logger?.error('Error stopping video recording', {
        error: error.message,
      });
    }
  }

  /**
   * Capture a single frame from the current page
   */
  async captureFrame() {
    if (!this.isRecording || !this.currentPage) {
      return;
    }

    try {
      const screenshot = await this.currentPage.screenshot({
        type: 'png',
        fullPage: false,
      });

      const frameData = {
        buffer: screenshot,
        timestamp: Date.now() - this.recordingStartTime,
        frameNumber: this.frames.length,
      };

      this.frames.push(frameData);

      this.logger?.debug('Frame captured', {
        frameNumber: frameData.frameNumber,
        timestamp: frameData.timestamp,
        size: screenshot.length,
      });
    } catch (error) {
      this.logger?.error('Failed to capture frame', {
        error: error.message,
      });
    }
  }

  /**
   * Add an audio segment to the recording
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {number} duration - Duration in milliseconds
   */
  async addAudioSegment(audioBuffer, duration) {
    if (!this.isRecording) {
      this.logger?.warn('Cannot add audio segment: not recording');
      return;
    }

    const audioSegment = {
      buffer: audioBuffer,
      startTime: Date.now() - this.recordingStartTime,
      duration,
      segmentNumber: this.audioSegments.length,
    };

    this.audioSegments.push(audioSegment);

    this.logger?.debug('Audio segment added', {
      segmentNumber: audioSegment.segmentNumber,
      startTime: audioSegment.startTime,
      duration,
      size: audioBuffer.length,
    });
  }

  /**
   * Finalize video by combining frames and audio
   * @param {string} outputPath - Output video file path
   * @returns {Promise<string>} Path to final video file
   */
  async finalizeVideo(outputPath) {
    this.logger?.info('Finalizing video', {
      outputPath,
      frameCount: this.frames.length,
      audioSegmentCount: this.audioSegments.length,
    });

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Create temporary directory for frames
      const tempDir = path.join(this.outputDir, 'temp_frames');
      await fs.mkdir(tempDir, { recursive: true });

      // Save frames as individual images
      await this.saveFramesToDisk(tempDir);

      // Create video from frames
      if (this.audioSegments.length > 0) {
        // Create audio track first
        const audioPath = await this.createAudioTrack();
        await this.createVideoWithAudio(tempDir, audioPath, outputPath);
      } else {
        await this.createVideoOnly(tempDir, outputPath);
      }

      // Cleanup temporary files
      await this.cleanupTempFiles(tempDir);

      this.logger?.info('Video finalization completed', {
        outputPath,
        fileExists: await this.fileExists(outputPath),
      });

      return outputPath;
    } catch (error) {
      this.logger?.error('Video finalization failed', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Video processing failed: ${error.message}`);
    }
  }

  /**
   * Save captured frames to disk as individual images
   * @param {string} tempDir - Temporary directory for frames
   */
  async saveFramesToDisk(tempDir) {
    this.logger?.debug('Saving frames to disk', {
      frameCount: this.frames.length,
      tempDir,
    });

    const savePromises = this.frames.map(async (frame, index) => {
      const framePath = path.join(tempDir, `frame_${index.toString().padStart(6, '0')}.png`);
      await fs.writeFile(framePath, frame.buffer);
    });

    await Promise.all(savePromises);
  }

  /**
   * Create audio track from audio segments
   * @returns {Promise<string>} Path to combined audio file
   */
  async createAudioTrack() {
    const audioPath = path.join(this.outputDir, 'temp_audio.wav');
    
    this.logger?.debug('Creating audio track', {
      segmentCount: this.audioSegments.length,
      audioPath,
    });

    return new Promise((resolve, reject) => {
      const command = this.ffmpeg();

      // Add audio segments with timing
      this.audioSegments.forEach((segment, index) => {
        const segmentPath = path.join(this.outputDir, `temp_audio_${index}.wav`);
        
        // Save individual audio segment
        fs.writeFile(segmentPath, segment.buffer).then(() => {
          command.input(segmentPath);
        });
      });

      command
        .audioCodec('pcm_s16le')
        .output(audioPath)
        .on('end', () => {
          this.logger?.debug('Audio track created successfully');
          resolve(audioPath);
        })
        .on('error', (error) => {
          this.logger?.error('Audio track creation failed', { error: error.message });
          reject(error);
        })
        .run();
    });
  }

  /**
   * Create video with audio track
   * @param {string} tempDir - Directory containing frames
   * @param {string} audioPath - Path to audio file
   * @param {string} outputPath - Output video path
   */
  async createVideoWithAudio(tempDir, audioPath, outputPath) {
    const qualitySettings = this.getQualitySettings();
    
    return new Promise((resolve, reject) => {
      this.ffmpeg()
        .input(path.join(tempDir, 'frame_%06d.png'))
        .inputFPS(this.fps)
        .input(audioPath)
        .fps(this.fps)
        .size(`${this.resolution.width}x${this.resolution.height}`)
        .videoCodec('libx264')
        .videoBitrate(qualitySettings.videoBitrate)
        .audioCodec('aac')
        .audioBitrate(qualitySettings.audioBitrate)
        .outputOptions([
          '-pix_fmt yuv420p',
          '-preset medium',
          '-crf 23',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('end', () => {
          this.logger?.debug('Video with audio created successfully');
          resolve();
        })
        .on('error', (error) => {
          this.logger?.error('Video creation failed', { error: error.message });
          reject(error);
        })
        .on('progress', (progress) => {
          this.logger?.debug('Video processing progress', {
            percent: progress.percent,
            currentFps: progress.currentFps,
          });
        })
        .run();
    });
  }

  /**
   * Create video without audio
   * @param {string} tempDir - Directory containing frames
   * @param {string} outputPath - Output video path
   */
  async createVideoOnly(tempDir, outputPath) {
    const qualitySettings = this.getQualitySettings();
    
    return new Promise((resolve, reject) => {
      this.ffmpeg()
        .input(path.join(tempDir, 'frame_%06d.png'))
        .inputFPS(this.fps)
        .fps(this.fps)
        .size(`${this.resolution.width}x${this.resolution.height}`)
        .videoCodec('libx264')
        .videoBitrate(qualitySettings.videoBitrate)
        .outputOptions([
          '-pix_fmt yuv420p',
          '-preset medium',
          '-crf 23',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('end', () => {
          this.logger?.debug('Video created successfully');
          resolve();
        })
        .on('error', (error) => {
          this.logger?.error('Video creation failed', { error: error.message });
          reject(error);
        })
        .run();
    });
  }

  /**
   * Get quality settings based on quality level
   * @returns {Object} Quality settings
   */
  getQualitySettings() {
    const settings = {
      high: {
        videoBitrate: '5000k',
        audioBitrate: '192k',
      },
      medium: {
        videoBitrate: '2500k',
        audioBitrate: '128k',
      },
      low: {
        videoBitrate: '1000k',
        audioBitrate: '96k',
      },
    };

    return settings[this.quality] || settings.high;
  }

  /**
   * Clean up temporary files
   * @param {string} tempDir - Temporary directory to clean
   */
  async cleanupTempFiles(tempDir) {
    try {
      this.logger?.debug('Cleaning up temporary files', { tempDir });
      
      // Remove frame files
      const files = await fs.readdir(tempDir);
      const deletePromises = files.map(file => 
        fs.unlink(path.join(tempDir, file)).catch(() => {})
      );
      
      await Promise.all(deletePromises);
      await fs.rmdir(tempDir).catch(() => {});

      // Remove temporary audio files
      const audioFiles = this.audioSegments.map((_, index) => 
        path.join(this.outputDir, `temp_audio_${index}.wav`)
      );
      
      const audioDeletePromises = audioFiles.map(file => 
        fs.unlink(file).catch(() => {})
      );
      
      await Promise.all(audioDeletePromises);
      
      // Remove combined audio file
      await fs.unlink(path.join(this.outputDir, 'temp_audio.wav')).catch(() => {});

      this.logger?.debug('Temporary files cleaned up successfully');
    } catch (error) {
      this.logger?.warn('Failed to clean up some temporary files', {
        error: error.message,
      });
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recording statistics
   * @returns {Object} Recording statistics
   */
  getRecordingStats() {
    return {
      isRecording: this.isRecording,
      frameCount: this.frames.length,
      audioSegmentCount: this.audioSegments.length,
      duration: this.recordingStartTime ? Date.now() - this.recordingStartTime : 0,
      fps: this.fps,
      quality: this.quality,
      resolution: this.resolution,
    };
  }
}
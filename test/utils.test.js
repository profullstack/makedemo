import { expect } from 'chai';
import { createLogger } from '../src/utils/logger.js';
import { ensureOutputDirectory } from '../src/utils/filesystem.js';
import fs from 'fs/promises';
import path from 'path';

describe('Utils', () => {
  describe('Logger', () => {
    it('should create a logger with default configuration', () => {
      const logger = createLogger();
      
      expect(logger).to.have.property('info');
      expect(logger).to.have.property('error');
      expect(logger).to.have.property('debug');
      expect(logger).to.have.property('warn');
    });

    it('should create a logger with custom configuration', () => {
      const logger = createLogger({
        level: 'debug',
        outputDir: './test-output',
      });
      
      expect(logger).to.have.property('info');
      expect(logger).to.have.property('error');
      expect(logger).to.have.property('debug');
      expect(logger).to.have.property('warn');
    });

    it('should log messages at different levels', () => {
      const logger = createLogger({ level: 'debug' });
      
      // These should not throw
      expect(() => logger.info('Test info message')).to.not.throw();
      expect(() => logger.error('Test error message')).to.not.throw();
      expect(() => logger.debug('Test debug message')).to.not.throw();
      expect(() => logger.warn('Test warn message')).to.not.throw();
    });
  });

  describe('Filesystem', () => {
    const testDir = './test-output-dir';

    afterEach(async () => {
      try {
        await fs.rmdir(testDir, { recursive: true });
      } catch {
        // Directory might not exist
      }
    });

    it('should create output directory if it does not exist', async () => {
      await ensureOutputDirectory(testDir);
      
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).to.be.true;
    });

    it('should not fail if directory already exists', async () => {
      await fs.mkdir(testDir, { recursive: true });
      
      // Should not throw
      await ensureOutputDirectory(testDir);
      
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).to.be.true;
    });

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep');
      
      await ensureOutputDirectory(nestedDir);
      
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).to.be.true;
    });
  });
});
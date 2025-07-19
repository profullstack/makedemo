import { expect } from 'chai';
import { parseArguments, validateOptions } from '../src/cli/parser.js';

describe('CLI Parser', () => {
  describe('parseArguments', () => {
    it('should parse valid create command with all required options', () => {
      const args = [
        'create',
        '--user',
        'test@example.com',
        '--password',
        'testpass',
        '--url',
        'https://example.com',
      ];
      
      const result = parseArguments(args);
      
      expect(result.command).to.equal('create');
      expect(result.options.user).to.equal('test@example.com');
      expect(result.options.password).to.equal('testpass');
      expect(result.options.url).to.equal('https://example.com');
    });

    it('should handle optional output directory', () => {
      const args = [
        'create',
        '--user',
        'test@example.com',
        '--password',
        'testpass',
        '--url',
        'https://example.com',
        '--output',
        './custom-output',
      ];
      
      const result = parseArguments(args);
      
      expect(result.options.output).to.equal('./custom-output');
    });

    it('should handle verbose flag', () => {
      const args = [
        'create',
        '--user',
        'test@example.com',
        '--password',
        'testpass',
        '--url',
        'https://example.com',
        '--verbose',
      ];
      
      const result = parseArguments(args);
      
      expect(result.options.verbose).to.be.true;
    });

    it('should throw error for unknown command', () => {
      const args = ['unknown-command'];
      
      expect(() => parseArguments(args)).to.throw('Unknown command: unknown-command');
    });
  });

  describe('validateOptions', () => {
    it('should validate correct options for create command', () => {
      const options = {
        user: 'test@example.com',
        password: 'testpass',
        url: 'https://example.com',
      };
      
      expect(() => validateOptions('create', options)).to.not.throw();
    });

    it('should throw error for missing user', () => {
      const options = {
        password: 'testpass',
        url: 'https://example.com',
      };
      
      expect(() => validateOptions('create', options)).to.throw('Missing required option: user');
    });

    it('should throw error for missing password', () => {
      const options = {
        user: 'test@example.com',
        url: 'https://example.com',
      };
      
      expect(() => validateOptions('create', options)).to.throw('Missing required option: password');
    });

    it('should throw error for missing url', () => {
      const options = {
        user: 'test@example.com',
        password: 'testpass',
      };
      
      expect(() => validateOptions('create', options)).to.throw('Missing required option: url');
    });

    it('should throw error for invalid email format', () => {
      const options = {
        user: 'invalid-email',
        password: 'testpass',
        url: 'https://example.com',
      };
      
      expect(() => validateOptions('create', options)).to.throw('Invalid email format for user');
    });

    it('should throw error for invalid URL format', () => {
      const options = {
        user: 'test@example.com',
        password: 'testpass',
        url: 'not-a-url',
      };
      
      expect(() => validateOptions('create', options)).to.throw('Invalid URL format');
    });
  });
});
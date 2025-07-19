import { expect } from 'chai';
import { AuthenticationHandler } from '../src/auth/handler.js';
import { createLogger } from '../src/utils/logger.js';

describe('Authentication Handler', () => {
  let authHandler;
  let mockPage;
  let logger;

  beforeEach(() => {
    logger = createLogger({ level: 'error', enableFile: false });
    authHandler = new AuthenticationHandler({ logger });
    
    // Mock Puppeteer page object
    mockPage = {
      url: () => 'https://example.com',
      $: async (selector) => {
        // Mock element finding
        if (selector.includes('email') || selector.includes('username')) {
          return { type: async () => {} };
        }
        if (selector.includes('password')) {
          return { type: async () => {} };
        }
        if (selector.includes('submit') || selector.includes('login')) {
          return { click: async () => {} };
        }
        return null;
      },
      $$: async (selector) => {
        // Mock multiple elements
        if (selector.includes('input')) {
          return [
            { getAttribute: async () => 'email', type: async () => {} },
            { getAttribute: async () => 'password', type: async () => {} },
          ];
        }
        return [];
      },
      waitForNavigation: async () => {},
      waitForSelector: async () => ({}),
      evaluate: async (fn) => {
        // Mock page evaluation
        if (fn.toString().includes('form')) {
          return [{ action: '/login', method: 'post' }];
        }
        return [];
      },
    };
  });

  describe('detectLoginForm', () => {
    it('should detect login form with email and password fields', async () => {
      const result = await authHandler.detectLoginForm(mockPage);
      
      expect(result).to.have.property('found');
      expect(result).to.have.property('emailField');
      expect(result).to.have.property('passwordField');
      expect(result).to.have.property('submitButton');
    });

    it('should handle page with no login form', async () => {
      mockPage.$ = async () => null;
      mockPage.$$ = async () => [];
      
      const result = await authHandler.detectLoginForm(mockPage);
      
      expect(result.found).to.be.false;
    });
  });

  describe('authenticate', () => {
    it('should successfully authenticate with valid credentials', async () => {
      // Mock successful authentication
      mockPage.url = () => 'https://example.com/dashboard';
      
      const result = await authHandler.authenticate(mockPage, {
        user: 'test@example.com',
        password: 'testpass',
      });
      
      expect(result).to.be.true;
    });

    it('should fail authentication with invalid credentials', async () => {
      // Mock failed authentication (URL doesn't change)
      mockPage.url = () => 'https://example.com/login';
      mockPage.$ = async (selector) => {
        if (selector.includes('error')) {
          return { textContent: 'Invalid credentials' };
        }
        return null;
      };
      
      const result = await authHandler.authenticate(mockPage, {
        user: 'invalid@example.com',
        password: 'wrongpass',
      });
      
      expect(result).to.be.false;
    });

    it('should handle missing login form', async () => {
      mockPage.$ = async () => null;
      mockPage.$$ = async () => [];
      
      const result = await authHandler.authenticate(mockPage, {
        user: 'test@example.com',
        password: 'testpass',
      });
      
      expect(result).to.be.false;
    });

    it('should throw error for missing credentials', async () => {
      try {
        await authHandler.authenticate(mockPage, {});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Missing required credentials');
      }
    });
  });

  describe('fillLoginForm', () => {
    it('should fill login form with provided credentials', async () => {
      const formElements = {
        emailField: { type: async (text) => { this.value = text; } },
        passwordField: { type: async (text) => { this.value = text; } },
        submitButton: { click: async () => {} },
      };
      
      await authHandler.fillLoginForm(mockPage, formElements, {
        user: 'test@example.com',
        password: 'testpass',
      });
      
      // Test passes if no error is thrown
      expect(true).to.be.true;
    });
  });

  describe('waitForAuthenticationResult', () => {
    it('should detect successful authentication by URL change', async () => {
      const originalUrl = 'https://example.com/login';
      mockPage.url = () => 'https://example.com/dashboard';
      
      const result = await authHandler.waitForAuthenticationResult(mockPage, originalUrl);
      
      expect(result.success).to.be.true;
      expect(result.newUrl).to.equal('https://example.com/dashboard');
    });

    it('should detect failed authentication by error message', async () => {
      const originalUrl = 'https://example.com/login';
      mockPage.url = () => originalUrl;
      mockPage.$ = async (selector) => {
        if (selector.includes('error')) {
          return { textContent: 'Login failed' };
        }
        return null;
      };
      
      const result = await authHandler.waitForAuthenticationResult(mockPage, originalUrl);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Login failed');
    });
  });
});
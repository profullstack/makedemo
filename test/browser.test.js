import { expect } from 'chai';
import { BrowserManager } from '../src/browser/manager.js';
import { createLogger } from '../src/utils/logger.js';

describe('Browser Manager', () => {
  let browserManager;
  let logger;

  beforeEach(() => {
    logger = createLogger({ level: 'error', enableFile: false });
    browserManager = new BrowserManager({ headless: true, logger });
  });

  afterEach(async () => {
    if (browserManager.browser) {
      await browserManager.close();
    }
  });

  describe('initialization', () => {
    it('should create browser manager with default options', () => {
      const manager = new BrowserManager({ logger });
      
      expect(manager).to.have.property('headless', true);
      expect(manager).to.have.property('viewport');
      expect(manager.viewport).to.deep.equal({ width: 1920, height: 1080 });
    });

    it('should create browser manager with custom options', () => {
      const manager = new BrowserManager({
        headless: false,
        viewport: { width: 1280, height: 720 },
        logger,
      });
      
      expect(manager.headless).to.be.false;
      expect(manager.viewport).to.deep.equal({ width: 1280, height: 720 });
    });
  });

  describe('browser lifecycle', () => {
    it('should initialize browser successfully', async () => {
      await browserManager.initialize();
      
      expect(browserManager.browser).to.not.be.null;
      expect(browserManager.page).to.not.be.null;
    });

    it('should close browser successfully', async () => {
      await browserManager.initialize();
      await browserManager.close();
      
      expect(browserManager.browser).to.be.null;
      expect(browserManager.page).to.be.null;
    });

    it('should handle multiple close calls gracefully', async () => {
      await browserManager.initialize();
      await browserManager.close();
      
      // Should not throw
      await browserManager.close();
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should navigate to URL successfully', async () => {
      // Mock the page navigation
      browserManager.page.goto = async (url) => {
        browserManager.page._url = url;
        return { status: () => 200 };
      };
      browserManager.page.url = () => browserManager.page._url;

      await browserManager.navigateTo('https://example.com');
      
      expect(browserManager.page.url()).to.equal('https://example.com');
    });

    it('should handle navigation errors', async () => {
      browserManager.page.goto = async () => {
        throw new Error('Navigation failed');
      };

      try {
        await browserManager.navigateTo('https://invalid-url');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Navigation failed');
      }
    });
  });

  describe('interaction execution', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should execute click interaction', async () => {
      let clicked = false;
      browserManager.page.$ = async () => ({
        click: async () => { clicked = true; },
      });

      const interaction = {
        type: 'click',
        selector: 'button',
        description: 'Click button',
      };

      await browserManager.executeInteraction(interaction);
      
      expect(clicked).to.be.true;
    });

    it('should execute type interaction', async () => {
      let typedText = '';
      browserManager.page.$ = async () => ({
        type: async (text) => { typedText = text; },
      });

      const interaction = {
        type: 'type',
        selector: 'input',
        text: 'Hello World',
        description: 'Type text',
      };

      await browserManager.executeInteraction(interaction);
      
      expect(typedText).to.equal('Hello World');
    });

    it('should handle missing element gracefully', async () => {
      browserManager.page.$ = async () => null;

      const interaction = {
        type: 'click',
        selector: 'nonexistent',
        description: 'Click nonexistent element',
      };

      try {
        await browserManager.executeInteraction(interaction);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Element not found');
      }
    });
  });

  describe('page state capture', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should capture page state successfully', async () => {
      // Mock page evaluation
      browserManager.page.evaluate = async () => ({
        url: 'https://example.com',
        title: 'Example Page',
        interactiveElements: [
          { tag: 'button', text: 'Click me', selector: 'button' },
        ],
      });

      const state = await browserManager.capturePageState();
      
      expect(state).to.have.property('url');
      expect(state).to.have.property('title');
      expect(state).to.have.property('interactiveElements');
      expect(state.interactiveElements).to.be.an('array');
    });
  });

  describe('screenshot capture', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should capture screenshot successfully', async () => {
      browserManager.page.screenshot = async () => Buffer.from('fake-image-data');

      const screenshot = await browserManager.captureScreenshot();
      
      expect(screenshot).to.be.instanceOf(Buffer);
    });
  });
});
import puppeteer from 'puppeteer';

/**
 * Browser automation manager using Puppeteer
 */
export class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless ?? true;
    this.viewport = options.viewport ?? { width: 1920, height: 1080 };
    this.logger = options.logger;
    this.timeout = options.timeout ?? 30000;
    
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser and create a new page
   */
  async initialize() {
    this.logger?.info('Initializing browser', {
      headless: this.headless,
      viewport: this.viewport,
    });

    try {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      this.page = await this.browser.newPage();
      
      // Set viewport
      await this.page.setViewport(this.viewport);
      
      // Set user agent to avoid detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      // Set default timeout
      this.page.setDefaultTimeout(this.timeout);

      this.logger?.info('Browser initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize browser', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   */
  async navigateTo(url) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.logger?.info('Navigating to URL', { url });

    try {
      const response = await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      if (!response.ok()) {
        throw new Error(`Navigation failed with status: ${response.status()}`);
      }

      this.logger?.info('Navigation successful', {
        url: this.page.url(),
        status: response.status(),
      });
    } catch (error) {
      this.logger?.error('Navigation failed', {
        url,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Execute an interaction on the page
   * @param {Object} interaction - Interaction object
   * @param {string} interaction.type - Type of interaction (click, type, etc.)
   * @param {string} interaction.selector - CSS selector for the element
   * @param {string} interaction.text - Text to type (for type interactions)
   * @param {string} interaction.description - Description of the interaction
   */
  async executeInteraction(interaction) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const { type, selector, text, description } = interaction;

    this.logger?.info('Executing interaction', {
      type,
      selector,
      description,
    });

    try {
      // Find the element
      const element = await this.page.$(selector);
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Execute the interaction based on type
      switch (type) {
        case 'click':
          await element.click();
          break;
          
        case 'type':
          if (!text) {
            throw new Error('Text is required for type interaction');
          }
          await element.type(text);
          break;
          
        case 'hover':
          await element.hover();
          break;
          
        case 'focus':
          await element.focus();
          break;
          
        default:
          throw new Error(`Unsupported interaction type: ${type}`);
      }

      // Wait for any potential page changes
      await this.page.waitForTimeout(1000);

      this.logger?.debug('Interaction executed successfully', {
        type,
        selector,
      });
    } catch (error) {
      this.logger?.error('Interaction execution failed', {
        type,
        selector,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Capture current page state for AI analysis
   * @returns {Promise<Object>} Page state object
   */
  async capturePageState() {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.logger?.debug('Capturing page state');

    try {
      const state = await this.page.evaluate(() => {
        // Get basic page information
        const pageInfo = {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString(),
        };

        // Find interactive elements
        const interactiveElements = [];
        const selectors = [
          'button',
          'a[href]',
          'input[type="button"]',
          'input[type="submit"]',
          '[role="button"]',
          '[onclick]',
          'select',
          'input[type="text"]',
          'input[type="email"]',
          'textarea',
        ];

        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el, index) => {
            if (el.offsetParent !== null) { // Element is visible
              const rect = el.getBoundingClientRect();
              const elementInfo = {
                tag: el.tagName.toLowerCase(),
                type: el.type || null,
                text: el.textContent?.trim() || el.value || el.placeholder || '',
                selector: `${selector}:nth-of-type(${index + 1})`,
                position: {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                },
                size: {
                  width: rect.width,
                  height: rect.height,
                },
                visible: rect.width > 0 && rect.height > 0,
              };
              
              if (elementInfo.text || elementInfo.type) {
                interactiveElements.push(elementInfo);
              }
            }
          });
        });

        return {
          ...pageInfo,
          interactiveElements: interactiveElements.slice(0, 20), // Limit to first 20 elements
        };
      });

      this.logger?.debug('Page state captured', {
        url: state.url,
        elementCount: state.interactiveElements.length,
      });

      return state;
    } catch (error) {
      this.logger?.error('Failed to capture page state', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Capture a screenshot of the current page
   * @param {Object} options - Screenshot options
   * @returns {Promise<Buffer>} Screenshot buffer
   */
  async captureScreenshot(options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      const screenshot = await this.page.screenshot({
        fullPage: options.fullPage ?? false,
        type: options.type ?? 'png',
        quality: options.quality ?? 90,
        ...options,
      });

      this.logger?.debug('Screenshot captured');
      return screenshot;
    } catch (error) {
      this.logger?.error('Failed to capture screenshot', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get the current page object
   * @returns {Object} Puppeteer page object
   */
  getPage() {
    return this.page;
  }

  /**
   * Get the current browser object
   * @returns {Object} Puppeteer browser object
   */
  getBrowser() {
    return this.browser;
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      this.logger?.info('Closing browser');
      
      try {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        
        this.logger?.info('Browser closed successfully');
      } catch (error) {
        this.logger?.error('Error closing browser', {
          error: error.message,
        });
      }
    }
  }
}
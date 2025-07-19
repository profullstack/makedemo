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
      // Try to find the element with multiple strategies
      let element = await this.findElementWithFallback(selector, description);
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Scroll element into view if needed
      await element.scrollIntoViewIfNeeded();

      // Execute the interaction based on type
      switch (type) {
        case 'click':
          await element.click();
          break;
          
        case 'type':
          if (!text) {
            throw new Error('Text is required for type interaction');
          }
          // Clear existing text first using Puppeteer's correct method
          await element.click({ clickCount: 3 }); // Select all text
          await element.type(text);
          break;
          
        case 'hover':
          await element.hover();
          break;
          
        case 'focus':
          await element.focus();
          break;
          
        case 'scroll':
          // Scroll the element into view
          await element.scrollIntoView();
          // Additional scroll to ensure visibility
          await this.page.evaluate((el) => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, element);
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
   * Find element with multiple fallback strategies
   * @param {string} selector - Primary CSS selector
   * @param {string} description - Description of the element for intelligent fallback
   * @returns {Promise<Object|null>} Element handle or null
   */
  async findElementWithFallback(selector, description = '') {
    if (!this.page) {
      return null;
    }

    this.logger?.debug('Finding element with fallback', { selector, description });

    // Strategy 1: Try the exact selector
    let element = await this.page.$(selector);
    if (element) {
      this.logger?.debug('Element found with exact selector', { selector });
      return element;
    }

    // Strategy 2: Try to find by text content if description contains keywords
    if (description) {
      const textKeywords = this.extractTextKeywords(description);
      for (const keyword of textKeywords) {
        // Try to find elements by text content using XPath
        try {
          // Try button with text content
          let xpath = `//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${keyword.toLowerCase()}")]`;
          let [xpathElement] = await this.page.$x(xpath);
          if (xpathElement) {
            this.logger?.debug('Element found by button text', { keyword, xpath });
            return xpathElement;
          }

          // Try link with text content
          xpath = `//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${keyword.toLowerCase()}")]`;
          [xpathElement] = await this.page.$x(xpath);
          if (xpathElement) {
            this.logger?.debug('Element found by link text', { keyword, xpath });
            return xpathElement;
          }

          // Try any clickable element with text content
          xpath = `//*[@role='button' or @onclick or name()='button' or name()='a'][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${keyword.toLowerCase()}")]`;
          [xpathElement] = await this.page.$x(xpath);
          if (xpathElement) {
            this.logger?.debug('Element found by clickable text', { keyword, xpath });
            return xpathElement;
          }

          // Try by partial text match
          xpath = `//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${keyword.toLowerCase()}")]`;
          [xpathElement] = await this.page.$x(xpath);
          if (xpathElement) {
            this.logger?.debug('Element found by partial text match', { keyword, xpath });
            return xpathElement;
          }
        } catch (error) {
          this.logger?.debug('XPath search failed for keyword', { keyword, error: error.message });
          // XPath search failed, continue with other strategies
        }
      }
    }

    // Strategy 3: Try simplified selectors
    const simplifiedSelectors = this.generateFallbackSelectors(selector);
    for (const fallbackSelector of simplifiedSelectors) {
      element = await this.page.$(fallbackSelector);
      if (element) {
        this.logger?.debug('Element found with fallback selector', {
          original: selector,
          fallback: fallbackSelector
        });
        return element;
      }
    }

    // Strategy 4: Try to find similar elements and pick the most likely one
    const baseSelector = selector.split(':')[0]; // Remove nth-of-type part
    const elements = await this.page.$$(baseSelector);
    
    if (elements.length > 0) {
      // If we have elements, try to pick the most relevant one
      const targetIndex = this.extractNthIndex(selector);
      const selectedElement = elements[Math.min(targetIndex - 1, elements.length - 1)] || elements[0];
      
      this.logger?.debug('Element found with base selector strategy', {
        baseSelector,
        totalFound: elements.length,
        selectedIndex: Math.min(targetIndex - 1, elements.length - 1)
      });
      
      return selectedElement;
    }

    this.logger?.warn('Element not found with any strategy', { selector, description });
    return null;
  }

  /**
   * Extract text keywords from description for element finding
   * @param {string} description - Element description
   * @returns {string[]} Array of keywords
   */
  extractTextKeywords(description) {
    if (!description) return [];
    
    // Extract quoted text and common action words
    const quotedText = description.match(/'([^']+)'/g) || description.match(/"([^"]+)"/g) || [];
    const actionWords = description.match(/\b(sign up|login|submit|get|access|early|button|click)\b/gi) || [];
    
    const keywords = [
      ...quotedText.map(text => text.replace(/['"]/g, '')),
      ...actionWords
    ];
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Generate fallback selectors from the original selector
   * @param {string} selector - Original CSS selector
   * @returns {string[]} Array of fallback selectors
   */
  generateFallbackSelectors(selector) {
    const fallbacks = [];
    
    // Remove nth-of-type and try different indices
    if (selector.includes(':nth-of-type(')) {
      const baseSelector = selector.split(':nth-of-type(')[0];
      const currentIndex = this.extractNthIndex(selector);
      
      // Try nearby indices
      for (let i = Math.max(1, currentIndex - 2); i <= currentIndex + 2; i++) {
        if (i !== currentIndex) {
          fallbacks.push(`${baseSelector}:nth-of-type(${i})`);
        }
      }
      
      // Try first and last
      fallbacks.push(`${baseSelector}:first-of-type`);
      fallbacks.push(`${baseSelector}:last-of-type`);
      
      // Try without nth-of-type
      fallbacks.push(baseSelector);
    }
    
    // Try more generic selectors
    if (selector.includes('button')) {
      fallbacks.push('button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]');
    }
    
    if (selector.includes('input')) {
      fallbacks.push('input', 'input[type="text"]', 'input[type="email"]');
    }
    
    if (selector.includes('a')) {
      fallbacks.push('a', 'a[href]');
    }
    
    return fallbacks;
  }

  /**
   * Extract nth index from selector
   * @param {string} selector - CSS selector with nth-of-type
   * @returns {number} Index number
   */
  extractNthIndex(selector) {
    const match = selector.match(/:nth-of-type\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 1;
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
/**
 * Authentication handler for web login automation
 */
export class AuthenticationHandler {
  constructor({ logger }) {
    this.logger = logger;
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Authenticate user on the current page
   * @param {Object} page - Puppeteer page object
   * @param {Object} credentials - User credentials
   * @param {string} credentials.user - User email/username
   * @param {string} credentials.password - User password
   * @returns {Promise<boolean>} True if authentication successful
   */
  async authenticate(page, credentials) {
    const { user, password } = credentials;

    if (!user || !password) {
      throw new Error('Missing required credentials: user and password');
    }

    this.logger.info('Starting authentication process', { user });

    try {
      // Detect login form on the page
      const loginForm = await this.detectLoginForm(page);

      if (!loginForm.found) {
        this.logger.warn('No login form detected on page');
        return false;
      }

      this.logger.debug('Login form detected', {
        emailField: !!loginForm.emailField,
        passwordField: !!loginForm.passwordField,
        submitButton: !!loginForm.submitButton,
      });

      // Get current URL to detect navigation after login
      const originalUrl = page.url();

      // Fill and submit login form
      await this.fillLoginForm(page, loginForm, credentials);

      // Wait for authentication result
      const result = await this.waitForAuthenticationResult(page, originalUrl);

      if (result.success) {
        this.logger.info('Authentication successful', {
          newUrl: result.newUrl,
        });
        return true;
      } else {
        this.logger.warn('Authentication failed', {
          error: result.error,
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Authentication error', {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Detect login form elements on the page
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Object>} Login form elements
   */
  async detectLoginForm(page) {
    this.logger.debug('Detecting login form elements');

    try {
      // Common selectors for email/username fields
      const emailSelectors = [
        'input[type="email"]',
        'input[name*="email"]',
        'input[name*="username"]',
        'input[name*="user"]',
        'input[id*="email"]',
        'input[id*="username"]',
        'input[id*="user"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
      ];

      // Common selectors for password fields
      const passwordSelectors = [
        'input[type="password"]',
        'input[name*="password"]',
        'input[id*="password"]',
        'input[placeholder*="password" i]',
      ];

      // Common selectors for submit buttons
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Login")',
        'button:contains("Sign in")',
        'button:contains("Log in")',
        '[role="button"]:contains("Login")',
        '[role="button"]:contains("Sign in")',
      ];

      // Find email/username field
      let emailField = null;
      for (const selector of emailSelectors) {
        emailField = await page.$(selector);
        if (emailField) break;
      }

      // Find password field
      let passwordField = null;
      for (const selector of passwordSelectors) {
        passwordField = await page.$(selector);
        if (passwordField) break;
      }

      // Find submit button
      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = await page.$(selector);
        if (submitButton) break;
      }

      // If no submit button found, look for forms and use the first button
      if (!submitButton && emailField && passwordField) {
        submitButton = await page.$('form button, form input[type="submit"]');
      }

      const found = !!(emailField && passwordField && submitButton);

      return {
        found,
        emailField,
        passwordField,
        submitButton,
      };
    } catch (error) {
      this.logger.error('Error detecting login form', {
        error: error.message,
      });
      return { found: false };
    }
  }

  /**
   * Fill login form with credentials
   * @param {Object} page - Puppeteer page object
   * @param {Object} formElements - Login form elements
   * @param {Object} credentials - User credentials
   */
  async fillLoginForm(page, formElements, credentials) {
    const { emailField, passwordField, submitButton } = formElements;
    const { user, password } = credentials;

    this.logger.debug('Filling login form');

    try {
      // Clear and fill email field
      await emailField.click({ clickCount: 3 }); // Select all text
      await emailField.type(user);

      // Clear and fill password field
      await passwordField.click({ clickCount: 3 }); // Select all text
      await passwordField.type(password);

      // Small delay before submitting
      await page.waitForTimeout(500);

      // Submit the form
      await submitButton.click();

      this.logger.debug('Login form submitted');
    } catch (error) {
      this.logger.error('Error filling login form', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Wait for authentication result
   * @param {Object} page - Puppeteer page object
   * @param {string} originalUrl - Original page URL before login
   * @returns {Promise<Object>} Authentication result
   */
  async waitForAuthenticationResult(page, originalUrl) {
    this.logger.debug('Waiting for authentication result');

    try {
      // Wait for either navigation or error message
      await Promise.race([
        page.waitForNavigation({ timeout: this.timeout }),
        page.waitForTimeout(5000), // Fallback timeout
      ]);

      const newUrl = page.url();

      // Check if URL changed (successful login usually redirects)
      if (newUrl !== originalUrl) {
        return {
          success: true,
          newUrl,
        };
      }

      // Check for error messages on the page
      const errorSelectors = [
        '.error',
        '.alert-danger',
        '.alert-error',
        '[class*="error"]',
        '[class*="invalid"]',
        '[role="alert"]',
      ];

      let errorMessage = null;
      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          errorMessage = await page.evaluate(el => el.textContent, errorElement);
          break;
        }
      }

      if (errorMessage) {
        return {
          success: false,
          error: errorMessage.trim(),
        };
      }

      // If no clear success or error indicators, assume failure
      return {
        success: false,
        error: 'Authentication result unclear - no URL change or error message detected',
      };
    } catch (error) {
      this.logger.error('Error waiting for authentication result', {
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
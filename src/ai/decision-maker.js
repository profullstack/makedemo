import OpenAI from 'openai';

/**
 * AI-powered decision maker for website interactions
 */
export class AIDecisionMaker {
  constructor(options = {}) {
    this.logger = options.logger;
    this.maxInteractions = options.maxInteractions ?? 10;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4-turbo-preview';
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Supported interaction types
    this.supportedInteractions = ['click', 'type', 'hover', 'scroll', 'wait'];
  }

  /**
   * Plan interactions for a given page
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Array>} Array of planned interactions
   */
  async planInteractions(page) {
    this.logger?.info('Planning interactions using AI');

    try {
      // Capture current page state
      const pageState = await this.capturePageState(page);
      
      // Analyze page state
      const analysis = this.analyzePageState(pageState);
      
      this.logger?.debug('Page analysis completed', {
        pageType: analysis.pageType,
        elementCount: analysis.keyElements.length,
      });

      // Generate interaction plan using OpenAI
      const interactions = await this.generateInteractionPlan(pageState, analysis);
      
      // Validate and filter interactions
      const validInteractions = interactions
        .filter(interaction => this.validateInteraction(interaction))
        .slice(0, this.maxInteractions);

      this.logger?.info('Interaction plan generated', {
        totalInteractions: validInteractions.length,
        maxAllowed: this.maxInteractions,
      });

      return validInteractions;
    } catch (error) {
      this.logger?.error('Failed to plan interactions', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate interaction plan: ${error.message}`);
    }
  }

  /**
   * Generate narration for a specific interaction
   * @param {Object} interaction - Interaction object
   * @returns {Promise<string>} Narration text
   */
  async generateNarration(interaction) {
    this.logger?.debug('Generating narration for interaction', {
      type: interaction.type,
      description: interaction.description,
    });

    try {
      const prompt = this.createNarrationPrompt(interaction);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional narrator creating voiceover for a web demo video. Generate natural, engaging narration that explains what is happening on screen.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const narration = response.choices[0].message.content.trim();
      
      this.logger?.debug('Narration generated', {
        length: narration.length,
      });

      return narration;
    } catch (error) {
      this.logger?.error('Failed to generate narration', {
        error: error.message,
      });
      throw new Error(`Failed to generate narration: ${error.message}`);
    }
  }

  /**
   * Capture page state for analysis
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Object>} Page state object
   */
  async capturePageState(page) {
    return await page.evaluate(() => {
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
        'input[type="text"]',
        'input[type="email"]',
        'input[type="password"]',
        'textarea',
        'select',
        '[role="button"]',
        '[onclick]',
        '.btn',
        '.button',
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
              href: el.href || null,
              className: el.className || '',
              id: el.id || '',
            };
            
            if (elementInfo.visible && (elementInfo.text || elementInfo.type)) {
              interactiveElements.push(elementInfo);
            }
          }
        });
      });

      return {
        ...pageInfo,
        interactiveElements: interactiveElements.slice(0, 30), // Limit elements
      };
    });
  }

  /**
   * Analyze page state to understand context
   * @param {Object} pageState - Page state object
   * @returns {Object} Analysis results
   */
  analyzePageState(pageState) {
    const { url, title, interactiveElements } = pageState;
    
    // Determine page type based on URL and elements
    let pageType = 'general';
    let isLoggedIn = false;
    
    // Check for logged-in indicators
    const loggedInIndicators = [
      'dashboard', 'admin', 'app', 'workspace', 'console', 'panel',
      'profile', 'account', 'settings', 'preferences', 'logout', 'signout'
    ];
    
    const hasLoggedInElements = interactiveElements.some(el => {
      const text = el.text.toLowerCase();
      return loggedInIndicators.some(indicator => text.includes(indicator));
    });
    
    const hasLoggedInUrl = loggedInIndicators.some(indicator => url.toLowerCase().includes(indicator));
    
    isLoggedIn = hasLoggedInElements || hasLoggedInUrl;
    
    // Determine specific page type
    if (url.includes('login') || url.includes('signin')) {
      pageType = 'login';
    } else if (url.includes('dashboard') || url.includes('admin') || url.includes('app')) {
      pageType = 'dashboard';
      isLoggedIn = true;
    } else if (url.includes('profile') || url.includes('account')) {
      pageType = 'profile';
      isLoggedIn = true;
    } else if (url.includes('settings')) {
      pageType = 'settings';
      isLoggedIn = true;
    } else if (isLoggedIn) {
      pageType = 'authenticated';
    }

    // Identify key elements, filtering out waitlist/signup if logged in
    const keyElements = interactiveElements.filter(el => {
      const text = el.text.toLowerCase();
      
      // Skip waitlist/signup elements if user appears to be logged in
      if (isLoggedIn) {
        const skipPatterns = [
          'waitlist', 'join waitlist', 'subscribe', 'sign up', 'signup',
          'get started', 'try free', 'free trial', 'register'
        ];
        
        if (skipPatterns.some(pattern => text.includes(pattern))) {
          return false;
        }
      }
      
      const isImportant =
        el.tag === 'button' ||
        text.includes('submit') ||
        text.includes('save') ||
        text.includes('create') ||
        text.includes('delete') ||
        text.includes('edit') ||
        text.includes('view') ||
        text.includes('open') ||
        text.includes('manage') ||
        text.includes('configure') ||
        text.includes('settings') ||
        text.includes('dashboard') ||
        text.includes('menu') ||
        text.includes('nav') ||
        (!isLoggedIn && (text.includes('login') || text.includes('signup'))) ||
        el.type === 'submit';
      
      return isImportant;
    });

    // Suggest potential actions
    const suggestedActions = this.generateActionSuggestions(pageType, keyElements, isLoggedIn);

    return {
      pageType,
      keyElements,
      suggestedActions,
      elementCount: interactiveElements.length,
      isLoggedIn,
    };
  }

  /**
   * Generate interaction plan using OpenAI
   * @param {Object} pageState - Current page state
   * @param {Object} analysis - Page analysis
   * @returns {Promise<Array>} Generated interactions
   */
  async generateInteractionPlan(pageState, analysis) {
    const prompt = this.createInteractionPrompt(pageState, analysis);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an AI that creates demo interactions for websites. Generate a JSON array of interactions that would showcase the website's features effectively. Each interaction should have: type, selector, description, reasoning, and duration (in milliseconds).

Supported interaction types: ${this.supportedInteractions.join(', ')}

IMPORTANT RULES:
1. If the user appears to be logged in (dashboard, app interface, authenticated pages), focus on demonstrating ACTUAL APP FEATURES, not signup/waitlist actions
2. Avoid "Subscribe to waitlist", "Join waitlist", "Sign up" buttons if the user is already in the app
3. Prioritize functional interactions that show what the app actually does
4. Look for navigation menus, feature buttons, data displays, settings, and core functionality
5. Create a logical flow that demonstrates the app's value proposition

Focus on the most important and demonstrative actions. Limit to ${this.maxInteractions} interactions maximum.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content.trim();
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      this.logger?.warn('Failed to parse AI response as JSON', {
        content,
        error: parseError.message,
      });
      
      // Fallback: extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * Create prompt for interaction planning
   * @param {Object} pageState - Page state
   * @param {Object} analysis - Page analysis
   * @returns {string} Formatted prompt
   */
  createInteractionPrompt(pageState, analysis) {
    const loginStatus = analysis.isLoggedIn ? 'LOGGED IN (authenticated user)' : 'NOT LOGGED IN (visitor)';
    
    return `
Analyze this webpage and create a demo interaction plan:

URL: ${pageState.url}
Title: ${pageState.title}
Page Type: ${analysis.pageType}
User Status: ${loginStatus}

Available Interactive Elements:
${analysis.keyElements.map(el =>
  `- ${el.tag}${el.type ? `[${el.type}]` : ''}: "${el.text}" (selector: ${el.selector})`
).join('\n')}

Suggested Actions: ${analysis.suggestedActions.join(', ')}

IMPORTANT INSTRUCTIONS:
${analysis.isLoggedIn ? `
- The user is LOGGED IN, so focus on demonstrating ACTUAL APP FEATURES
- Avoid signup/waitlist/registration actions since the user is already authenticated
- Prioritize functional interactions that show the app's core value proposition
- Look for navigation menus, feature buttons, data displays, settings, and tools
- Create a logical flow that demonstrates what the app actually does for users
` : `
- The user is NOT LOGGED IN, so focus on exploration and authentication if needed
- You may include signup/login actions if they lead to demonstrating app features
- Focus on showcasing the app's value proposition to encourage signup
`}

Create a logical sequence of interactions that would effectively demonstrate this website's functionality. Each interaction should be meaningful and showcase key features.

Return a JSON array with this format:
[
  {
    "type": "click|type|hover|scroll|wait",
    "selector": "css-selector",
    "text": "text-to-type (only for type interactions)",
    "description": "Human-readable description",
    "reasoning": "Why this interaction is valuable",
    "duration": 3000
  }
]
`;
  }

  /**
   * Create prompt for narration generation
   * @param {Object} interaction - Interaction object
   * @returns {string} Formatted prompt
   */
  createNarrationPrompt(interaction) {
    return `
Create natural narration for this web demo interaction:

Action: ${interaction.type}
Target: ${interaction.selector}
Description: ${interaction.description}
Reasoning: ${interaction.reasoning || 'User interaction'}

Generate a brief, professional narration (1-2 sentences) that explains what's happening in a natural, engaging way. Use present tense and speak as if you're demonstrating the website live.
`;
  }

  /**
   * Generate action suggestions based on page analysis
   * @param {string} pageType - Type of page
   * @param {Array} keyElements - Key interactive elements
   * @returns {Array} Suggested actions
   */
  generateActionSuggestions(pageType, keyElements, isLoggedIn = false) {
    const suggestions = [];
    
    if (isLoggedIn) {
      // Focus on app functionality when logged in
      switch (pageType) {
        case 'dashboard':
        case 'authenticated':
          suggestions.push('Navigate main features', 'Explore dashboard sections', 'Access core functionality', 'View data and analytics');
          break;
        case 'profile':
          suggestions.push('Edit profile information', 'Update account settings', 'Manage preferences');
          break;
        case 'settings':
          suggestions.push('Configure application settings', 'Update preferences', 'Manage account options');
          break;
        default:
          suggestions.push('Explore app features', 'Navigate interface', 'Demonstrate core functionality');
      }
    } else {
      // Standard suggestions for non-authenticated users
      switch (pageType) {
        case 'login':
          suggestions.push('Fill login form', 'Submit credentials');
          break;
        default:
          suggestions.push('Explore navigation', 'Interact with content', 'Demonstrate features');
      }
    }

    // Add element-specific suggestions based on available actions
    keyElements.forEach(el => {
      const text = el.text.toLowerCase();
      if (text.includes('create')) suggestions.push('Create new item');
      if (text.includes('search')) suggestions.push('Perform search');
      if (text.includes('filter')) suggestions.push('Apply filters');
      if (text.includes('manage')) suggestions.push('Manage resources');
      if (text.includes('view')) suggestions.push('View details');
      if (text.includes('edit')) suggestions.push('Edit content');
      if (text.includes('configure')) suggestions.push('Configure settings');
      if (text.includes('dashboard')) suggestions.push('Access dashboard');
      if (text.includes('menu')) suggestions.push('Navigate menu');
    });

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Validate interaction object
   * @param {Object} interaction - Interaction to validate
   * @returns {boolean} True if valid
   */
  validateInteraction(interaction) {
    if (!interaction || typeof interaction !== 'object') {
      return false;
    }

    const { type, selector, description } = interaction;

    // Check required fields
    if (!type || !selector || !description) {
      return false;
    }

    // Check supported interaction type
    if (!this.supportedInteractions.includes(type)) {
      return false;
    }

    // Type-specific validation
    if (type === 'type' && !interaction.text) {
      return false;
    }

    return true;
  }
}
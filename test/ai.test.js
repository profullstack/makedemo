import { expect } from 'chai';
import { AIDecisionMaker } from '../src/ai/decision-maker.js';
import { createLogger } from '../src/utils/logger.js';

describe('AI Decision Maker', () => {
  let aiDecisionMaker;
  let logger;
  let mockPage;

  beforeEach(() => {
    logger = createLogger({ level: 'error', enableFile: false });
    aiDecisionMaker = new AIDecisionMaker({ logger, maxInteractions: 5 });
    
    // Mock Puppeteer page object
    mockPage = {
      url: () => 'https://example.com',
      evaluate: async () => ({
        url: 'https://example.com',
        title: 'Example Page',
        interactiveElements: [
          {
            tag: 'button',
            text: 'Click me',
            selector: 'button:nth-of-type(1)',
            position: { x: 100, y: 200 },
          },
          {
            tag: 'a',
            text: 'Learn more',
            selector: 'a:nth-of-type(1)',
            position: { x: 150, y: 300 },
          },
        ],
      }),
    };
  });

  describe('initialization', () => {
    it('should create AI decision maker with default options', () => {
      const ai = new AIDecisionMaker({ logger });
      
      expect(ai).to.have.property('maxInteractions', 10);
      expect(ai).to.have.property('logger');
    });

    it('should create AI decision maker with custom options', () => {
      const ai = new AIDecisionMaker({ 
        logger, 
        maxInteractions: 3,
        model: 'gpt-4',
      });
      
      expect(ai.maxInteractions).to.equal(3);
      expect(ai.model).to.equal('gpt-4');
    });
  });

  describe('planInteractions', () => {
    it('should generate interaction plan from page state', async () => {
      // Mock OpenAI response
      aiDecisionMaker.openai = {
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify([
                    {
                      type: 'click',
                      selector: 'button:nth-of-type(1)',
                      description: 'Click the main action button',
                      reasoning: 'This appears to be the primary call-to-action',
                      duration: 3000,
                    },
                    {
                      type: 'click',
                      selector: 'a:nth-of-type(1)',
                      description: 'Navigate to learn more section',
                      reasoning: 'This will show additional features',
                      duration: 4000,
                    },
                  ]),
                },
              }],
            }),
          },
        },
      };

      const interactions = await aiDecisionMaker.planInteractions(mockPage);
      
      expect(interactions).to.be.an('array');
      expect(interactions).to.have.length(2);
      expect(interactions[0]).to.have.property('type', 'click');
      expect(interactions[0]).to.have.property('selector');
      expect(interactions[0]).to.have.property('description');
    });

    it('should limit interactions to maxInteractions', async () => {
      const ai = new AIDecisionMaker({ logger, maxInteractions: 1 });
      
      // Mock OpenAI response with multiple interactions
      ai.openai = {
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify([
                    { type: 'click', selector: 'button1', description: 'First' },
                    { type: 'click', selector: 'button2', description: 'Second' },
                    { type: 'click', selector: 'button3', description: 'Third' },
                  ]),
                },
              }],
            }),
          },
        },
      };

      const interactions = await ai.planInteractions(mockPage);
      
      expect(interactions).to.have.length(1);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      aiDecisionMaker.openai = {
        chat: {
          completions: {
            create: async () => {
              throw new Error('API Error');
            },
          },
        },
      };

      try {
        await aiDecisionMaker.planInteractions(mockPage);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate interaction plan');
      }
    });
  });

  describe('generateNarration', () => {
    it('should generate narration for interaction', async () => {
      const interaction = {
        type: 'click',
        selector: 'button',
        description: 'Click the submit button',
        reasoning: 'This will submit the form',
      };

      // Mock OpenAI response
      aiDecisionMaker.openai = {
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: 'Now I\'ll click the submit button to proceed with the form submission.',
                },
              }],
            }),
          },
        },
      };

      const narration = await aiDecisionMaker.generateNarration(interaction);
      
      expect(narration).to.be.a('string');
      expect(narration).to.include('submit button');
    });

    it('should handle narration generation errors', async () => {
      const interaction = {
        type: 'click',
        selector: 'button',
        description: 'Click button',
      };

      aiDecisionMaker.openai = {
        chat: {
          completions: {
            create: async () => {
              throw new Error('Narration API Error');
            },
          },
        },
      };

      try {
        await aiDecisionMaker.generateNarration(interaction);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate narration');
      }
    });
  });

  describe('analyzePageState', () => {
    it('should analyze page state and extract key information', async () => {
      const pageState = {
        url: 'https://example.com/login',
        title: 'Login Page',
        interactiveElements: [
          { tag: 'input', type: 'email', text: '', selector: 'input[type="email"]' },
          { tag: 'input', type: 'password', text: '', selector: 'input[type="password"]' },
          { tag: 'button', text: 'Login', selector: 'button[type="submit"]' },
        ],
      };

      const analysis = aiDecisionMaker.analyzePageState(pageState);
      
      expect(analysis).to.have.property('pageType');
      expect(analysis).to.have.property('keyElements');
      expect(analysis).to.have.property('suggestedActions');
      expect(analysis.keyElements).to.be.an('array');
    });

    it('should identify different page types', async () => {
      const dashboardState = {
        url: 'https://example.com/dashboard',
        title: 'Dashboard',
        interactiveElements: [
          { tag: 'button', text: 'Create New', selector: 'button.create' },
          { tag: 'a', text: 'Settings', selector: 'a.settings' },
        ],
      };

      const analysis = aiDecisionMaker.analyzePageState(dashboardState);
      
      expect(analysis.pageType).to.not.equal('login');
    });
  });

  describe('validateInteraction', () => {
    it('should validate correct interaction format', () => {
      const interaction = {
        type: 'click',
        selector: 'button',
        description: 'Click button',
        reasoning: 'User needs to submit',
        duration: 2000,
      };

      const isValid = aiDecisionMaker.validateInteraction(interaction);
      
      expect(isValid).to.be.true;
    });

    it('should reject invalid interaction types', () => {
      const interaction = {
        type: 'invalid-type',
        selector: 'button',
        description: 'Invalid action',
      };

      const isValid = aiDecisionMaker.validateInteraction(interaction);
      
      expect(isValid).to.be.false;
    });

    it('should reject interactions without required fields', () => {
      const interaction = {
        type: 'click',
        // missing selector and description
      };

      const isValid = aiDecisionMaker.validateInteraction(interaction);
      
      expect(isValid).to.be.false;
    });
  });
});
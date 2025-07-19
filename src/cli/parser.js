import { Command } from 'commander';

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed command and options
 */
export function parseArguments(args) {
  const program = new Command();
  
  program
    .name('mkdemo')
    .description('CLI tool for generating high-quality web demo MP4 videos')
    .version('1.0.0');

  program
    .command('create')
    .description('Create a demo video from a website')
    .requiredOption('-u, --user <email>', 'User email for authentication')
    .requiredOption('-p, --password <password>', 'User password for authentication')
    .requiredOption('--url <url>', 'Website URL to create demo from')
    .option('-o, --output <directory>', 'Output directory for generated files', './output')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('--max-interactions <number>', 'Maximum number of interactions', '10')
    .option('--headless', 'Run browser in headless mode', true)
    .action((options, command) => {
      // Store the parsed result for return
      command.parent._parsedResult = {
        command: 'create',
        options,
      };
    });

  // Parse the arguments
  try {
    program.parse(args, { from: 'user' });
    
    // Return the parsed result if available
    if (program._parsedResult) {
      return program._parsedResult;
    }
    
    // If no command was matched, throw an error
    if (args.length > 0) {
      throw new Error(`Unknown command: ${args[0]}`);
    }
    
    return { command: null, options: {} };
  } catch (error) {
    if (error.message.includes('Unknown command')) {
      throw error;
    }
    // Re-throw commander errors
    throw new Error(error.message);
  }
}

/**
 * Validate parsed options for a given command
 * @param {string} command - The command to validate options for
 * @param {Object} options - The options to validate
 * @throws {Error} If validation fails
 */
export function validateOptions(command, options) {
  if (command === 'create') {
    validateCreateOptions(options);
  }
}

/**
 * Validate options for the create command
 * @param {Object} options - Options to validate
 * @throws {Error} If validation fails
 */
function validateCreateOptions(options) {
  const requiredFields = ['user', 'password', 'url'];
  
  // Check for required fields
  for (const field of requiredFields) {
    if (!options[field]) {
      throw new Error(`Missing required option: ${field}`);
    }
  }
  
  // Validate email format
  if (!isValidEmail(options.user)) {
    throw new Error('Invalid email format for user');
  }
  
  // Validate URL format
  if (!isValidUrl(options.url)) {
    throw new Error('Invalid URL format');
  }
  
  // Validate max interactions if provided
  if (options.maxInteractions) {
    const maxInt = parseInt(options.maxInteractions, 10);
    if (isNaN(maxInt) || maxInt < 1 || maxInt > 20) {
      throw new Error('Max interactions must be a number between 1 and 20');
    }
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL format
 */
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}
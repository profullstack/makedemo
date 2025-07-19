#!/usr/bin/env node

import { parseArguments, validateOptions } from './parser.js';
import { createDemo } from '../index.js';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Main CLI entry point
 */
async function main() {
  try {
    // Parse command line arguments
    const { command, options } = parseArguments(process.argv.slice(2));
    
    if (!command) {
      console.log(chalk.yellow('No command provided. Use --help for usage information.'));
      process.exit(1);
    }
    
    // Validate options
    validateOptions(command, options);
    
    if (command === 'create') {
      await handleCreateCommand(options);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    
    if (options?.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

/**
 * Handle the create command
 * @param {Object} options - Parsed command options
 */
async function handleCreateCommand(options) {
  const spinner = ora('Initializing mkdemo...').start();
  
  try {
    spinner.text = 'Creating demo video...';
    
    const result = await createDemo({
      user: options.user,
      password: options.password,
      url: options.url,
      outputDir: options.output || './output',
      verbose: options.verbose || false,
      maxInteractions: parseInt(options.maxInteractions || '10', 10),
      headless: options.headless !== false,
    });
    
    spinner.succeed(chalk.green('Demo video created successfully!'));
    
    console.log(chalk.blue('\nOutput files:'));
    console.log(chalk.gray(`  Video: ${result.videoPath}`));
    console.log(chalk.gray(`  Transcript: ${result.transcriptPath}`));
    console.log(chalk.gray(`  Log: ${result.logPath}`));
    
    console.log(chalk.green('\n✨ Demo generation complete!'));
  } catch (error) {
    spinner.fail(chalk.red('Demo creation failed'));
    throw error;
  }
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
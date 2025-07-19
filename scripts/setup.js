#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Setup script for mkdemo project
 */
async function setup() {
  console.log(chalk.blue('🚀 Setting up mkdemo project...\n'));

  try {
    // Check if .env file exists
    await checkEnvironmentFile();
    
    // Create output directory
    await createOutputDirectory();
    
    // Verify dependencies
    await verifyDependencies();
    
    // Display next steps
    displayNextSteps();
    
    console.log(chalk.green('\n✅ Setup completed successfully!'));
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Check if .env file exists and create from template if not
 */
async function checkEnvironmentFile() {
  const envPath = path.join(projectRoot, '.env');
  const envExamplePath = path.join(projectRoot, '.env.example');
  
  try {
    await fs.access(envPath);
    console.log(chalk.green('✓ .env file exists'));
  } catch {
    console.log(chalk.yellow('⚠ .env file not found, creating from template...'));
    
    try {
      const envExample = await fs.readFile(envExamplePath, 'utf8');
      await fs.writeFile(envPath, envExample);
      console.log(chalk.green('✓ .env file created from template'));
      console.log(chalk.yellow('  Please edit .env file with your API keys'));
    } catch (error) {
      throw new Error(`Failed to create .env file: ${error.message}`);
    }
  }
}

/**
 * Create output directory if it doesn't exist
 */
async function createOutputDirectory() {
  const outputDir = path.join(projectRoot, 'output');
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(chalk.green('✓ Output directory ready'));
  } catch (error) {
    throw new Error(`Failed to create output directory: ${error.message}`);
  }
}

/**
 * Verify that required dependencies are installed
 */
async function verifyDependencies() {
  console.log(chalk.blue('Checking dependencies...'));
  
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    // Check if node_modules exists
    try {
      await fs.access(path.join(projectRoot, 'node_modules'));
      console.log(chalk.green('✓ Dependencies installed'));
    } catch {
      console.log(chalk.yellow('⚠ Dependencies not installed'));
      console.log(chalk.blue('  Run: pnpm install'));
    }
    
    // Check for critical dependencies
    const criticalDeps = ['puppeteer', 'openai', 'elevenlabs', 'fluent-ffmpeg'];
    const missingDeps = criticalDeps.filter(dep => !dependencies[dep]);
    
    if (missingDeps.length > 0) {
      console.log(chalk.red(`✗ Missing critical dependencies: ${missingDeps.join(', ')}`));
    } else {
      console.log(chalk.green('✓ All critical dependencies present'));
    }
  } catch (error) {
    throw new Error(`Failed to verify dependencies: ${error.message}`);
  }
}

/**
 * Display next steps for the user
 */
function displayNextSteps() {
  console.log(chalk.blue('\n📋 Next Steps:'));
  console.log(chalk.white('1. Edit .env file with your API keys:'));
  console.log(chalk.gray('   - OPENAI_API_KEY (required)'));
  console.log(chalk.gray('   - ELEVENLABS_API_KEY (required)'));
  console.log(chalk.gray('   - ELEVENLABS_VOICE_ID (optional)'));
  
  console.log(chalk.white('\n2. Install dependencies (if not already done):'));
  console.log(chalk.gray('   pnpm install'));
  
  console.log(chalk.white('\n3. Test the installation:'));
  console.log(chalk.gray('   pnpm test'));
  
  console.log(chalk.white('\n4. Run your first demo:'));
  console.log(chalk.gray('   mkdemo create --user your@email.com --password yourpass --url https://example.com'));
  
  console.log(chalk.white('\n5. For help:'));
  console.log(chalk.gray('   mkdemo --help'));
}

/**
 * Check system requirements
 */
async function checkSystemRequirements() {
  console.log(chalk.blue('Checking system requirements...'));
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 20) {
    console.log(chalk.green(`✓ Node.js ${nodeVersion} (>= 20.0.0)`));
  } else {
    console.log(chalk.red(`✗ Node.js ${nodeVersion} (requires >= 20.0.0)`));
    throw new Error('Node.js 20 or newer is required');
  }
  
  // Check for FFmpeg (optional but recommended)
  try {
    const { execSync } = await import('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
    console.log(chalk.green('✓ FFmpeg available'));
  } catch {
    console.log(chalk.yellow('⚠ FFmpeg not found (required for video processing)'));
    console.log(chalk.gray('  Install FFmpeg: https://ffmpeg.org/download.html'));
  }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup();
}

export { setup };
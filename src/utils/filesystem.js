import fs from 'fs/promises';
import path from 'path';

/**
 * Ensure that the output directory exists, creating it if necessary
 * @param {string} outputDir - Path to the output directory
 * @throws {Error} If directory creation fails
 */
export async function ensureOutputDirectory(outputDir) {
  try {
    await fs.access(outputDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      await fs.mkdir(outputDir, { recursive: true });
    } else {
      // Some other error occurred
      throw new Error(`Failed to access output directory: ${error.message}`);
    }
  }
}

/**
 * Generate a unique filename with timestamp
 * @param {string} baseName - Base name for the file
 * @param {string} extension - File extension (with or without dot)
 * @returns {string} Unique filename with timestamp
 */
export function generateTimestampedFilename(baseName, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${baseName}_${timestamp}${ext}`;
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 * @param {string} filePath - Path to the file
 * @returns {Promise<number>} File size in bytes
 * @throws {Error} If file doesn't exist or can't be accessed
 */
export async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new Error(`Failed to get file size for ${filePath}: ${error.message}`);
  }
}

/**
 * Clean up temporary files
 * @param {string[]} filePaths - Array of file paths to delete
 * @param {Object} logger - Logger instance (optional)
 */
export async function cleanupFiles(filePaths, logger = null) {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
      results.push({ path: filePath, success: true });
      logger?.debug(`Cleaned up file: ${filePath}`);
    } catch (error) {
      results.push({ path: filePath, success: false, error: error.message });
      logger?.warn(`Failed to cleanup file ${filePath}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Create a safe filename by removing/replacing invalid characters
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
export function createSafeFilename(filename) {
  // Replace invalid characters with underscores
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Get the absolute path for a given relative path
 * @param {string} relativePath - Relative path
 * @returns {string} Absolute path
 */
export function getAbsolutePath(relativePath) {
  return path.resolve(relativePath);
}

/**
 * Ensure a directory exists and is writable
 * @param {string} dirPath - Directory path
 * @throws {Error} If directory is not writable
 */
export async function ensureWritableDirectory(dirPath) {
  await ensureOutputDirectory(dirPath);
  
  try {
    // Test write access by creating a temporary file
    const testFile = path.join(dirPath, '.write_test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
  } catch (error) {
    throw new Error(`Directory ${dirPath} is not writable: ${error.message}`);
  }
}
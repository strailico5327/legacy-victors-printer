const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('Missing dependency: sharp');
  console.error('Install it first with: npm install --save-dev sharp');
  process.exit(1);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const BLOCKED_DIR_NAMES = new Set([
  '.git',
  '.deploy_git',
  '.temp',
  '.cache',
  'cache',
  'node_modules',
  'public',
]);

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function relativePath(filePath) {
  return path.relative(PROJECT_ROOT, filePath);
}

function isInsideProject(filePath) {
  const relative = path.relative(PROJECT_ROOT, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function isBlockedPath(filePath) {
  return filePath
    .split(path.sep)
    .some((part) => BLOCKED_DIR_NAMES.has(part.toLowerCase()));
}

function parseDraggedPaths(input) {
  const matches = input.match(/"[^"]+"|'[^']+'|\S+/g) || [];

  return matches.map((item) => {
    const trimmed = item.trim();

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptions() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const resizeInput = await ask(rl, 'Resize percentage, for example 50: ');
    const qualityInput = await ask(rl, 'WebP quality, 0 to 100: ');
    const pathsInput = await ask(rl, 'Drag image file(s) here, then press Enter: ');

    const resizePercentage = Number(resizeInput);
    const quality = Number(qualityInput);
    const filePaths = parseDraggedPaths(pathsInput);

    if (!Number.isFinite(resizePercentage) || resizePercentage <= 0 || resizePercentage > 100) {
      throw new Error('Resize percentage must be greater than 0 and no more than 100.');
    }

    if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
      throw new Error('WebP quality must be an integer from 0 to 100.');
    }

    if (filePaths.length === 0) {
      throw new Error('No image files were provided.');
    }

    return { resizePercentage, quality, filePaths };
  } finally {
    rl.close();
  }
}

async function convertImage(inputPath, options, summary) {
  const filePath = path.resolve(inputPath);

  if (!isInsideProject(filePath)) {
    summary.skipped.push({ filePath, reason: 'outside project' });
    return;
  }

  if (isBlockedPath(filePath)) {
    summary.skipped.push({ filePath, reason: 'blocked path' });
    return;
  }

  if (!(await exists(filePath))) {
    summary.skipped.push({ filePath, reason: 'file does not exist' });
    return;
  }

  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    summary.skipped.push({ filePath, reason: 'not a file' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.webp') {
    summary.skipped.push({ filePath, reason: 'already WebP' });
    return;
  }

  if (!IMAGE_EXTENSIONS.has(ext)) {
    summary.skipped.push({ filePath, reason: 'not jpg, jpeg, or png' });
    return;
  }

  const baseName = path.basename(filePath, ext);

  if (baseName.toLowerCase().includes('_thumb')) {
    summary.skipped.push({ filePath, reason: 'thumbnail source name' });
    return;
  }

  const outputPath = path.join(path.dirname(filePath), `${baseName}_thumb.webp`);

  if (await exists(outputPath)) {
    summary.skipped.push({ filePath, reason: 'thumbnail already exists' });
    return;
  }

  try {
    const metadata = await sharp(filePath).metadata();

    if (!metadata.width) {
      throw new Error('Could not read image width.');
    }

    const width = Math.max(1, Math.round(metadata.width * (options.resizePercentage / 100)));

    await sharp(filePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: options.quality })
      .toFile(outputPath);

    summary.converted.push(outputPath);
  } catch (error) {
    summary.failed.push({ filePath, error });
  }
}

async function main() {
  const options = await readOptions();
  const summary = {
    converted: [],
    skipped: [],
    failed: [],
  };

  for (const filePath of options.filePaths) {
    await convertImage(filePath, options, summary);
  }

  console.log('');
  console.log('Summary');
  console.log(`Converted: ${summary.converted.length}`);
  console.log(`Skipped: ${summary.skipped.length}`);
  console.log(`Failed: ${summary.failed.length}`);

  if (summary.converted.length > 0) {
    console.log('');
    console.log('Output paths:');
    for (const outputPath of summary.converted) {
      console.log(`- ${relativePath(outputPath)}`);
    }
  }

  if (summary.skipped.length > 0) {
    console.log('');
    console.log('Skipped files:');
    for (const item of summary.skipped) {
      console.log(`- ${relativePath(item.filePath)}: ${item.reason}`);
    }
  }

  if (summary.failed.length > 0) {
    console.log('');
    console.log('Failed files:');
    for (const item of summary.failed) {
      console.log(`- ${relativePath(item.filePath)}: ${item.error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
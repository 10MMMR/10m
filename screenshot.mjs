import { chromium } from 'playwright';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.cwd(), 'temporary-screenshots');
const screenshotPattern = /^screenshot-(\d+)(?:-[^.]+)?\.png$/;

function usage() {
  console.error('Usage: node screenshot.mjs <url> [label] [mobile]');
  process.exit(1);
}

function parseArgs() {
  const [, , url, label, viewportPreset] = process.argv;

  if (!url) {
    usage();
  }

  return { url, label, viewportPreset };
}

function sanitizeLabel(label) {
  if (!label) {
    return '';
  }

  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getNextIndex(dir) {
  try {
    const files = await readdir(dir);
    let maxIndex = 0;

    for (const file of files) {
      const match = file.match(screenshotPattern);
      if (!match) {
        continue;
      }

      maxIndex = Math.max(maxIndex, Number(match[1]));
    }

    return maxIndex + 1;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return 1;
    }

    throw error;
  }
}

async function waitForRender(page) {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(250);
}

async function main() {
  const { url, label, viewportPreset } = parseArgs();
  const safeLabel = sanitizeLabel(label);
  const isMobile = viewportPreset === 'mobile';

  await mkdir(outputDir, { recursive: true });

  const index = await getNextIndex(outputDir);
  const filename = safeLabel
    ? `screenshot-${index}-${safeLabel}.png`
    : `screenshot-${index}.png`;
  const filepath = path.join(outputDir, filename);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForRender(page);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(filepath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

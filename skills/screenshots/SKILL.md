---
name: screenshots
description: Generate PDF with screenshots of all environment web UI pages
allowed-tools: Bash(node *), Bash(npx *), Bash(lsof *), Bash(mkdir *), Bash(mv *), Bash(rm *), Bash(cd * && *), Bash(sleep *), Bash(nohup *), Write, Read
---

# Generate UI Screenshots PDF

Capture screenshots of all environment web interface pages and combine into a PDF.

## Configuration

Read from `marketplace.json`:
- **Port**: 3848
- **Server**: server.js
- **Pages**: Dashboard, Agents, Skills, Commands, Knowledge, Rules, Plugins, MCP Servers, Memory, Settings

## Instructions

### Step 1: Check if Server is Running

```bash
lsof -i :3848 -t 2>/dev/null || echo "not_running"
```

If "not_running", start the server:

```bash
nohup node ~/.claude/plugins/local/env-ui/server.js > /dev/null 2>&1 &
sleep 2
```

### Step 2: Create Screenshot Script

Write the following script to `/tmp/environment-screenshots.mjs`:

```javascript
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

const PORT = 3848;
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = '/tmp/environment-screens';

const PAGES = [
  { name: 'Dashboard', route: '/' },
  { name: 'Agents', route: '/#/agents' },
  { name: 'Skills', route: '/#/skills' },
  { name: 'Commands', route: '/#/commands' },
  { name: 'Knowledge', route: '/#/knowledge' },
  { name: 'Rules', route: '/#/rules' },
  { name: 'Plugins', route: '/#/plugins' },
  { name: 'MCP-Servers', route: '/#/mcp-servers' },
  { name: 'Memory', route: '/#/memory' },
  { name: 'Settings', route: '/#/settings' }
];

async function captureScreenshots() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  const screenshots = [];

  for (const { name, route } of PAGES) {
    const url = `${BASE_URL}${route}`;
    console.log(`Capturing: ${name} (${url})`);

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500); // Allow animations to settle

    const path = `${OUTPUT_DIR}/${name}.png`;
    await page.screenshot({ path, fullPage: true });
    screenshots.push({ name, path });
  }

  await browser.close();
  return screenshots;
}

async function createPDF(screenshots) {
  const pdfDoc = await PDFDocument.create();

  for (const { name, path } of screenshots) {
    console.log(`Adding to PDF: ${name}`);
    const imageBytes = await fs.readFile(path);
    const image = await pdfDoc.embedPng(imageBytes);

    // Scale to fit page while maintaining aspect ratio
    const { width, height } = image;
    const pageWidth = 1920;
    const pageHeight = Math.max(height, 1080);

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: 0,
      y: pageHeight - height,
      width,
      height
    });
  }

  const pdfBytes = await pdfDoc.save();
  const outputPath = process.env.HOME + '/.claude/plugins/local/env-ui/screenshots/environment-screenshots.pdf';
  await fs.mkdir(process.env.HOME + '/.claude/plugins/local/env-ui/screenshots', { recursive: true });
  await fs.writeFile(outputPath, pdfBytes);
  console.log('PDF created: ' + outputPath);
}

async function main() {
  try {
    const screenshots = await captureScreenshots();
    await createPDF(screenshots);

    // Cleanup screenshots
    await fs.rm(OUTPUT_DIR, { recursive: true });

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
```

### Step 3: Install Dependencies and Run

```bash
cd /tmp && npm init -y 2>/dev/null
npm install playwright pdf-lib --silent
npx playwright install chromium 2>/dev/null || true
node environment-screenshots.mjs
```

### Step 4: Cleanup Temp Files

```bash
rm -f /tmp/environment-screenshots.mjs /tmp/package.json /tmp/package-lock.json
```

## Output

The PDF will be saved to: `~/.claude/plugins/local/env-ui/screenshots/environment-screenshots.pdf`

Report the file location and size to the user when complete.

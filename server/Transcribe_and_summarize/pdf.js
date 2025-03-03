import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureDirectoryExists } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a PDF from content
 * @param {string} content - Content to include in PDF
 * @returns {Promise<string>} - Path to generated PDF
 */
export async function generatePDF(content) {
  try {
    console.log('Generating PDF...');
    
    const tempDir = path.join(__dirname, '..', 'temp');
    ensureDirectoryExists(tempDir);
    
    const outputPath = path.join(tempDir, `summary_${Date.now()}.pdf`);
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(`
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              direction: rtl;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <pre>${content}</pre>
        </body>
      </html>
    `);
    
    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px'
      }
    });
    
    await browser.close();
    
    console.log(`PDF generated at: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
} 
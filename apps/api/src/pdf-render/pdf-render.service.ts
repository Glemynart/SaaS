import {
  Injectable,
  Logger,
  OnModuleDestroy,
  InternalServerErrorException,
} from '@nestjs/common';
import * as fs from 'fs';

type PuppeteerModule = typeof import('puppeteer');
type Browser = Awaited<ReturnType<PuppeteerModule['launch']>>;

@Injectable()
export class PdfRenderService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderService.name);
  private browser: Browser | null = null;

  async renderPdf(html: string): Promise<Buffer> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfBytes = await page.pdf({
        format: 'A4',
        margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' },
        printBackground: true,
      });
      return Buffer.from(pdfBytes);
    } finally {
      await page.close().catch((err: unknown) => {
        this.logger.warn(`No se pudo cerrar la página: ${String(err)}`);
      });
    }
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    await this.closeBrowser();
    this.browser = await this.launchBrowser();
    return this.browser;
  }

  private async launchBrowser(): Promise<Browser> {
    const puppeteer = await import('puppeteer');
    try {
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch {
      const executablePath = this.findChromePath();
      if (!executablePath) {
        throw new InternalServerErrorException(
          'No se encontró un navegador compatible para generar PDFs',
        );
      }
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath,
      });
    }
  }

  private async closeBrowser(): Promise<void> {
    if (!this.browser) return;
    try {
      await this.browser.close();
    } catch (err: unknown) {
      this.logger.warn(`No se pudo cerrar el browser: ${String(err)}`);
    }
    this.browser = null;
  }

  private findChromePath(): string | undefined {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }
}

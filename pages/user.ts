import { Page, BrowserContext, chromium, Browser } from '@playwright/test';
import { Office, IDocumentEditor } from './office';

const BROWSER_ARGS = [
    '--disable-features=LocalNetworkAccessChecks',
    '--block-insecure-private-network-requests=false',
    '--deny-permission-prompts',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
];

export class User {
    // Backing fields are undefined until initialize() is called.
    // Use ensurePage() / ensureOffice() inside methods; expose `page` as
    // Page | undefined so external guards (e.g. `if (!user.page)`) keep working.
    private _page?: Page;
    private _context?: BrowserContext;
    private _browser?: Browser;
    private _office?: Office;

    public get page(): Page | undefined { return this._page; }

    public readonly userName: string;
    public readonly password: string;
    public readonly baseUrl: string;
    public readonly section: string;
    public readonly fileType: 'docx' | 'pptx' | 'xlsx';

    private get homeUrl(): string {
        return `${this.baseUrl}/neWeb2/home`;
    }

    private ensurePage(): Page {
        if (!this._page) throw new Error(`[${this.userName}] Not initialized. Call initialize() first.`);
        return this._page;
    }

    private ensureOffice(): Office {
        if (!this._office) throw new Error(`[${this.userName}] Not initialized. Call initialize() first.`);
        return this._office;
    }

    /** Returns the IDocumentEditor for this user's file type. */
    private editor(): IDocumentEditor {
        return this.ensureOffice().getEditor(this.fileType);
    }

    constructor(userName: string, password: string, baseUrl: string, section: string, fileType: 'docx' | 'pptx' | 'xlsx' = 'docx') {
        this.userName = userName;
        this.password = password;
        this.baseUrl = baseUrl;
        this.section = section;
        this.fileType = fileType;
    }

    async initialize(headless: boolean = true): Promise<void> {
        const args = headless ? BROWSER_ARGS : [...BROWSER_ARGS, '--start-maximized'];
        this._browser = await chromium.launch({ headless, args });
        this._context = await this._browser.newContext({ viewport: { width: 1920, height: 1080 } });
        this._page = await this._context.newPage();
        this._office = new Office(this._page);
    }

    async login(): Promise<void> {
        const page = this.ensurePage();
        await page.goto(this.baseUrl);
        await page.locator('#username').fill(this.userName);
        await page.locator('#password').fill(this.password);
        await page.locator('#loginBtn').click();
        // waitForURL throws if the URL doesn't match — no second check needed
        await page.waitForURL(this.homeUrl, { timeout: 60000 });
    }

    async openDocument(docEnvId: string, maxRetries: number = 3): Promise<void> {
        const page = this.ensurePage();
        const url = `${this.baseUrl}/neWeb2/app/wopiEditor.aspx?envPath=${docEnvId}&docNum=1&verNum=1&mode=edit`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75000 });

            try {
                await this.ensureOffice().waitForFrameAttached(30000);
                await this.waitForDocumentLoaded();
            } catch {
                if (attempt < maxRetries) {
                    console.log(`[${this.userName}] Document not ready, reloading (attempt ${attempt}/${maxRetries})...`);
                    continue;
                } else {
                    throw new Error(`[${this.userName}] Document not ready after ${maxRetries} attempts`);
                }
            }

            // DOCX-specific: check for slideout addin and handle it.
            if (this.fileType === 'docx') {
                const office = this.ensureOffice();
                const officeForm = page.locator('#office_form');
                const action = await officeForm.getAttribute('action');
                const oldWopi = action?.includes('wopi-') ?? false;

                const isVisible = await office.isSlideoutVisible();
                if (!isVisible) {
                    console.log(`[${this.userName}] Slideout not visible`);
                }

                if (isVisible && !oldWopi) {
                    await office.closeAddin();
                }
            }

            return;
        }
    }

    async goToHome(maxRetries: number = 3): Promise<void> {
        const page = this.ensurePage();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await page.goto(this.baseUrl, { timeout: 60000 });
                await page.waitForURL(this.homeUrl, { timeout: 60000 });
                return;
            } catch {
                if (attempt === maxRetries) throw new Error(`[${this.userName}] Could not navigate to home after ${maxRetries} attempts`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    async getTextFromSection(sectionToCheck: string): Promise<string> {
        const text = await this.editor().getTextFromSection(sectionToCheck);
        // DOCX needs an additional cursor-move to avoid leaving focus in the paragraph.
        if (this.fileType === 'docx') {
            await this.ensureOffice().moveOutCursor(this.section);
        }
        return text;
    }

    async verifyText(sectionToCheck: string, expectedText: string): Promise<void> {
        await this.editor().verifyText(sectionToCheck, expectedText);
    }

    async verifySectionsText(oldValues: Array<[string, string]>): Promise<boolean> {
        for (const [section, expectedText] of oldValues) {
            const actualText = await this.getTextFromSection(section);
            if (actualText !== expectedText) return false;
        }
        return true;
    }

    async editDocAsync(newText: string, i: number): Promise<void> {
        await this.editor().editSection(this.section, newText, i);
        await this.editor().waitToBeSaved();
    }

    async waitForDocumentLoaded(timeout: number = 65000): Promise<void> {
        // `timeout` is only used by the DOCX path; PPT and XLSX have internal timeouts.
        if (this.fileType === 'docx') {
            await this.ensureOffice().waitForDocumentLoaded(timeout);
        } else {
            await this.editor().waitForReady();
        }
    }

    async close(): Promise<void> {
        if (this._page) await this._page.close();
        if (this._context) await this._context.close();
        if (this._browser) await this._browser.close();
    }
}

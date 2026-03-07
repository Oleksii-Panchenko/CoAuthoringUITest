import { Page, BrowserContext, chromium, Browser } from '@playwright/test';
import { Office, IDocumentEditor } from './office';
import { FileType } from '../infrastructure/test-data';

const BROWSER_ARGS = [
    '--disable-features=LocalNetworkAccessChecks',
    '--block-insecure-private-network-requests=false',
    '--deny-permission-prompts',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
];

// ─── UserSession — browser lifecycle ─────────────────────────────────────────

export class UserSession {
    readonly user: User;
    private readonly _browser: Browser;
    private readonly _context: BrowserContext;

    private constructor(user: User, browser: Browser, context: BrowserContext) {
        this.user = user;
        this._browser = browser;
        this._context = context;
    }

    static async create(
        userName: string,
        password: string,
        baseUrl: string,
        section: string,
        fileType: FileType,
        headless: boolean = true,
    ): Promise<UserSession> {
        const args = headless ? BROWSER_ARGS : [...BROWSER_ARGS, '--start-maximized'];
        const browser = await chromium.launch({ headless, args });
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();
        const user = new User(page, userName, password, baseUrl, section, fileType);
        return new UserSession(user, browser, context);
    }

    async close(): Promise<void> {
        await this.user.page.close();
        await this._context.close();
        await this._browser.close();
    }
}

// ─── User — page-object ───────────────────────────────────────────────────────

export class User {
    readonly page: Page;
    readonly userName: string;
    readonly password: string;
    readonly baseUrl: string;
    readonly section: string;
    readonly fileType: FileType;

    private readonly _office: Office;

    private get homeUrl(): string {
        return `${this.baseUrl}/neWeb2/home`;
    }

    /** Returns the IDocumentEditor for this user's file type. */
    private editor(): IDocumentEditor {
        return this._office.getEditor(this.fileType);
    }

    constructor(page: Page, userName: string, password: string, baseUrl: string, section: string, fileType: FileType = 'docx') {
        this.page = page;
        this.userName = userName;
        this.password = password;
        this.baseUrl = baseUrl;
        this.section = section;
        this.fileType = fileType;
        this._office = new Office(page);
    }

    async login(): Promise<void> {
        await this.page.goto(this.baseUrl);
        await this.page.locator('#username').fill(this.userName);
        await this.page.locator('#password').fill(this.password);
        await this.page.locator('#loginBtn').click();
        await this.page.waitForURL(this.homeUrl, { timeout: 60000 });
    }

    async openDocument(docEnvId: string, maxRetries: number = 3): Promise<void> {
        const url = `${this.baseUrl}/neWeb2/app/wopiEditor.aspx?envPath=${docEnvId}&docNum=1&verNum=1&mode=edit`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75000 });

            try {
                await this._office.waitForFrameAttached(30000);
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
                const officeForm = this.page.locator('#office_form');
                const action = await officeForm.getAttribute('action');
                const oldWopi = action?.includes('wopi-') ?? false;

                const isVisible = await this._office.isSlideoutVisible();
                if (!isVisible) {
                    console.log(`[${this.userName}] Slideout not visible`);
                }

                if (isVisible && !oldWopi) {
                    await this._office.closeAddin();
                }
            }

            return;
        }
    }

    async goToHome(maxRetries: number = 3): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.page.goto(this.baseUrl, { timeout: 60000 });
                await this.page.waitForURL(this.homeUrl, { timeout: 60000 });
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
            await this._office.moveOutCursor(this.section);
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

    async editDoc(newText: string, i: number): Promise<void> {
        await this.editor().editSection(this.section, newText, i);
        await this.editor().waitToBeSaved();
    }

    async waitForDocumentLoaded(timeout: number = 65000): Promise<void> {
        // `timeout` is only used by the DOCX path; PPT and XLSX have internal timeouts.
        if (this.fileType === 'docx') {
            await this._office.waitForDocumentLoaded(timeout);
        } else {
            await this.editor().waitForReady();
        }
    }
}

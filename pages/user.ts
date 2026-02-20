import { Page, BrowserContext, chromium, Browser, expect } from '@playwright/test';
import { Office } from './office';

const BROWSER_ARGS = [
    '--disable-features=LocalNetworkAccessChecks',
    '--block-insecure-private-network-requests=false',
    '--deny-permission-prompts',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
];

export class User {
    public page!: Page;
    public context!: BrowserContext;
    public browser!: Browser;
    public readonly userName: string;
    public readonly password: string;
    public readonly baseUrl: string;
    public readonly section: string;
    public office!: Office;

    // "Allow and Continue" slideout button — distinct from the task pane close button in Office
    private readonly allowAndContinueLocator = 'xpath=//div[@id="FarPaneRegion"]//button[text()="Allow and Continue"]';

    constructor(userName: string, password: string, baseUrl: string, section: string) {
        this.userName = userName;
        this.password = password;
        this.baseUrl = baseUrl;
        this.section = section;
    }

    async initialize(headless: boolean = true): Promise<void> {
        const args = headless ? BROWSER_ARGS : [...BROWSER_ARGS, '--start-maximized'];
        this.browser = await chromium.launch({ headless, args });
        this.context = await this.browser.newContext({ viewport: { width: 1920, height: 1080 } });
        this.page = await this.context.newPage();
        this.office = new Office(this.page);
    }

    async login(): Promise<boolean> {
        await this.page.goto(this.baseUrl);
        await this.page.locator('#username').fill(this.userName);
        await this.page.locator('#password').fill(this.password);
        await this.page.locator('#loginBtn').click();
        await this.page.waitForURL(`${this.baseUrl}/neWeb2/home`, { timeout: 60000 });
        return this.page.url() === `${this.baseUrl}/neWeb2/home`;
    }

    async openDocument(docEnvId: string, maxRetries: number = 3): Promise<void> {
        const url = `${this.baseUrl}/neWeb2/app/wopiEditor.aspx?envPath=${docEnvId}&docNum=1&verNum=1&mode=edit`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let isVisible = false;

            await this.page.goto(url, { waitUntil: 'load' });
            await this.waitForDocumentLoaded();

            try {
                await this.office.waitForFrameAttached(10000);
            } catch {
                if (attempt < maxRetries) {
                    console.log(`[${this.userName}] Office frame not present, reloading (attempt ${attempt}/${maxRetries})...`);
                    await this.page.reload({ waitUntil: 'load', timeout: 30000 });
                    await this.waitForDocumentLoaded();
                    continue;
                } else {
                    console.log(`[${this.userName}] Office frame not found after ${maxRetries} attempts`);
                }
            }

            const officeForm = this.page.locator('#office_form');
            const action = await officeForm.getAttribute('action');
            const oldWopi = action?.includes('wopi-') || false;
            const closeButton = this.page.frameLocator('#office_frame').locator(this.allowAndContinueLocator);

            try {
                let i = 0;
                await expect(async () => {
                    if (i !== 0) {
                        await this.page.reload({ waitUntil: 'load', timeout: 30000 });
                        await this.waitForDocumentLoaded();
                    }
                    await expect(closeButton).toBeVisible({ timeout: 10000 });
                    i++;
                }).toPass({
                    intervals: [10_000],
                    timeout: 200_000
                });
                isVisible = true;
            } catch {
                console.log(`[${this.userName}] Slideout not visible`);
                isVisible = false;
            }

            if (isVisible && !oldWopi) {
                await this.office.closeAddin();
            }

            return;
        }
    }

    async goToHome(): Promise<void> {
        await this.page.goto(this.baseUrl);
        await this.page.waitForURL(`${this.baseUrl}/neWeb2/home`, { timeout: 60000 });
    }

    async getTextFromSection(sectionToCheck: string): Promise<string> {
        const text = await this.office.getTextFromSection(sectionToCheck);
        await this.office.moveOutCursor(this.section);
        return text;
    }

    async verifyText(sectionToCheck: string, expectedText: string): Promise<void> {
        await this.office.verifyText(sectionToCheck, expectedText);
    }

    async verifySectionsText(oldValues: Array<[string, string]>): Promise<boolean> {
        for (const [section, expectedText] of oldValues) {
            const actualText = await this.getTextFromSection(section);
            if (actualText !== expectedText) return false;
        }
        return true;
    }

    async editDocAsync(newText: string): Promise<void> {
        await this.office.editDocAsync(this.section, newText);
        await this.office.moveOutCursor(this.section);
        await this.office.waitToBeSaved();
    }

    async waitForDocumentLoaded(timeout: number = 65000): Promise<void> {
        await this.office.waitForDocumentLoaded(timeout);
    }

    async close(): Promise<void> {
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();
    }
}

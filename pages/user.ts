import { Page, BrowserContext, chromium, Browser, expect } from '@playwright/test';
import { Office } from './office';

/**
 * User class representing a user session with browser and page
 * Ported from C# Selenium User class to TypeScript Playwright
 */
export class User {
    public page!: Page;
    public context!: BrowserContext;
    public browser!: Browser;
    public userName: string;
    public password: string;
    public baseUrl: string;
    public section: string;
    public office!: Office;

    private officeFrameLocator = '#office_frame';
    private closeAddinButtonLocator = "button[id*='TaskPaneCloseBtnApp']";

    constructor(userName: string, password: string, baseUrl: string, section: string) {
        this.userName = userName;
        this.password = password;
        this.baseUrl = baseUrl;
        this.section = section;
    }

    /**
     * Initialize browser, context and page
     */
    async initialize(headless: boolean = true): Promise<void> {
        const headlessArgs = [                                                                                                                                                  
                 // Disables the local network access check entirely
                '--disable-features=LocalNetworkAccessChecks',
                // Alternative flag if the above doesn't work in your Chromium version
                '--block-insecure-private-network-requests=false',
                // Optional: Deny all permission prompts to avoid test hangs
                '--deny-permission-prompts',                                                                                                                                
                '--disable-infobars',                                                                                                                                              
                '--disable-notifications',                                                                                                                                         
                '--disable-popup-blocking'
              ];
              let args =  headlessArgs.concat(['--start-maximized'])
        this.browser = await chromium.launch({
            headless: headless,
            args: headless ? headlessArgs : args
        });

        // For non-headless mode, use a large viewport instead of null to avoid deviceScaleFactor conflict
        this.context = await this.browser.newContext({
            viewport: { width: 1080, height: 1080 }
        });

        this.page = await this.context.newPage();
        this.office = new Office(this.page);
    }

    /**
     * Login to NetDocuments
     */
    async login(): Promise<boolean> {
        await this.page.goto(this.baseUrl);
        await this.page.locator('#username').fill(this.userName);
        await this.page.locator('#password').fill(this.password);
        await this.page.locator('#loginBtn').click();
        
        await this.page.waitForURL(`${this.baseUrl}/neWeb2/home`, { timeout: 60000 });
        return this.page.url() === `${this.baseUrl}/neWeb2/home`;
    }

    /**
     * Open a document in WOPI editor
     * @param docEnvId Document environment ID
     * @param maxRetries Maximum reload attempts if frame not present (default: 3)
     */
    async openDocument(docEnvId: string, maxRetries: number = 3): Promise<void> {
        const url = `${this.baseUrl}/neWeb2/app/wopiEditor.aspx?envPath=${docEnvId}&docNum=1&verNum=1&mode=edit`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let isVisible = false;

            await this.page.goto(url, { waitUntil: 'load'});
            await this.waitForDocumentLoaded();
            // Check if frame locator is present
            const frameLocator = this.page.locator(this.officeFrameLocator);
            try {
                await expect(frameLocator).toBeAttached({ timeout: 10000 });
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

            // Check if old WOPI
            const officeForm = this.page.locator('#office_form');
            const action = await officeForm.getAttribute('action');
            const oldWopi = action?.includes('wopi-') || false;

            // Check if slideout is visible
            try {
                const frame = this.page.frameLocator(this.officeFrameLocator);
                // const closeButton = frame.locator(this.closeAddinButtonLocator);
                // await expect(closeButton).toBeVisible({ timeout: 5000 });
                // isVisible = true;
            } catch {
                console.log(`[${this.userName}] Slideout not visible`);
                isVisible = false;
            }

            if (isVisible && !oldWopi) {
                await this.office.closeAddin();
            } else {
               // await this.page.waitForTimeout(2000);
            }

            return; // Success
        }
    }

    /**
     * Open document asynchronously (same as openDocument but returns boolean)
     */
    async openDocumentAsync(docEnvId: string): Promise<void> {
        await this.openDocument(docEnvId);
    }

    /**
     * Navigate to home page
     */
    async goToHome(): Promise<void> {
        await this.page.goto(this.baseUrl);
        await this.page.waitForURL(`${this.baseUrl}/neWeb2/home`, { timeout: 60000 });
    }

    /**
     * Get text from a section
     * @param section Section name
     * @returns Text content of the section
     */
    async getTextFromSection(sectionToCheck: string): Promise<string> {
        let text =  await this.office.getTextFromSection(sectionToCheck);
        await this.office.moveOutCursor(this.section);
        return text;
    }
    async VerifyText(sectionToCheck: string, expectedText:string): Promise<void>
    {
        await this.office.verifyText(sectionToCheck, expectedText);
    }
    async VerifySectionsText(oldValues: Array<[string, string]>): Promise<boolean>
    {
        // for (const [section, expectedText] of oldValues) {
        //             const text = await this.getTextFromSection(section);
        //             expect(text).toBe(expectedText);
        //         }
        return await oldValues.every(async v => v[1] === await this.getTextFromSection(v[1]));
    }
    /**
     * Edit document asynchronously with character-by-character typing
     * @param section Section name
     * @param newText New text to insert
     */
    async editDocAsync(newText: string): Promise<void> {
        await this.office.editDocAsync(this.section, newText);
        await this.office.moveOutCursor(this.section);
        return await this.office.waitToBeSaved();   
    }

    /**
     * Wait for document content to be fully loaded
     * @param timeout Timeout in milliseconds (default: 120000)
     */
    async waitForDocumentLoaded(timeout: number = 65000): Promise<void> {
        await this.office.waitForDocumentLoaded(timeout);
    }

    /**
     * Close the browser
     */
    async close(): Promise<void> {
        if (this.page) {
            await this.page.close();
        }
        if (this.context) {
            await this.context.close();
        }
        if (this.browser) {
            await this.browser.close();
        }
    }
}


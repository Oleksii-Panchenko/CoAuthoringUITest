import { Page, FrameLocator } from '@playwright/test';
import { Helper } from '../infrastructure/helper';

/**
 * Office class for interacting with Office Online documents
 * Contains all document editing and manipulation methods
 */
export class Office {
    private page: Page;
    private editorLocator = '#WACViewPanel_EditingElement';
    private officeFrameLocator = '#office_frame';
    private closeAddinButtonLocator = "button[id*='TaskPaneCloseBtnApp']";
    private frame: FrameLocator;

    constructor(page: Page) {
        this.page = page;
        this.frame = this.page.frameLocator(this.officeFrameLocator);
    }

    /**
     * Switch to Office frame
     * Waits 10 seconds for frame to be ready, reloads page if not
     * @param maxRetries Maximum number of reload attempts (default: 3)
     */
    async switchToOfficeFrame(maxRetries: number = 3): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.page.waitForSelector(this.officeFrameLocator, { state: 'attached', timeout: 10000 });
                return; // Success
            } catch (error) {
                if (attempt < maxRetries) {
                    console.log(`Office frame not ready after 10s, reloading page (attempt ${attempt}/${maxRetries})...`);
                    await this.page.reload({ waitUntil: 'load', timeout: 30000 });
                    await this.page.waitForTimeout(2000);
                } else {
                    throw new Error(`Office frame not found after ${maxRetries} reload attempts`);
                }
            }
        }
    }

    /**
     * Close addin panel
     */
    async closeAddin(): Promise<void> {
        try {
            const closeButton = this.frame.locator(this.closeAddinButtonLocator);
            await closeButton.click({ timeout: 5000 });
        } catch {
            // Ignore if button not found
        }
    }

    /**
     * Click on paragraph in a section
     * @param section Section name
     */
    async clickParagraphInSection(section: string): Promise<void> {

        // First, try to find any span containing the section text
        const sectionSpan = this.frame.locator(`xpath=//p[.//span[contains(text(),'${section}') and not(contains(@class,'Selected'))]]//span[contains(@class, 'EOP')]`).first();

        try {
            // Wait for the section header to exist
            await sectionSpan.waitFor({ state: 'attached', timeout: 30000 });
        } catch (error) {
            console.log(`Section "${section}" not found. Checking for notifications...`);

            // Check for feedback notification and "Open in Reading View" button
            try {
                const bodyText = await this.frame.locator('body').textContent();
                console.log(`Body text: ${bodyText?.substring(0, 500)}`);

                if (bodyText?.toLowerCase().includes('feedback')) {
                    console.log('Feedback notification detected.');

                    // Check for "Open in Reading View" button
                    const readingViewButton = this.frame.locator('text=Open in Reading View');
                    if (await readingViewButton.isVisible({ timeout: 2000 })) {
                        console.log('"Open in Reading View" button found. Refreshing page...');
                        await this.page.reload({ waitUntil: 'load', timeout: 30000 });
                        await this.page.waitForTimeout(2000);

                        // Retry finding the section after refresh
                        await sectionSpan.waitFor({ state: 'attached', timeout: 30000 });
                        console.log(`Section "${section}" found after refresh.`);
                    }
                }
            } catch (refreshError) {
                console.log(`Could not handle notification: ${refreshError}`);
            }

            // If still not found, throw error
            try {
                await sectionSpan.waitFor({ state: 'attached', timeout: 5000 });
            } catch {
                throw new Error(`Section "${section}" not found in document even after refresh`);
            }
        }

        const paragraph = this.frame.locator(`xpath=//div[ .//span[contains(text(),'${section}')]]/../following-sibling::div[1]//p[@class='Paragraph']//span[@class='EOP']`).first();

        try {
            await paragraph.click({ timeout: 5000 });
        } catch (error) {
            // If click is intercepted (e.g., by presence indicators), force the click
            await paragraph.click({ force: true, timeout: 10000 });
        }
    }

    /**
     * Get text from a section
     * @param section Section name
     * @returns Text content of the section
     */
    async getTextFromSection(section: string): Promise<string> {
        await this.clickParagraphInSection(section);
        const editor = this.frame.locator(this.editorLocator);
        const text = await editor.textContent() || '';
        await this.moveOutCursor(section);
        return text.trim();
    }

    /**
     * Clear text in a section
     * @param section Section name
     */
    async clearText(section: string): Promise<void> {
        const text = await this.getTextFromSection(section);
        let num = text.length;
        num = num > 2 ? num : num - 2;

        await this.clickParagraphInSection(section);
        const editor = this.frame.locator(this.editorLocator);

        for (let i = 0; i < num; i++) {
            await editor.press('Backspace');
        }
    }

    /**
     * Edit document by replacing text in a section
     * @param section Section name
     * @param newText New text to insert
     */
    async editDoc(section: string, newText: string): Promise<void> {
        await this.clearText(section);
        const editor = this.frame.locator(this.editorLocator);
        await editor.fill(newText);

        // Wait for text to appear using frame locator
        await Helper.waitForTrue(
            async () => {
                try {
                    const text = await editor.textContent();
                    return text?.trim().includes(newText) || false;
                } catch {
                    return false;
                }
            },
            60000,
            1000,
            `Text "${newText}" did not appear in editor`
        );

        await this.moveOutCursor(section);
        await this.page.waitForTimeout(300);
    }

    /**
     * Edit document asynchronously with character-by-character typing
     * @param section Section name
     * @param newText New text to insert
     */
    async editDocAsync(section: string, newText: string): Promise<boolean> {
        await this.clearText(section);
        const editor = this.frame.locator(this.editorLocator);

        // Type character by character with delay
        for (const char of newText) {
            await editor.pressSequentially(char, { delay: 20 });
        }

        // Wait for text to appear using frame locator
        await Helper.waitForTrue(
            async () => {
                try {
                    const text = await editor.textContent();
                    return text?.trim().includes(newText) || false;
                } catch {
                    return false;
                }
            },
            60000,
            1000,
            `Text "${newText}" did not appear in editor`
        );

        await this.moveOutCursor(section);
        await this.page.waitForTimeout(3000);

        const actualText = await this.getTextFromSection(section);
        return actualText === newText;
    }

    /**
     * Move cursor out of the editing area
     * @param section Section name
     */
    async moveOutCursor(section: string): Promise<void> {
        const paragraph = this.frame.locator(`xpath=//p[ .//span[contains(text(),'${section}')]]//span[@class='EOP']`).first();

        try {
            await paragraph.click({ timeout: 5000 });
        } catch (error) {
            // If click is intercepted (e.g., by presence indicators), force the click
            await paragraph.click({ force: true });
        }
    }

    /**
     * Wait for document content to be loaded
     * Waits for the loading animation to disappear
     * @param timeout Timeout in milliseconds (default: 120000)
     */
    async waitForDocumentLoaded(timeout: number = 120000): Promise<void> {
        // Wait for the loading animation container to be hidden
        const animationContainer = this.frame.locator('#animation-container');
        await animationContainer.waitFor({ state: 'hidden', timeout });
    }
}

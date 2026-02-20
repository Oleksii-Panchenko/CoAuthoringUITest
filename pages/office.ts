import { Page, FrameLocator, expect } from '@playwright/test';

/**
 * Office class for interacting with Office Online documents
 * Contains all document editing and manipulation methods
 */
export class Office {
    private page: Page;
    private editorLocator = '#WACViewPanel_EditingElement';
    private officeFrameLocator = '#office_frame';
    private closeAddinButtonLocator = "button[id*='TaskPaneCloseBtnApp']";
    private saved = "div[aria-label*=' Last saved: Just now']";
    private frame: FrameLocator;

    constructor(page: Page) {
        this.page = page;
        this.frame = this.page.frameLocator(this.officeFrameLocator);
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
        // Verify the office frame is actually present before attempting to use it
        const frameElement = this.page.locator(this.officeFrameLocator);
        try {
            await frameElement.waitFor({ state: 'attached', timeout: 10000 });
        } catch {
            const pageSource = await this.page.content();
            require('fs').writeFileSync(`page-source-no-frame-${section}-${Date.now()}.html`, pageSource);
            await this.page.screenshot({ path: `screenshot-no-frame-${section}-${Date.now()}.png` });
            throw new Error(`[clickParagraphInSection] office_frame not found on page when looking for section "${section}". Page source saved.`);
        }

        // Use following:: axis — more robust than parent traversal + following-sibling
        // Also uses contains(@class) instead of exact @class match
        const locator = this.frame.locator(
            `xpath=//p[.//span[contains(text(),'${section}')]]/following::p[1]//span[contains(@class,'EOP')]`
        ).first();

        try {
            await locator.click({ force: true, timeout: 60000 });
        } catch (error) {
            const frameContent = await this.page.frames().find(f => f.name() === 'office_frame' || f.url().includes('wopi'))?.content() ?? await this.page.content();
            require('fs').writeFileSync(`page-source-${section}-${Date.now()}.html`, frameContent);
            await this.page.screenshot({ path: `screenshot-${section}-${Date.now()}.png` });
            throw error;
        }
    }

    /**
     * Get text from a section
     * @param section Section name
     * @returns Text content of the section
     */
    async getTextFromSection(sectionToCheck: string): Promise<string> {
        // await this.clickParagraphInSection(sectionToCheck);
        // const editor = this.frame.locator(this.editorLocator);
        // const text = await editor.textContent() || '';
        await this.clickParagraphInSection(sectionToCheck);
        const editor = this.frame.locator(this.editorLocator);
        const text = await editor.textContent() || '';
        //await this.moveOutCursor(sectionToCheck);
        return text.trim();
    }
     async verifyText(sectionToCheck: string, expectedText: string){
        await this.clickParagraphInSection(sectionToCheck);
        const paragraph = this.frame.locator(
            `xpath=//p[.//span[contains(text(),'${sectionToCheck}')]]/following::p[1]`
        ).first();
       return await expect(paragraph).toHaveText(expectedText);
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

    async waitToBeSaved(): Promise<void>
    {
        const savedIndicator = this.frame.locator(this.saved);
        await expect(savedIndicator).toBeAttached({ timeout: 40000 });
    }
    // /**
    //  * Edit document by replacing text in a section
    //  * @param section Section name
    //  * @param newText New text to insert
    //  */
    // async editDoc(section: string, newText: string): Promise<void> {
    //     await this.clearText(section);
    //     const editor = this.frame.locator(this.editorLocator);
    //     await editor.fill(newText);

    //     // Wait for text to appear using frame locator
    //     await Helper.waitForTrue(
    //         async () => {
    //             try {
    //                 const text = await editor.textContent();
    //                 return text?.trim().includes(newText) || false;
    //             } catch {
    //                 return false;
    //             }
    //         },
    //         60000,
    //         1000,
    //         `Text "${newText}" did not appear in editor`
    //     );

    //     await this.moveOutCursor(section);
    //     await this.page.waitForTimeout(300);
    // }

    /**
     * Edit document asynchronously with character-by-character typing
     * @param section Section name
     * @param newText New text to insert
     */
    async editDocAsync(section: string, newText: string): Promise<void> {
        await this.clearText(section);
        const editor = this.frame.locator(this.editorLocator);

        // Type the full string
        await editor.pressSequentially(newText);

        // Wait for text to appear using native Playwright assertion
        await expect(editor).toHaveText(newText, { timeout: 60000 });
    }

    /**
     * Move cursor out of the editing area
     * @param section Section name
     */
    async moveOutCursor(section: string): Promise<void> {
        await this.frame.locator(`xpath=//p[ .//span[contains(text(),'${section}')]]//span[@class='EOP']`).first().click();

        // try {
        //     await paragraph.click({ timeout: 5000 });
        // } catch (error) {
        //     // If click is intercepted (e.g., by presence indicators), force the click
        //     await paragraph.click({ force: true });
        // }
    }

    /**
     * Wait for document content to be loaded
     * Waits for the loading animation to disappear
     * @param timeout Timeout in milliseconds (default: 120000)
     */
    async waitForDocumentLoaded(timeout: number = 70000): Promise<void> {
        // Wait for the loading animation container to be hidden
        const animationContainer = this.frame.locator('#animation-container');
        await animationContainer.waitFor({ state: 'hidden', timeout });
    }
}

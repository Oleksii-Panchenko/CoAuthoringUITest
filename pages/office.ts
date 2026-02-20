import { Page, FrameLocator, Locator, expect } from '@playwright/test';

export class Office {
    private readonly page: Page;
    private readonly frame: FrameLocator;
    private readonly frameElement: Locator;

    private get editor(): Locator {
        return this.frame.locator('#WACViewPanel_EditingElement');
    }

    private get closeAddinButton(): Locator {
        return this.frame.locator("button[id*='TaskPaneCloseBtnApp']");
    }

    private get savedIndicator(): Locator {
        return this.frame.locator("div[aria-label*=' Last saved: Just now']");
    }

    private get animationContainer(): Locator {
        return this.frame.locator('#animation-container');
    }

    constructor(page: Page) {
        this.page = page;
        this.frame = this.page.frameLocator('#office_frame');
        this.frameElement = this.page.locator('#office_frame');
    }

    async waitForFrameAttached(timeout: number = 10000): Promise<void> {
        await expect(this.frameElement).toBeAttached({ timeout });
    }

    async closeAddin(): Promise<void> {
        try {
            await this.closeAddinButton.click({ timeout: 5000 });
        } catch {
            // Ignore if button not found
        }
    }

    async clickParagraphInSection(section: string): Promise<void> {
        try {
            await this.frameElement.waitFor({ state: 'attached', timeout: 10000 });
        } catch {
            throw new Error(`office_frame not found when looking for section "${section}"`);
        }

        await this.frame.locator(
            `xpath=//p[.//span[contains(text(),'${section}')]]/following::p[1]//span[contains(@class,'EOP')]`
        ).first().click({ force: true, timeout: 60000 });
    }

    async getTextFromSection(section: string): Promise<string> {
        await this.clickParagraphInSection(section);
        const text = await this.editor.textContent() || '';
        return text.trim();
    }

    async verifyText(section: string, expectedText: string): Promise<void> {
        await this.clickParagraphInSection(section);
        const paragraph = this.frame.locator(
            `xpath=//p[.//span[contains(text(),'${section}')]]/following::p[1]`
        ).first();
        await expect(paragraph).toHaveText(expectedText);
    }

    async clearText(section: string): Promise<void> {
        const text = await this.getTextFromSection(section);
        const num = text.length > 2 ? text.length : 0;
        if (num === 0) return;

        await this.clickParagraphInSection(section);
        for (let i = 0; i < num; i++) {
            await this.editor.press('Backspace');
        }
    }

    async waitToBeSaved(): Promise<void> {
        await expect(this.savedIndicator).toBeAttached({ timeout: 40000 });
    }

    async editDocAsync(section: string, newText: string): Promise<void> {
        await this.clearText(section);
        await this.editor.pressSequentially(newText);
        await expect(this.editor).toHaveText(newText, { timeout: 60000 });
    }

    async moveOutCursor(section: string): Promise<void> {
        await this.frame.locator(
            `xpath=//p[.//span[contains(text(),'${section}')]]//span[@class='EOP']`
        ).first().click();
    }

    async waitForDocumentLoaded(timeout: number = 70000): Promise<void> {
        await this.animationContainer.waitFor({ state: 'hidden', timeout });
    }
}

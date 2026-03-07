import { Page, FrameLocator, Locator, expect } from '@playwright/test';
import { FileType } from '../infrastructure/test-data';

/**
 * Shared save-indicator polling used by PptxEditor and XlsxEditor.
 * Polls for a Saving/Saved indicator for up to 8s. If saving is detected,
 * waits until it disappears. Falls back to a 5s safety wait if no indicator appears.
 */
/**
 * Races a readiness signal against the Office error dialog.
 * Throws if "Sorry, we ran into a problem" appears before `readySignal` resolves.
 */
async function exitEditMode(page: Page): Promise<void> {
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
}

async function raceReadyOrError(frame: FrameLocator, readySignal: Promise<void>, timeout: number): Promise<void> {
    const errorDialog = frame.locator('text=Sorry, we ran into a problem')
        .waitFor({ state: 'attached', timeout })
        .then(() => { throw new Error('Office error dialog detected'); });
    await Promise.race([readySignal, errorDialog]);
}

async function waitForSaveIndicator(frame: FrameLocator, page: Page, saveTimeout: number): Promise<void> {
    const savingLocator = frame.locator(
        '[aria-label*="Saving"], [title*="Saving"], [aria-label*="saving"], [title*="saving"]'
    ).first();
    const savedLocator = frame.locator(
        '[aria-label*="Saved"], [title*="Saved"], [aria-label*="saved"], [title*="saved"]'
    ).first();

    const POLL_MS  = 200;
    const TOTAL_MS = 8_000;
    const deadline = Date.now() + TOTAL_MS;
    while (Date.now() < deadline) {
        const isSaving = await savingLocator.isVisible().catch(() => false);
        if (isSaving) {
            await expect(savingLocator).not.toBeVisible({ timeout: saveTimeout });
            return;
        }
        const isSaved = await savedLocator.isVisible().catch(() => false);
        if (isSaved) return;
        await page.waitForTimeout(POLL_MS);
    }
    await page.waitForTimeout(5_000);
}

const TIMEOUTS = {
    FRAME_ATTACH:    10_000,
    ADDIN_CLOSE:      5_000,
    PARAGRAPH_CLICK: 60_000,
    SAVE:            40_000,
    RELOAD:          30_000,
    SLIDEOUT_POLL:  200_000,
    SLIDEOUT_STEP:   10_000,
    DOCUMENT_LOAD:   65_000,
    PPT_READY:      180_000,
    XLSX_READY:     120_000,
    // Longer poll timeout for XLSX verifyText to allow co-authored cells to sync
    // after re-opening documents. 12 users × 12 sections + co-auth sync time.
    XLSX_VERIFY:    120_000,
} as const;

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * Common contract that every document-type editor must fulfill.
 * Implementations: DocxEditor, PptxEditor, XlsxEditor.
 */
export interface IDocumentEditor {
    /** Wait until the document is fully loaded and interactive. */
    waitForReady(): Promise<void>;
    /** Read the current text from the named section / cell / slide. */
    getTextFromSection(section: string): Promise<string>;
    /** Overwrite the section content with `newText`. */
    editSection(section: string, newText: string, iteration: number): Promise<void>;
    /** Assert that the section contains exactly `expectedText`. */
    verifyText(section: string, expectedText: string): Promise<void>;
    /** Wait until the document has been persisted (saved). */
    waitToBeSaved(): Promise<void>;
}

// ─── Word Online (DOCX) ──────────────────────────────────────────────────────

export class DocxEditor implements IDocumentEditor {
    private readonly page: Page;
    private readonly frame: FrameLocator;
    private readonly frameElement: Locator;

    private get editor(): Locator {
        return this.frame.locator('#WACViewPanel_EditingElement');
    }

    private get closeAddinButton(): Locator {
        return this.frame.locator("button[id*='TaskPaneCloseBtnApp']");
    }

    private get allowAndContinueButton(): Locator {
        return this.frame.locator('xpath=//div[@id="FarPaneRegion"]//button[text()="Allow and Continue"]');
    }

    private get savedIndicator(): Locator {
        return this.frame.locator("div[aria-label*=' Last saved: Just now']");
    }

    private get animationContainer(): Locator {
        return this.frame.locator('#animation-container');
    }

    constructor(page: Page, frame: FrameLocator, frameElement: Locator) {
        this.page = page;
        this.frame = frame;
        this.frameElement = frameElement;
    }

    async waitForReady(): Promise<void> {
        await this.animationContainer.waitFor({ state: 'hidden', timeout: TIMEOUTS.DOCUMENT_LOAD });
    }

    async waitForFrameAttached(timeout: number = TIMEOUTS.FRAME_ATTACH): Promise<void> {
        await expect(this.frameElement).toBeAttached({ timeout });
    }

    async closeAddin(): Promise<void> {
        try {
            await this.closeAddinButton.click({ timeout: TIMEOUTS.ADDIN_CLOSE });
        } catch {
            // Ignore if button not found
        }
    }

    /**
     * Polls until the "Allow and Continue" slideout is visible, reloading the
     * page between attempts.  Returns `true` if visible, `false` on timeout.
     */
    async isSlideoutVisible(): Promise<boolean> {
        let attempts = 0;
        try {
            await expect(async () => {
                if (attempts > 0) {
                    await this.page.reload({ waitUntil: 'load', timeout: TIMEOUTS.RELOAD });
                    await this.waitForReady();
                }
                attempts++;
                await expect(this.allowAndContinueButton).toBeVisible({ timeout: TIMEOUTS.SLIDEOUT_STEP });
            }).toPass({
                intervals: [TIMEOUTS.SLIDEOUT_STEP],
                timeout: TIMEOUTS.SLIDEOUT_POLL,
            });
            return true;
        } catch {
            return false;
        }
    }

    private sectionFollowingParagraph(section: string): Locator {
        return this.frame.locator(
            `xpath=//p[.//span[contains(., '${section}')]]/following::p[1]`
        );
    }

    async clickParagraphInSection(section: string): Promise<void> {
        try {
            await this.waitForFrameAttached();
        } catch {
            throw new Error(`office_frame not found when looking for section "${section}"`);
        }

        const para = this.sectionFollowingParagraph(section).first();

        // Word Online renders content asynchronously after #animation-container hides.
        // For large documents (20MB+) the paragraph may not appear in the DOM immediately.
        // Poll every 5s for up to 60s; if still not found, reload the page and poll again
        // for an additional 120s. This handles cases where Word Online's initial render
        // stalls (transient server-side rendering delay on QA) and a reload unblocks it.
        const POLL_INTERVAL_MS = 5_000;
        const FIRST_PASS_MS    = 60_000;
        const SECOND_PASS_MS   = 120_000;
        let paraFound = false;

        const pollUntil = async (limitMs: number): Promise<boolean> => {
            const deadline = Date.now() + limitMs;
            while (Date.now() < deadline) {
                const count = await para.count().catch(() => 0);
                if (count > 0) return true;
                // Section paragraph not yet rendered — focus editor and scroll to top.
                await this.editor.click({ force: true, timeout: 5_000 }).catch(() => {});
                await this.page.keyboard.press('Control+Home');
                await this.page.waitForTimeout(POLL_INTERVAL_MS);
            }
            return false;
        };

        paraFound = await pollUntil(FIRST_PASS_MS);

        if (!paraFound) {
            // Paragraph not found after first pass — reload to unblock Word Online rendering.
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: TIMEOUTS.RELOAD });
            await this.animationContainer.waitFor({ state: 'hidden', timeout: TIMEOUTS.DOCUMENT_LOAD });
            paraFound = await pollUntil(SECOND_PASS_MS);
        }

        if (!paraFound) {
            throw new Error(`Section paragraph for "${section}" not found in the document DOM after ${(FIRST_PASS_MS + SECOND_PASS_MS) / 1000}s (with reload)`);
        }

        // Try to click the EOP span (end-of-paragraph marker used by Word Online).
        // If the EOP span is not present (can happen with certain document structures),
        // fall back to clicking the paragraph element itself with force:true.
        const eopSpan = para.locator("xpath=.//span[contains(@class,'EOP')]").first();
        try {
            await eopSpan.click({ force: true, timeout: 30_000 });
        } catch {
            // EOP span not found or not clickable — fall back to clicking the paragraph.
            await para.click({ force: true, timeout: 30_000 });
        }
    }

    async getTextFromSection(section: string): Promise<string> {
        await this.clickParagraphInSection(section);
        const text = await this.editor.textContent() ?? '';
        return text.trim();
    }

    async verifyText(section: string, expectedText: string): Promise<void> {
        await this.clickParagraphInSection(section);
        await expect(this.sectionFollowingParagraph(section).first()).toHaveText(expectedText);
    }

    async moveOutCursor(section: string): Promise<void> {
        // Use the section-label paragraph itself (not the following paragraph) to move
        // the cursor out of the edited content paragraph. Clicking the section label
        // with force:true reliably moves Word Online focus out of the editing area,
        // even when the EOP span in the content paragraph is CSS-hidden.
        const sectionLabel = this.frame.locator(
            `xpath=//p[.//span[contains(.,'${section}')]]`
        ).first();
        try {
            await sectionLabel.click({ force: true, timeout: TIMEOUTS.PARAGRAPH_CLICK });
        } catch {
            // Fallback: dispatch click event directly in case of layout issues.
            await sectionLabel.dispatchEvent('click', {}, { timeout: TIMEOUTS.PARAGRAPH_CLICK });
        }
    }

    private async clearText(section: string): Promise<void> {
        const text = await this.getTextFromSection(section);
        if (text.length === 0) return;

        await this.editor.focus();
        for (let i = 0; i < text.length; i++) {
            await this.page.keyboard.press('Backspace');
        }
    }

    async editSection(section: string, newText: string, _iteration: number): Promise<void> {
        await this.clearText(section);
        await this.editor.pressSequentially(newText);
        await expect(this.editor).toHaveText(newText, { timeout: TIMEOUTS.PARAGRAPH_CLICK });
        await this.moveOutCursor(section);
    }

    async waitToBeSaved(): Promise<void> {
        await expect(this.savedIndicator).toBeVisible({ timeout: TIMEOUTS.SAVE });
    }
}

// ─── Base class for Office Online editors (PPTX, XLSX) ───────────────────────

abstract class BaseOnlineEditor implements IDocumentEditor {
    constructor(protected readonly page: Page, protected readonly frame: FrameLocator) {}

    protected abstract getReadyLocator(): Locator;
    protected abstract getReadyTimeout(): number;

    async waitForReady(): Promise<void> {
        const ready = this.getReadyLocator().waitFor({ state: 'attached', timeout: this.getReadyTimeout() });
        await raceReadyOrError(this.frame, ready, this.getReadyTimeout());
    }

    async waitToBeSaved(): Promise<void> {
        await waitForSaveIndicator(this.frame, this.page, TIMEOUTS.SAVE);
    }

    abstract getTextFromSection(section: string): Promise<string>;
    abstract editSection(section: string, newText: string, iteration: number): Promise<void>;
    abstract verifyText(section: string, expectedText: string): Promise<void>;
}

// ─── PowerPoint Online (PPTX) ────────────────────────────────────────────────

export class PptxEditor extends BaseOnlineEditor {
    constructor(page: Page, frame: FrameLocator) {
        super(page, frame);
    }

    protected getReadyLocator(): Locator {
        return this.frame.locator('[role="option"]').first();
    }

    protected getReadyTimeout(): number {
        return TIMEOUTS.PPT_READY;
    }

    private async selectUserSlide(section: string): Promise<void> {
        const targetIndex = section.replace('User', '').charCodeAt(0) - 65 + 1; // A→1, B→2…
        const thumbnails = this.frame.locator('[role="option"]');
        await thumbnails.first().click({ timeout: TIMEOUTS.PARAGRAPH_CLICK });
        await thumbnails.nth(targetIndex).click({ force: true, timeout: TIMEOUTS.PARAGRAPH_CLICK });
    }

    private async getContentParagraph(section: string): Promise<Locator> {
        const slideContent = this.frame.locator(
            `xpath=//div[.//p[.//span[text()="${section}"]] and @class="SlideContent"]`
        );
        await slideContent.waitFor({ state: 'attached', timeout: TIMEOUTS.PARAGRAPH_CLICK });
        return slideContent.locator('xpath=.//p').nth(1);
    }

    /** PPT does not implement text-read — always returns empty string. */
    async getTextFromSection(_section: string): Promise<string> {
        return '';
    }

    async verifyText(section: string, expectedText: string): Promise<void> {
        if (expectedText === '') return;
        await this.selectUserSlide(section);
        const contentPara = await this.getContentParagraph(section);

        await expect.poll(async () => {
            await contentPara.click({ force: true, timeout: 5_000 }).catch(() => {});
            const raw = (await contentPara.textContent({ timeout: 5_000 }).catch(() => '')) ?? '';
            return raw.replace(/\u200B/g, '').trim();
        }, {
            message: `Expected PPT slide "${section}" content paragraph to show: ${expectedText}`,
            timeout: TIMEOUTS.PARAGRAPH_CLICK,
            intervals: [2000],
        }).toBe(expectedText);
        await exitEditMode(this.page);
    }

    async editSection(section: string, newText: string, _iteration: number): Promise<void> {
        await this.page.keyboard.press('Escape');
        await this.waitForReady();
        await this.selectUserSlide(section);
        // The content paragraph (subtitle placeholder) is CSS-hidden when empty.
        // Click with force:true to enter text-edit mode even for display:none elements.
        const contentPara = await this.getContentParagraph(section);
        await contentPara.click({ force: true, timeout: TIMEOUTS.PARAGRAPH_CLICK });

        // Wait briefly for PPT text-edit mode to activate after the click.
        // Do NOT call editor.focus() here — #WACViewPanel_EditingElement is the PPT viewing
        // canvas, not the active text box. Calling focus() on it would redirect keyboard
        // input away from the shape and cause typed text to be lost.
        // Instead, use page.keyboard directly: keystrokes go to the OS-focused element
        // (the shape's text area that became active after contentPara.click()).
        await this.page.waitForTimeout(500);
        // Use Ctrl+Home then Ctrl+Shift+End to select all text within THIS shape only.
        // Avoids Ctrl+A which in some PPT Online states can extend selection across shapes
        // (e.g., selecting the title "UserA" label along with the content text, causing
        // the label to be overwritten when new text is typed).
        await this.page.keyboard.press('Control+Home');
        await this.page.waitForTimeout(100);
        await this.page.keyboard.press('Control+Shift+End');
        await this.page.waitForTimeout(200);
        await this.page.keyboard.type(newText, { delay: 50 });
        await exitEditMode(this.page);
    }

    /**
     * Wait until PPT Online's auto-save has persisted the last edit to the server.
     *
     * PPT Online shows a transient "Saving" / "Saved" status indicator.
     * We poll for up to 8s for the saving indicator to appear and then disappear,
     * or for the saved indicator to appear.  If no indicator is found within 8s,
     * fall back to a fixed 5s safety wait to allow any in-flight auto-save PUT
     * to complete before the caller re-opens or re-navigates the document.
     *
     * Without this wait, PPT auto-save may still be in progress when the document
     * is re-opened in the next phase, causing the server to return stale content.
     * Inherited from BaseOnlineEditor.waitToBeSaved().
     */
}

// ─── Excel Online (XLSX) ─────────────────────────────────────────────────────

// Column used for co-auth edits. Each user writes to the same column, different row.
// IMPORTANT: This must match the column pre-populated in the source XLSX document.
// The 95mb-xlsx source document (DOC_95MB_XLSX) uses column Z. Do NOT change to 'L'.
const XLSX_EDIT_COLUMN = 'Z';

export class XlsxEditor extends BaseOnlineEditor {
    constructor(page: Page, frame: FrameLocator) {
        super(page, frame);
    }

    protected getReadyLocator(): Locator {
        // Sheet tab appears once the spreadsheet grid has fully loaded.
        return this.frame.locator('[role="tab"]').first();
    }

    protected getReadyTimeout(): number {
        return TIMEOUTS.XLSX_READY;
    }

    // ── Formula Bar ──────────────────────────────────────────────────────────
    // Excel Online renders the formula bar as textbox with aria-label "formula bar"
    // (lowercase). It may be an <input> or a div[contenteditable].
    private get formulaBar(): Locator {
        return this.frame.locator('[aria-label="formula bar"]').first();
    }

    /**
     * Derive the cell address for a given section.
     * Section format: "UserA", "UserB", ... "UserL" (12 users)
     * UserA → row 1, UserB → row 2, etc.
     * Column is fixed to XLSX_EDIT_COLUMN ("Z").
     * Example: "UserA" → "Z1", "UserB" → "Z2"
     */
    private cellAddress(section: string): string {
        const userLetter = section.slice(-1).toUpperCase();
        const row = userLetter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        return `${XLSX_EDIT_COLUMN}${row}`;
    }

    /**
     * Dismiss any Excel Online modal overlay (e.g. co-auth conflict dialogs)
     * that blocks interaction with the spreadsheet UI.
     * ReactModalDiv is Excel Online's React modal container; when visible it
     * intercepts pointer events.  We close it by clicking its primary button
     * or pressing Escape.
     */
    private async dismissModal(): Promise<void> {
        const modal = this.frame.locator('#ReactModalDiv');
        // Check if ReactModalDiv is present in the DOM (attached).
        // isVisible() alone is insufficient: ReactModalDiv can be transparent/empty
        // (unselectable="on") but still intercept pointer events when a Name Box
        // autocomplete dropdown or co-auth conflict dialog is open.
        const isPresent = await modal.isVisible().catch(() => false);

        // Also check if the Name Box autocomplete dropdown is open (aria-expanded="true").
        // When it is, ReactModalDiv is present as a transparent backdrop that blocks
        // all pointer events — even though it has no visible children.
        const nameBox = this.frame.getByRole('combobox', { name: /Name Box/i });
        const isExpanded = await nameBox.getAttribute('aria-expanded').catch(() => null);

        if (!isPresent && isExpanded !== 'true') return;

        if (isExpanded === 'true') {
            // Name Box autocomplete is open — Escape closes the dropdown list.
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
            return;
        }

        // Try to click any visible button inside the modal (OK, Close, Dismiss, etc.).
        // Prefer buttons with typical dismissal labels.
        const buttons = modal.locator('button');
        const buttonCount = await buttons.count().catch(() => 0);
        let dismissed = false;
        for (let idx = 0; idx < buttonCount && !dismissed; idx++) {
            const btn = buttons.nth(idx);
            const label = (await btn.textContent().catch(() => '')).trim().toLowerCase();
            // Click any button that looks like a dismissal action.
            if (label.match(/ok|close|dismiss|got it|continue|keep|overwrite/)) {
                await btn.click({ timeout: 5_000 }).catch(() => {});
                dismissed = true;
            }
        }
        if (!dismissed && buttonCount > 0) {
            // Click the first button if none matched the known labels.
            await buttons.first().click({ timeout: 5_000 }).catch(() => {});
        }
        if (!dismissed && buttonCount === 0) {
            // No buttons — press Escape to close the modal.
            await this.page.keyboard.press('Escape');
        }
        // Brief wait for modal to close.
        await this.page.waitForTimeout(500);
    }

    /**
     * Navigate to the cell for `section` using the Name Box.
     * Dismisses any active edit first, then types the cell address and presses Enter.
     */
    private async navigateToCell(section: string): Promise<void> {
        // Exit any active cell edit mode before navigating.
        await exitEditMode(this.page);

        // Dismiss any co-auth conflict/sync modal dialogs that block interaction.
        await this.dismissModal();

        const address = this.cellAddress(section);
        // Use getByRole('combobox') to reliably target the Name Box input.
        // The CSS [aria-label*="Name Box"] selector may match the Name Box dropdown
        // button instead of the text input when the input uses aria-labelledby.
        // getByRole handles all forms of accessible name (aria-label, aria-labelledby,
        // label element association) and will always match the combobox role element.
        const nameBox = this.frame.getByRole('combobox', { name: /Name Box/i });
        await nameBox.click({ timeout: TIMEOUTS.PARAGRAPH_CLICK });
        // Use fill() for atomic clear-and-type to avoid partial-input race conditions
        // that can occur with Ctrl+A + keyboard.type() when focus shifts mid-sequence.
        await nameBox.fill(address);
        await this.page.keyboard.press('Enter');
        // Wait for the Name Box autocomplete dropdown to close (aria-expanded → false).
        // If it stays open longer than 2s, press Escape to close it explicitly.
        // This prevents ReactModalDiv (the dropdown backdrop) from intercepting
        // pointer events on the next navigateToCell() call.
        try {
            await expect(nameBox).toHaveAttribute('aria-expanded', 'false', { timeout: 2000 });
        } catch {
            // Dropdown still open — close it without cancelling the cell navigation.
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(200);
        }
        // Allow Excel Online to complete the cell selection before subsequent actions.
        // Large files on slow servers may need extra time to settle the cell focus.
        await this.page.waitForTimeout(1000);
    }

    private async readFormulaBar(): Promise<string> {
        // Try inputValue() first (works if formula bar is an <input>).
        // Fall back to textContent() for div[contenteditable] implementations.
        const text = await this.formulaBar.inputValue({ timeout: 5_000 })
            .catch(() => this.formulaBar.textContent({ timeout: 5_000 }).then(t => t ?? '').catch(() => ''));
        return text.trim();
    }

    async getTextFromSection(section: string): Promise<string> {
        await this.navigateToCell(section);
        return this.readFormulaBar();
    }

    /**
     * Type newText into the formula bar using keyboard events.
     * Separates the typing step from the commit to allow retries.
     */
    private async typeIntoFormulaBar(newText: string): Promise<void> {
        await this.formulaBar.click({ timeout: TIMEOUTS.PARAGRAPH_CLICK });
        // Wait for cell-edit mode to be fully active.
        await this.page.waitForTimeout(500);
        // Move to start of formula bar content, select to end.
        // Avoids Ctrl+A which can select all cells when focus is ambiguous.
        await this.page.keyboard.press('Control+Home');
        await this.page.waitForTimeout(100);
        await this.page.keyboard.press('Control+Shift+End');
        await this.page.waitForTimeout(200);
        // Type the replacement text. page.keyboard.type() targets the currently
        // focused element (formula bar inside iframe). delay:150 is chosen to
        // keep total typing time reasonable while reducing keystroke drops.
        await this.page.keyboard.type(newText, { delay: 150 });
        await this.page.waitForTimeout(300);
    }

    async editSection(section: string, newText: string, _iteration: number): Promise<void> {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await this.navigateToCell(section);
            await this.typeIntoFormulaBar(newText);
            // Commit the edit.
            await this.page.keyboard.press('Enter');
            // Re-navigate and verify the committed value.
            await this.navigateToCell(section);
            const committed = await this.readFormulaBar();
            if (committed === newText) {
                return; // Success
            }
            if (attempt < maxAttempts) {
                // Transient co-auth sync events or concurrent browser load may interrupt
                // typing mid-keystroke. Escape any lingering edit state and retry.
                await exitEditMode(this.page);
                await this.page.waitForTimeout(1000);
            } else {
                throw new Error(
                    `[XlsxEditor] Edit verification failed for ${this.cellAddress(section)} after ` +
                    `${maxAttempts} attempts: expected "${newText}" but formula bar shows "${committed}"`
                );
            }
        }
    }

    async verifyText(section: string, expectedText: string): Promise<void> {
        if (expectedText === '') return;

        await expect.poll(async () => {
            await this.navigateToCell(section);
            return this.readFormulaBar();
        }, {
            message: `Expected Excel cell ${this.cellAddress(section)} to contain: ${expectedText}`,
            timeout: TIMEOUTS.XLSX_VERIFY,
            intervals: [2000],
        }).toBe(expectedText);
    }

    /**
     * Wait until Excel Online's auto-save completes.
     *
     * Excel Online (WOPI) triggers a PUT request to the WOPI endpoint after each
     * committed edit.  The UI shows a transient "Saving…" indicator which
     * disappears once the server acknowledges the save.
     *
     * Strategy:
     *  1. If a "Saving" indicator is present, wait until it disappears.
     *  2. If no such indicator exists (auto-save fired silently or already done),
     *     return immediately — the cell navigation at the end of editSection()
     *     already confirms the value was committed to the sheet.
     *
     * Note: aria-label values differ between O365/OneDrive and custom WOPI hosts.
     * We match on several known patterns for resilience.
     * Inherited from BaseOnlineEditor.waitToBeSaved().
     */
}

// ─── Office facade ───────────────────────────────────────────────────────────

/**
 * Top-level facade that owns the iframe reference and creates the correct
 * document-type editor on demand.
 *
 * Callers that need file-type-specific behaviour should call `getEditor(fileType)`
 * and work with the returned `IDocumentEditor`.  Legacy callers may still use the
 * original delegating methods retained for backwards compatibility.
 */
export class Office {
    private readonly page: Page;
    private readonly frame: FrameLocator;
    private readonly frameElement: Locator;

    private readonly docx: DocxEditor;
    private readonly pptx: PptxEditor;
    private readonly xlsx: XlsxEditor;

    constructor(page: Page) {
        this.page = page;
        this.frame = this.page.frameLocator('#office_frame');
        this.frameElement = this.page.locator('#office_frame');

        this.docx = new DocxEditor(this.page, this.frame, this.frameElement);
        this.pptx = new PptxEditor(this.page, this.frame);
        this.xlsx = new XlsxEditor(this.page, this.frame);
    }

    async waitForFrameAttached(timeout: number = TIMEOUTS.FRAME_ATTACH): Promise<void> {
        await expect(this.frameElement).toBeAttached({ timeout });
    }

    /** Returns the correct IDocumentEditor for the given file type. */
    getEditor(fileType: FileType): IDocumentEditor {
        switch (fileType) {
            case 'docx': return this.docx;
            case 'pptx': return this.pptx;
            case 'xlsx': return this.xlsx;
        }
    }

    async waitForDocumentLoaded(timeout: number = TIMEOUTS.DOCUMENT_LOAD): Promise<void> {
        await this.frame.locator('#animation-container').waitFor({ state: 'hidden', timeout });
    }

    async closeAddin(): Promise<void> {
        await this.docx.closeAddin();
    }

    async isSlideoutVisible(): Promise<boolean> {
        return this.docx.isSlideoutVisible();
    }

    async moveOutCursor(section: string): Promise<void> {
        await this.docx.moveOutCursor(section);
    }
}

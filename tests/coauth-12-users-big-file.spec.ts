import { test } from '@playwright/test';
import { Helper, TestContext } from '../infrastructure/helper';

/**
 * CoAuth Testing with 12 Users and Big File
 * Follows exact same steps as Archive/tests/coauth-web-test-big-file.spec.ts
 */
test.describe('CoAuth Session 12 Users Big File Test', () => {
    let ctx: TestContext;
    let headless = false;

    // Track text for each user
    const userTexts: string[] = new Array(12).fill('');

    test.beforeAll(async () => {
        ctx = await Helper.setup(undefined, '20mb', headless, false);
    });

    test.afterAll(async () => {
        await Helper.teardown(ctx);
    });

    test('CoAuth session with 12 users editing big file', async () => {
        const { users, apiHelper, docEnvId } = ctx;

        // Run 3 iterations of editing
        for (let i = 0; i < 3; i++) {
            const oldValues: Array<[string, string]> = users.map((user, idx) =>
                [user.section, userTexts[idx]]
            );

            if (i === 0) {
                await test.step('Open documents for all users', async () => {
                    // First iteration: first user opens document and verifies section is visible
                    await users[0].openDocumentAsync(docEnvId);
                    await users[0].getTextFromSection(users[0].section); // Verify UserA section is visible

                    // Then all other users open in parallel
                    await Promise.all(
                        users.slice(1).map(user => user.openDocumentAsync(docEnvId))
                    );
                });
            }

            await test.step(`Generate text for iteration ${i}`, async () => {
                // Generate new text for each user
                for (let userIdx = 0; userIdx < users.length; userIdx++) {
                    const userLetter = String.fromCharCode(65 + userIdx); // A, B, C, D, etc.
                    userTexts[userIdx] = `New Text User ${userLetter} ${i} ${Helper.randomString(70)}`;
                }
            });

            await test.step(`Verify old values for iteration ${i}`, async () => {
                // Verify old values for all users
                await Promise.all(users.map(async user => {
                    for (const [section, expectedText] of oldValues) {
                        await user.VerifyText(section, expectedText);
                    }
                }));
            });

            await test.step(`Edit documents for iteration ${i}`, async () => {
                // Edit document for all users in parallel
                await Promise.all(
                    users.map((user, idx) => user.editDocAsync(userTexts[idx]))
                );
            });

            if (i === 3) {
                await test.step('Close documents and verify modified date', async () => {
                    // Close documents in parallel (without closing browsers)
                    await Promise.all(users.map(user => Helper.closeUser(user, apiHelper, docEnvId, false, false)));

                    // After all users close, wait for document modified date to be updated on ndServer
                    // Start timing from when changes are saved (documents closed)
                    const modifiedCheckStartTime = Date.now();
                    Helper.log(`Iteration ${i}: Checking document modified date update...`);
                    const previousModified = ctx.lastDocumentModified;
                    ctx.lastDocumentModified = await apiHelper.waitForDocumentModifiedChanged(docEnvId, previousModified);
                    const modifiedCheckDuration = Date.now() - modifiedCheckStartTime;
                    Helper.log(`Iteration ${i}: Document modified updated from ${new Date(previousModified).toISOString()} to ${new Date(ctx.lastDocumentModified).toISOString()}`);
                    Helper.log(`Iteration ${i}: Time to update document modified: ${modifiedCheckDuration}ms (${(modifiedCheckDuration / 1000).toFixed(2)}s)`);
                });
            }
        }
    });
});

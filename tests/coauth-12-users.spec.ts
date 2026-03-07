import { test } from '@playwright/test';
import { setup, teardown, closeUser, log, randomString, TestContext } from '../infrastructure/helper';

interface TestPhase {
    open: boolean;
    edit: boolean;
    checkDate: boolean;
}

// Explicit phase definitions replace the opaque i !== 1 / i === 1 flag logic.
const PHASES: TestPhase[] = [
    { open: true,  edit: true,  checkDate: false }, // 0: open all, edit
    { open: false, edit: true,  checkDate: true  }, // 1: edit, then verify modified date
    { open: true,  edit: false, checkDate: false }, // 2: re-open, verify only
];

test.describe('CoAuth Session 12 Users Big File Test', () => {
    let ctx: TestContext | undefined;

    // Track text for each user — sized dynamically after setup
    let userTexts: string[] = [];

    test.beforeAll(async () => {
        ctx = await setup();
        userTexts = new Array(ctx.users.length).fill('');
    });

    test.afterAll(async () => {
        await teardown(ctx);
    });

    test.skip('Update test: edit 300 times with 60s sleep', async () => {
        if (!ctx) throw new Error('Test context not initialized — beforeAll setup() failed');
        const { users, docEnvId } = ctx;
        const ITERATIONS = 300;
        const SLEEP_MS = 60_000;

        await test.step('Open documents for all users', async () => {
            await users[0].openDocument(docEnvId);
            await users[0].getTextFromSection(users[0].section);
            await Promise.all(
                users.slice(1).map(user => user.openDocument(docEnvId))
            );
        });

        for (let i = 0; i < ITERATIONS; i++) {
            await test.step(`Generate text for iteration ${i + 1}/${ITERATIONS}`, async () => {
                for (let userIdx = 0; userIdx < users.length; userIdx++) {
                    const userLetter = String.fromCharCode(65 + userIdx);
                    userTexts[userIdx] = `New Text User ${userLetter} ${i} ${randomString(70)}`;
                }
            });

            await test.step(`Edit documents (iteration ${i + 1}/${ITERATIONS})`, async () => {
                await Promise.all(
                    users.map((user, idx) => user.editDocAsync(userTexts[idx], i))
                );
            });

            await test.step(`Sleep 60s after edit (iteration ${i + 1}/${ITERATIONS})`, async () => {
                log(`Iteration ${i + 1}: sleeping 60s...`);
                await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
            });
        }
    });

    // FIXME: PowerPoint Online (PPT_READY) consistently returns an error dialog
    // "Sorry, we ran into a problem. Please try again." when opening the 112MB PPTX
    // source document (DOC_112MB_PPTX=4820-4474-4388) on the QA server. The document
    // fails to render in PPT Online after 3 retries. This is a server-side environment
    // issue — the test logic is correct. Re-enable when the PPT server can handle
    // this document size or when a lighter source document is configured.
    test('Edit', async () => {
        if (!ctx) throw new Error('Test context not initialized — beforeAll setup() failed');
        const { users, apiHelper, docEnvId } = ctx;

        for (let i = 0; i < PHASES.length; i++) {
            const phase = PHASES[i];

            const oldValues: Array<[string, string]> = users.map((user, idx) =>
                [user.section, userTexts[idx]]
            );

            if (phase.open) {
                await test.step(`Open documents for all users (iteration ${i})`, async () => {
                    await users[0].openDocument(docEnvId);
                    await users[0].getTextFromSection(users[0].section);

                    await Promise.all(
                        users.slice(1).map(user => user.openDocument(docEnvId))
                    );
                });
            }

            await test.step(`Generate text for iteration ${i}`, async () => {
                for (let userIdx = 0; userIdx < users.length; userIdx++) {
                    const userLetter = String.fromCharCode(65 + userIdx);
                    userTexts[userIdx] = `New Text User ${userLetter} ${i} ${randomString(70)}`;
                }
            });

            await test.step(`Verify old values for iteration ${i}`, async () => {
                // Each user verifies every section to confirm cross-user edits are visible
                await Promise.all(users.map(async user => {
                    for (const [section, expectedText] of oldValues) {
                        await user.verifyText(section, expectedText);
                    }
                }));
            });

            if (phase.edit) {
                await test.step(`Edit documents for iteration ${i}`, async () => {
                    await Promise.all(
                        users.map((user, idx) => user.editDocAsync(userTexts[idx], i))
                    );
                });
            }

            if (phase.checkDate) {
                await test.step.skip('Close documents and verify modified date', async () => {
                    await Promise.all(users.map(user => closeUser(user, apiHelper, docEnvId, false, false)));

                    const modifiedCheckStartTime = Date.now();
                    log(`Iteration ${i}: Checking document modified date update...`);
                    const previousModified = ctx.lastDocumentModified;
                    ctx.lastDocumentModified = await apiHelper.waitForDocumentModifiedChanged(docEnvId, previousModified);
                    const modifiedCheckDuration = Date.now() - modifiedCheckStartTime;
                    log(`Iteration ${i}: Document modified updated from ${new Date(previousModified).toISOString()} to ${new Date(ctx.lastDocumentModified).toISOString()}`);
                    log(`Iteration ${i}: Time to update document modified: ${modifiedCheckDuration}ms (${(modifiedCheckDuration / 1000).toFixed(2)}s)`);
                });
            }
        }
    });
});

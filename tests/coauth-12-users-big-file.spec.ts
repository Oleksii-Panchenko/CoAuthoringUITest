import { test } from '@playwright/test';
import { User } from '../pages/user';
import { ApiHelper } from '../infrastructure/api-helper';
import { Helper } from '../infrastructure/helper';
import { getEnvironmentConfig } from '../infrastructure/test-data';

/**
 * CoAuth Testing with 12 Users and Big File
 * Follows exact same steps as Archive/tests/coauth-web-test-big-file.spec.ts
 */
test.describe('CoAuth Session 12 Users Big File Test', () => {
    const users: User[] = [];
    let apiHelper: ApiHelper;
    let headless = false;

    let env: string;
    let docEnvId: string;
    let docName: string;
    let sourceDocEnvId: string;
    let destinationEnvId: string;
    let lastDocumentModified: number;

    // Track text for each user
    const userTexts: string[] = new Array(12).fill('');

    test.beforeAll(async () => {
        // Clean up logs
        Helper.fileCleanup('logs');

        // Get environment from ENV variable or default to QA
        env = process.env.ENV || 'QA';
        const config = getEnvironmentConfig(env);

        Helper.log(config.baseUrl);
        Helper.log(env);

        // Set up users from config
        for (const userConfig of config.users) {
            users.push(new User(userConfig.username, userConfig.password, config.baseUrl, userConfig.section));
        }

        sourceDocEnvId = config.sourceDocuments['20mb'];
        destinationEnvId = config.destinationEnvId;
        

        Helper.log(`Initializing ${users.length} browsers...`);
        // Initialize all users in parallel
        await Promise.all(users.map(user => user.initialize(headless)));

        // Login all users in parallel
        Helper.log(`Logging in ${users.length} users...`);
        await Promise.all(users.map(user => user.login()));

        // // Make sure first user is on the home page where the API is available
        // await users[0].goToHome();

        // Initialize API helper with first user's page
        apiHelper = new ApiHelper(users[0].page);

        // Copy the source document
        const copyResult = await apiHelper.copyDocument(sourceDocEnvId, destinationEnvId, env, false);
        docEnvId = copyResult.envId;
        docName = copyResult.docName;
        Helper.log(`Created document: ${docEnvId} (${docName})`);

        // Get initial document modified date after indexing
        lastDocumentModified = await apiHelper.getDocumentModified(docEnvId);
        Helper.log(`Initial document modified: ${new Date(lastDocumentModified).toISOString()}`);
    });

    test.afterAll(async () => {
        // Close users 2-12 in parallel
        await Promise.all(
            //users.slice(1).map(user => closeUser(user, false, true))
            users.map(user => user.goToHome())
        );
        try
        {
            await apiHelper.waitForDocumentCheckedIn(docEnvId, 10000);
            await apiHelper.deleteDocument(docEnvId);
        }
        catch
        {
            console.log('Document was not checked in');
        }
        
        // Check in and close first user (must be last to handle document deletion)
        await Promise.all(
            users.map(user => closeUser(user, false, false))
        );
    });

    test('CoAuth session with 12 users editing big file', async () => {
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
                    await Promise.all(users.map(user => closeUser(user, false, false)));

                    // After all users close, wait for document modified date to be updated on ndServer
                    // Start timing from when changes are saved (documents closed)
                    const modifiedCheckStartTime = Date.now();
                    Helper.log(`Iteration ${i}: Checking document modified date update...`);
                    const previousModified = lastDocumentModified;
                    lastDocumentModified = await apiHelper.waitForDocumentModifiedChanged(docEnvId, previousModified);
                    const modifiedCheckDuration = Date.now() - modifiedCheckStartTime;
                    Helper.log(`Iteration ${i}: Document modified updated from ${new Date(previousModified).toISOString()} to ${new Date(lastDocumentModified).toISOString()}`);
                    Helper.log(`Iteration ${i}: Time to update document modified: ${modifiedCheckDuration}ms (${(modifiedCheckDuration / 1000).toFixed(2)}s)`);
                });
            }
        }
    });

    /**
     * Close user session
     * @param user User to close
     * @param checkIn Whether to check in the document
     * @param closeBrowser Whether to close the browser
     */
    async function closeUser(user: User, checkIn: boolean = false, closeBrowser: boolean = false): Promise<void> {
        if (!user || !user.page) {
            console.log('User is already closed or not initialized.');
            return;
        }

        try {
            await user.goToHome();

            if (checkIn) {
                try {
                    // Wait for document to be checked in before deleting
                    await apiHelper.waitForDocumentCheckedIn(docEnvId);
                    Helper.log('Document checked in, proceeding with deletion');

                    // Delete the document using the API helper
                    await apiHelper.deleteDocument(docEnvId);
                    Helper.log('Document deleted successfully');
                } catch (deleteError) {
                    console.log(`Error deleting document: ${deleteError}`);
                    // Document might already be deleted or not accessible
                }
            }

            if (closeBrowser) {
                await user.close();
            }
        } catch (error) {
            console.log(`Error closing user: ${error}`);
        }
    }
});

import * as fs from 'fs';
import * as path from 'path';
import { User } from '../pages/user';
import { ApiHelper } from './api-helper';
import { getEnvironmentConfig, EnvironmentConfig } from './test-data';
import { expect } from '@playwright/test';

/**
 * Test context containing all shared test state
 */
export interface TestContext {
    users: User[];
    apiHelper: ApiHelper;
    env: string;
    config: EnvironmentConfig;
    docEnvId: string;
    docName: string;
    sourceDocEnvId: string;
    destinationEnvId: string;
    lastDocumentModified: number;
}

/**
 * Helper utility functions for tests
 */
export class Helper {
    /**
     * Generate a random string of specified length
     * @param length Length of the random string
     * @returns Random string containing uppercase letters and digits
     */
    static randomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Log a message to a file
     * @param text Text to log
     * @param logDir Directory to store log files (default: 'logs')
     */
    static log(text: string, logDir: string = 'logs'): void {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '.').split('.')[0];
        const logFile = path.join(logDir, `${timestamp}.txt`);
        
        // Ensure log directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        fs.appendFileSync(logFile, text + '\n\n');
    }

    /**
     * Clean up files in a directory
     * @param dirPath Directory path to clean
     */
    static fileCleanup(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
        }
    }

    /**
     * Initialize test context with users, API helper, and document
     * @param envName Environment name (default: from ENV variable or 'QA')
     * @param sourceDocKey Key for source document size (e.g., '20mb')
     * @param headless Whether to run browsers in headless mode
     * @param waitForIndexed Whether to wait for document to be indexed after copy
     * @returns Initialized TestContext
     */
    static async setup(
        envName?: string,
        sourceDocKey: '13mb' | '20mb' | '32mb' | '60mb' | '95mb' = '20mb',
        headless: boolean = false,
        waitForIndexed: boolean = false
    ): Promise<TestContext> {
        // Clean up logs
        Helper.fileCleanup('logs');

        // Get environment from ENV variable or default to QA
        const env = envName || process.env.ENV || 'QA';
        const config = getEnvironmentConfig(env);

        Helper.log(config.baseUrl);
        Helper.log(env);

        // Set up users from config
        const users: User[] = [];
        for (const userConfig of config.users) {
            users.push(new User(userConfig.username, userConfig.password, config.baseUrl, userConfig.section));
        }

        const sourceDocEnvId = config.sourceDocuments[sourceDocKey];
        const destinationEnvId = config.destinationEnvId;

        Helper.log(`Initializing ${users.length} browsers...`);
        // Initialize all users in parallel
        await Promise.all(users.map(user => user.initialize(headless)));

        // Login all users in parallel
        Helper.log(`Logging in ${users.length} users...`);
        await Promise.all(users.map(user => user.login()));

        // Initialize API helper with first user's page
        const apiHelper = new ApiHelper(users[0].page);

        // Copy the source document
        const copyResult = await apiHelper.copyDocument(sourceDocEnvId, destinationEnvId, env, waitForIndexed);
        const docEnvId = copyResult.envId;
        const docName = copyResult.docName;
        Helper.log(`Created document: ${docEnvId} (${docName})`);

        // Get initial document modified date after indexing
        const lastDocumentModified = await apiHelper.getDocumentModified(docEnvId);
        Helper.log(`Initial document modified: ${new Date(lastDocumentModified).toISOString()}`);

        return {
            users,
            apiHelper,
            env,
            config,
            docEnvId,
            docName,
            sourceDocEnvId,
            destinationEnvId,
            lastDocumentModified
        };
    }

    /**
     * Teardown test context - close all users and delete document
     * @param context Test context to teardown
     */
    static async teardown(context: TestContext): Promise<void> {
        const { users, apiHelper, docEnvId } = context;

        await Promise.all(users.map(async user => {
            try {
                const responsePromise = user.page.waitForResponse('**/we/OneNote.ashx?perfTag=LockRelease_1**', { timeout: 30000 });
                user.goToHome();
                const response = await responsePromise;
                const status = response.status();
                if (status !== 200) {
                    console.log(`Lock release returned ${status} for user - this may be expected if no lock was held`);
                }
            } catch (error) {
                console.log(`Lock release not detected for user:${user.userName} - may not have held a lock`);
            }
        }));

        // Try to wait for document check-in and delete
        try {
            await apiHelper.waitForDocumentCheckedIn(docEnvId, 60000);
            await apiHelper.deleteDocument(docEnvId);
        } catch {
            console.log('Document was not checked in');
        }

        // Close all user browsers
        await Promise.all(users.map(user => Helper.closeUser(user, apiHelper, docEnvId, false, false)));
    }

    /**
     * Close user session
     * @param user User to close
     * @param apiHelper API helper instance
     * @param docEnvId Document environment ID
     * @param checkIn Whether to check in the document
     * @param closeBrowser Whether to close the browser
     */
    static async closeUser(
        user: User,
        apiHelper: ApiHelper,
        docEnvId: string,
        checkIn: boolean = false,
        closeBrowser: boolean = false
    ): Promise<void> {
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
}


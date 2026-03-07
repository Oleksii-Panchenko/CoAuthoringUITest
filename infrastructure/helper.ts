import * as fs from 'fs';
import * as path from 'path';
import { User, UserSession } from '../pages/user';
import { ApiHelper } from './api-helper';
import { getEnvironmentConfig, EnvironmentConfig, FileType } from './test-data';

export class TestSession {
    private readonly _users: User[];
    private readonly _sessions: UserSession[];
    private readonly _apiHelper: ApiHelper;

    readonly env: string;
    readonly config: EnvironmentConfig;
    readonly docEnvId: string;
    readonly docName: string;
    readonly sourceDocEnvId: string;
    readonly destinationEnvId: string;
    lastDocumentModified: number;

    get users(): User[] { return this._users; }
    get apiHelper(): ApiHelper { return this._apiHelper; }

    private constructor(
        users: User[],
        sessions: UserSession[],
        apiHelper: ApiHelper,
        env: string,
        config: EnvironmentConfig,
        docEnvId: string,
        docName: string,
        sourceDocEnvId: string,
        destinationEnvId: string,
        lastDocumentModified: number,
    ) {
        this._users = users;
        this._sessions = sessions;
        this._apiHelper = apiHelper;
        this.env = env;
        this.config = config;
        this.docEnvId = docEnvId;
        this.docName = docName;
        this.sourceDocEnvId = sourceDocEnvId;
        this.destinationEnvId = destinationEnvId;
        this.lastDocumentModified = lastDocumentModified;
    }

    static async create(opts: { waitForIndexed?: boolean } = {}): Promise<TestSession> {
        fileCleanup('logs');

        const config = getEnvironmentConfig();
        const env = process.env.ENV ?? 'QA';

        log(config.baseUrl);
        log(env);

        const { sourceDocKey } = config;
        const fileType: FileType = sourceDocKey.includes('pptx') ? 'pptx'
                                 : sourceDocKey.includes('xlsx') ? 'xlsx'
                                 : 'docx';

        const sourceDocEnvId = config.sourceDocuments[sourceDocKey];
        const { destinationEnvId } = config;

        const headed = process.env.HEADED === '1' || process.env.HEADED === 'true';
        log(`Initializing ${config.users.length} browsers (headless=${!headed})...`);
        const sessions = await Promise.all(
            config.users.map(userConfig => UserSession.create(
                userConfig.username, userConfig.password, config.baseUrl, userConfig.section, fileType, !headed
            ))
        );
        const users = sessions.map(s => s.user);

        log(`Logging in ${users.length} users...`);
        await Promise.all(users.map(user => user.login()));

        const apiHelper = new ApiHelper(users[0].page);

        const copyResult = await apiHelper.copyDocument(sourceDocEnvId, destinationEnvId, env, opts.waitForIndexed ?? false);
        const { envId: docEnvId, docName } = copyResult;
        log(`Created document: ${docEnvId} (${docName})`);

        const lastDocumentModified = await apiHelper.getDocumentModified(docEnvId);
        log(`Initial document modified: ${new Date(lastDocumentModified).toISOString()}`);

        return new TestSession(users, sessions, apiHelper, env, config, docEnvId, docName, sourceDocEnvId, destinationEnvId, lastDocumentModified);
    }

    async teardown(): Promise<void> {
        await Promise.all(this._users.map(async user => {
            // Lock release only applies to DOCX (Word Online). Skip for PPTX/XLSX.
            if (user.fileType !== 'docx') {
                try {
                    await user.goToHome();
                } catch {
                    // Ignore navigation errors during teardown
                }
                return;
            }
            try {
                // Attach .catch() immediately to prevent unhandled rejection if the page
                // navigates away before the lock release response fires.
                const responsePromise = user.page.waitForResponse(
                    '**/we/OneNote.ashx?perfTag=LockRelease_1**',
                    { timeout: 30000 }
                ).catch(() => undefined);
                await user.goToHome();
                const response = await responsePromise;
                const status = response?.status();
                if (status !== undefined && status !== 200) {
                    console.log(`Lock release returned ${status} for user - this may be expected if no lock was held`);
                } else if (status === undefined) {
                    console.log(`Lock release not detected for user:${user.userName} - may not have held a lock`);
                }
            } catch {
                console.log(`Lock release not detected for user:${user.userName} - may not have held a lock`);
            }
        }));

        try {
            await this._apiHelper.waitForDocumentCheckedIn(this.docEnvId, 60000);
            await this._apiHelper.deleteDocument(this.docEnvId);
        } catch {
            console.log('Document was not checked in');
        }

        await Promise.all(this._sessions.map(session => session.close()));
    }
}


// One log file per process lifetime; reset by fileCleanup().
let currentLogFile: string | undefined;

function resolveLogFile(logDir: string): string {
    if (!currentLogFile) {
        const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '.').split('.')[0];
        currentLogFile = path.join(logDir, `${ts}.txt`);
    }
    return currentLogFile;
}

export function randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function log(text: string, logDir: string = 'logs'): void {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(resolveLogFile(logDir), text + '\n\n');
}

export function fileCleanup(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;

    for (const file of fs.readdirSync(dirPath)) {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
        }
    }
    // Reset so the next log() call opens a fresh file in the cleaned directory.
    currentLogFile = undefined;
}


export async function closeUser(
    user: User,
    apiHelper: ApiHelper,
    docEnvId: string,
    deleteDocument: boolean = false,
    session?: UserSession,
): Promise<void> {
    try {
        await user.goToHome();
    } catch (error) {
        console.log(`Error navigating user ${user.userName} to home: ${error}`);
        return;
    }

    if (deleteDocument) {
        try {
            await apiHelper.waitForDocumentCheckedIn(docEnvId);
            await apiHelper.deleteDocument(docEnvId);
        } catch (error) {
            console.log(`Error deleting document: ${error}`);
        }
    }

    if (session) {
        await session.close();
    }
}

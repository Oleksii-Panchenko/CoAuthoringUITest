import { Page, expect } from '@playwright/test';

/**
 * Helper class for NetDocuments REST API operations
 * Provides methods for copy, delete, check in/out operations
 */
export class ApiHelper {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Copy a document using NetDocuments API
     * @param sourceDocEnvId Source document environment ID
     * @param destinationEnvId Destination folder environment ID
     * @param env Environment name (for naming the copy)
     * @param waitForIndexed Whether to wait for the document to be indexed (default: true)
     * @returns Object with envId and docName of the copied document
     */
    async copyDocument(sourceDocEnvId: string, destinationEnvId: string, env: string, waitForIndexed: boolean = true): Promise<{ envId: string; docName: string }> {
        // Wait for API to be available
        await this.page.waitForFunction(() => {
            return typeof (window as any).api !== 'undefined' && (window as any).api !== null;
        });

        const timestamp = Date.now();
        const docName = `Coauth_UTC_${env}_${timestamp}`;

        const envId = await this.page.evaluate(
            ({ source, destination, name }) => {
                return (window as any).api.document.copy({
                    id: source,
                    destination: destination,
                    name: name
                }).envId;
            },
            { source: sourceDocEnvId, destination: destinationEnvId, name: docName }
        );

        // Wait for the document to be indexed if requested
        if (waitForIndexed) {
            await this.waitForIndexed(docName);
        }

        return { envId: envId || '', docName };
    }

    /**
     * Delete a document permanently using NetDocuments API
     * @param docEnvId Document environment ID to delete
     */
    async deleteDocument(docEnvId: string): Promise<void> {
        await this.page.evaluate(
            (envId) => {
                return (window as any).api.document.deleteItem({
                    id: envId,
                    permanent: 't'
                });
            },
            docEnvId
        );
    }

    /**
     * Check if a document is checked out
     * @param docEnvId Document environment ID
     * @returns true if document is checked out, false otherwise
     */
    async isDocumentCheckedOut(docEnvId: string): Promise<boolean> {
        const checkedOut = await this.page.evaluate(
            (envId) => {
                return (window as any).api.document.getInfo({ id: envId }).checkedOut;
            },
            docEnvId
        );

        return checkedOut !== null && checkedOut !== undefined;
    }

    /**
     * Wait for document to be checked in
     * @param docEnvId Document environment ID
     * @param timeout Timeout in milliseconds (default: 60000)
     */
    async waitForDocumentCheckedIn(docEnvId: string, timeout: number = 60000, polling:number = 5000): Promise<void> {
        await this.page.waitForFunction(
            (envId) => {
                const info = (window as any).api.document.getInfo({ id: envId });
                return info.checkedOut === null || info.checkedOut === undefined;
            },
            docEnvId,
            { polling, timeout }
        );
    }

    /**
     * Get document information
     * @param docEnvId Document environment ID
     * @returns Document information object
     */
    async getDocumentInfo(docEnvId: string): Promise<any> {
        return await this.page.evaluate(
            (envId) => {
                return (window as any).api.document.getInfo({ id: envId });
            },
            docEnvId
        );
    }

    /**
     * Check out a document
     * @param docEnvId Document environment ID
     */
    async checkOutDocument(docEnvId: string): Promise<void> {
        await this.page.evaluate(
            (envId) => {
                return (window as any).api.document.checkout({ id: envId });
            },
            docEnvId
        );
    }

    /**
     * Check in a document
     * @param docEnvId Document environment ID
     */
    async checkInDocument(docEnvId: string): Promise<void> {
        await this.page.evaluate(
            (envId) => {
                return (window as any).api.document.checkin({ id: envId });
            },
            docEnvId
        );
    }

    /**
     * Get document size from ndServer/ducot
     * @param docEnvId Document environment ID
     * @returns Document size (from standardAttributes.size)
     */
    async getDocumentSize(docEnvId: string): Promise<number> {
        const info = await this.getDocumentInfo(docEnvId);
        return info.standardAttributes?.size || 0;
    }

    /**
     * Get document modified timestamp from ndServer/ducot
     * @param docEnvId Document environment ID
     * @returns Document modified timestamp in milliseconds
     */
    async getDocumentModified(docEnvId: string): Promise<number> {
        const info = await this.getDocumentInfo(docEnvId);
        const modifiedStr = info.standardAttributes?.modified || '';
        // Parse /Date(1758198431701)/ format
        const match = modifiedStr.match(/\/Date\((\d+)\)\//);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Wait for document modified date to change from the initial value
     * @param docEnvId Document environment ID
     * @param initialModified The initial modified timestamp to compare against
     * @param timeout Timeout in milliseconds (default: 120000)
     * @param pollInterval Polling interval in milliseconds (default: 3000)
     * @returns The new document modified timestamp
     */
    async waitForDocumentModifiedChanged(docEnvId: string, initialModified: number, timeout: number = 240000, pollInterval: number = 3000): Promise<number> {
        console.log(`Waiting for document modified date to change from ${new Date(initialModified).toISOString()}...`);

        let result = initialModified;
        await expect.poll(
            async () => {
                result = await this.getDocumentModified(docEnvId);
                return result;
            },
            {
                message: `Document modified date did not change from ${new Date(initialModified).toISOString()}`,
                timeout,
                intervals: [pollInterval]
            }
        ).not.toBe(initialModified);

        console.log(`Document modified changed: ${new Date(initialModified).toISOString()} -> ${new Date(result).toISOString()}`);
        return result;
    }

    /**
     * Wait for document size to change from the initial size
     * @param docEnvId Document environment ID
     * @param initialSize The initial size to compare against
     * @param timeout Timeout in milliseconds (default: 120000)
     * @param pollInterval Polling interval in milliseconds (default: 3000)
     * @returns The new document size
     */
    async waitForDocumentSizeChanged(docEnvId: string, initialSize: number, timeout: number = 120000, pollInterval: number = 3000): Promise<number> {
        console.log(`Waiting for document size to change from ${initialSize} bytes...`);

        let result = initialSize;
        await expect.poll(
            async () => {
                result = await this.getDocumentSize(docEnvId);
                return result;
            },
            {
                message: `Document size did not change from ${initialSize} bytes`,
                timeout,
                intervals: [pollInterval]
            }
        ).not.toBe(initialSize);

        console.log(`Document size changed: ${initialSize} -> ${result} bytes`);
        return result;
    }

    /**
     * Wait for a document to be indexed and searchable
     * @param docName Name of the document to search for
     * @param cabGuid Cabinet GUID (default: NG-ZEXODA50)
     * @param timeout Timeout in milliseconds (default: 60000)
     * @param pollInterval Polling interval in milliseconds (default: 2000)
     * @returns true if document is found, throws error on timeout
     */
    async waitForIndexed(docName: string, cabGuid: string = 'NG-ZEXODA50', timeout: number = 60000, pollInterval: number = 2000): Promise<boolean> {
        console.log(`Waiting for document "${docName}" to be indexed...`);

        await expect.poll(
            async () => {
                return await this.page.evaluate(
                    ({ cabGuid, docName }) => {
                        try {
                            const result = (window as any).api.search.performSearch({
                                cabGuid: cabGuid,
                                criteria: ` =3(${docName})`
                            });
                            return result && result.list && result.list.length > 0;
                        } catch {
                            return false;
                        }
                    },
                    { cabGuid, docName }
                );
            },
            {
                message: `Document "${docName}" was not indexed`,
                timeout,
                intervals: [pollInterval]
            }
        ).toBe(true);

        console.log(`Document "${docName}" is now indexed.`);
        return true;
    }
}


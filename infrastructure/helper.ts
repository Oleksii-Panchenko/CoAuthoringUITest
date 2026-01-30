import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper utility functions for tests
 */
export class Helper {
    /**
     * Wait for a condition to be true
     * @param func Function that returns a boolean or Promise<boolean>
     * @param timeout Timeout in milliseconds (default: 60000)
     * @param period Check interval in milliseconds (default: 1000)
     * @param errMessage Error message to throw on timeout
     */
    static async waitForTrue(
        func: () => boolean | Promise<boolean>,
        timeout: number = 60000,
        period: number = 1000,
        errMessage?: string
    ): Promise<void> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const result = await func();
                if (result) {
                    return;
                }
            } catch (error) {
                // Ignore exceptions and retry
            }
            await new Promise(resolve => setTimeout(resolve, period));
        }
        
        throw new Error(errMessage || `waitForTrue timed out after ${timeout}ms`);
    }

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
     * Sleep for specified milliseconds
     * @param ms Milliseconds to sleep
     */
    static async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


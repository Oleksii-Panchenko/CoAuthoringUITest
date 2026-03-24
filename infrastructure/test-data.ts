export type FileType = 'docx' | 'pptx' | 'xlsx';

export interface UserCredentials {
    username: string;
    password: string;
    section: string;
}

export type DocKey =
    | '13mb'
    | '20mb'
    | '32mb'
    | '60mb'
    | '95mb'
    | '95mb-xlsx'
    | '112mb-pptx';

export interface EnvironmentConfig {
    baseUrl: string;
    users: UserCredentials[];
    sourceDocuments: Record<DocKey, string>;
    destinationEnvId: string;
    /** Resolved from SOURCE_DOC_KEY env var (default: '20mb'). */
    sourceDocKey: DocKey;
}

function required(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env variable: ${key}`);
    return value;
}

function getUsersFromEnv(): UserCredentials[] {
    const users: UserCredentials[] = [];
    let i = 1;
    while (process.env[`USER_${i}_USERNAME`]) {
        users.push({
            username: process.env[`USER_${i}_USERNAME`]!,
            password: process.env[`USER_${i}_PASSWORD`]!,
            section:  process.env[`USER_${i}_SECTION`]!,
        });
        i++;
    }
    if (users.length === 0) {
        throw new Error(
            'No users found in env. Define USER_1_USERNAME, USER_1_PASSWORD, USER_1_SECTION (and USER_2_*, etc.)'
        );
    }
    return users;
}

export function getEnvironmentConfig(): EnvironmentConfig {
    return {
        baseUrl:          required('BASE_URL'),
        destinationEnvId: required('DESTINATION_ENV_ID'),
        users:            getUsersFromEnv(),
        sourceDocuments: {
            '13mb':      required('DOC_13MB'),
            '20mb':      required('DOC_20MB'),
            '32mb':      required('DOC_32MB'),
            '60mb':      required('DOC_60MB'),
            '95mb':      required('DOC_95MB'),
            '95mb-xlsx': required('DOC_95MB_XLSX'),
            '112mb-pptx': required('DOC_112MB_PPTX'),
        },
        sourceDocKey: (process.env.SOURCE_DOC_KEY ?? '20mb') as DocKey,
    };
}

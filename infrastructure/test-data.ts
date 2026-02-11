export interface UserCredentials {
    username: string;
    password: string;
    section: string;
}

export interface EnvironmentConfig {
    baseUrl: string;
    users: UserCredentials[];
    sourceDocuments: {
        '13mb': string;
        '20mb': string;
        '32mb': string;
        '60mb': string;
    };
    destinationEnvId: string;
}

const envConfigs: Record<string, EnvironmentConfig> = {
    DEV: {
        baseUrl: 'https://wopi-ducot.netdocuments.com',
        users: [
            { username: 'csppoo3', password: 'rewq4fdsa', section: 'UserA' },
            { username: 'csppoo4', password: 'rewq4fdsa', section: 'UserB' },
            { username: 'csppoo5', password: 'rewq4fdsa', section: 'UserC' },
            { username: 'csppoo6', password: 'rewq4fdsa', section: 'UserD' },
            { username: 'csppoo7', password: 'rewq4fdsa', section: 'UserE' },
            { username: 'csppoo8', password: 'rewq4fdsa', section: 'UserF' },
            { username: 'csppoo9', password: 'rewq4fdsa', section: 'UserG' },
            { username: 'csppoo10', password: 'rewq4fdsa', section: 'UserH' },
            { username: 'csppoo11', password: 'rewq4fdsa', section: 'UserI' },
            { username: 'csppoo12', password: 'rewq4fdsa', section: 'UserJ' },
            { username: 'csppoo', password: 'read4few', section: 'UserK' },
            { username: 'csppmd', password: 'read4few', section: 'UserL' },
        ],
        sourceDocuments: {
            '13mb': '4833-5453-1267',
            '20mb': '4820-0102-3171',
            '32mb': '4831-1139-9363',
            '60mb': '4840-2568-5443',
        },
        destinationEnvId: ':Ducot5:y:1:5:h:^F251030114932046.nev',
    },
    QA: {
        baseUrl: 'https://ducot.netdocuments.com',
        users: [
            { username: 'csppoo3', password: 'rewq4fdsa', section: 'UserA' },
            { username: 'csppoo4', password: 'rewq4fdsa', section: 'UserB' },
            { username: 'csppoo5', password: 'rewq4fdsa', section: 'UserC' },
            { username: 'csppoo6', password: 'rewq4fdsa', section: 'UserD' },
            { username: 'csppoo7', password: 'rewq4fdsa', section: 'UserE' },
            { username: 'csppoo8', password: 'rewq4fdsa', section: 'UserF' },
            { username: 'csppoo9', password: 'rewq4fdsa', section: 'UserG' },
            { username: 'csppoo10', password: 'rewq4fdsa', section: 'UserH' },
            { username: 'csppoo11', password: 'rewq4fdsa', section: 'UserI' },
            { username: 'csppoo12', password: 'rewq4fdsa', section: 'UserJ' },
            { username: 'csppoo', password: 'read4few', section: 'UserK' },
            { username: 'csppmd', password: 'read4few', section: 'UserL' },
        ],
        sourceDocuments: {
            '13mb': '4833-5453-1267',
            '20mb': '4820-0102-3171',
            '32mb': '4831-1139-9363',
            '60mb': '4840-2568-5443',
        },
        destinationEnvId: ':Ducot5:y:1:5:h:^F251030114932046.nev',
    },
    PROD: {
        baseUrl: 'https://vault.netvoyage.com',
        users: [
            { username: 'csppoo3', password: 'rewq4fdsa', section: 'UserA' },
            { username: 'csppoo4', password: 'rewq4fdsa', section: 'UserB' },
            { username: 'csppoo5', password: 'rewq4fdsa', section: 'UserC' },
            { username: 'csppoo6', password: 'rewq4fdsa', section: 'UserD' },
            { username: 'csppoo7', password: 'rewq4fdsa', section: 'UserE' },
            { username: 'csppoo8', password: 'rewq4fdsa', section: 'UserF' },
            { username: 'csppoo9', password: 'rewq4fdsa', section: 'UserG' },
            { username: 'csppoo10', password: 'rewq4fdsa', section: 'UserH' },
            { username: 'csppoo11', password: 'rewq4fdsa', section: 'UserI' },
            { username: 'csppoo12', password: 'rewq4fdsa', section: 'UserJ' },
            { username: 'csppoo', password: 'read4few', section: 'UserK' },
            { username: 'csppmd', password: 'read4few', section: 'UserL' },
        ],
        sourceDocuments: {
            '13mb': '4833-5453-1267',
            '20mb': '4820-0102-3171',
            '32mb': '4831-1139-9363',
            '60mb': '4840-2568-5443',
        },
        destinationEnvId: ':Ducot5:y:1:5:h:^F251030114932046.nev',
    },
};

export function getEnvironmentConfig(env: string): EnvironmentConfig {
    return envConfigs[env] || envConfigs['QA'];
}

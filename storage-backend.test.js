// storage-backend.test.js - Unit tests for Storage Backend

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
        removeItem: (key) => {
            delete store[key];
        }
    };
})();

global.localStorage = localStorageMock;

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
    writable: true,
    value: true
});

// Mock window.addEventListener
global.window = {
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn()
};

// Import the classes to test
const { LocalStorageBackend, GoogleDriveBackend, StorageManager } = require('./storage-backend.js');

describe('StorageBackend', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    describe('LocalStorageBackend', () => {
        let backend;

        beforeEach(() => {
            localStorageMock.clear(); // Clear ALL storage before each test
            backend = new LocalStorageBackend();
        });

        test('should return empty array when no cards stored', async () => {
            const loaded = await backend.loadCards();
            expect(loaded).toEqual([]);
        });

        test('should save and load cards', async () => {
            const cards = [
                { id: '1', number: '123', name: 'Test Card', currentBalance: 50 }
            ];

            await backend.saveCards(cards);
            const loaded = await backend.loadCards();

            expect(loaded).toEqual(cards);
        });

        test('should be available', async () => {
            const available = await backend.isAvailable();
            expect(available).toBe(true);
        });

        test('should return correct name', () => {
            expect(backend.getName()).toBe('Local Storage');
        });

        test('should return correct status', async () => {
            const status = await backend.getStatus();
            expect(status.type).toBe('local');
            expect(status.connected).toBe(true);
        });
    });

    describe('GoogleDriveBackend', () => {
        let backend;

        beforeEach(() => {
            localStorageMock.clear(); // Clear ALL storage before each test
            backend = new GoogleDriveBackend();
            global.navigator.onLine = true;
        });

        test('should initialize with offline queue', () => {
            expect(backend.offlineQueue).toEqual([]);
        });

        test('should cache cards locally', () => {
            const cards = [
                { id: '1', number: '123', name: 'Test Card' }
            ];

            backend.cacheCards(cards);
            const cached = backend.loadCachedCards();

            expect(cached).toEqual(cards);
        });

        test('should load cached cards when offline', async () => {
            const cards = [
                { id: '1', number: '123', name: 'Test Card' }
            ];

            backend.cacheCards(cards);
            backend.isOnline = false;

            const loaded = await backend.loadCards();
            expect(loaded).toEqual(cards);
        });

        test('should queue operations when offline', async () => {
            const cards = [
                { id: '1', number: '123', name: 'Test Card' }
            ];

            backend.isOnline = false;
            backend.accessToken = 'test-token';
            backend.fileId = 'test-file-id';

            await backend.saveCards(cards);

            expect(backend.offlineQueue.length).toBe(1);
            expect(backend.offlineQueue[0].operation).toBe('save');
            expect(backend.offlineQueue[0].data).toEqual(cards);
            
            // Clean up - clear the config saved by saveCards
            backend.clearConfig();
        });

        test('should return correct name', () => {
            expect(backend.getName()).toBe('Google Drive');
        });

        test('should return not available when not connected', async () => {
            const available = await backend.isAvailable();
            expect(available).toBe(false);
        });

        test('should return correct status when not connected', async () => {
            const status = await backend.getStatus();
            expect(status.type).toBe('google-drive');
            expect(status.connected).toBe(false);
        });

        test('should return available when connected', async () => {
            backend.accessToken = 'test-token';
            backend.fileId = 'test-file-id';

            const available = await backend.isAvailable();
            expect(available).toBe(true);
        });

        test('should return correct status when connected', async () => {
            backend.accessToken = 'test-token';
            backend.fileId = 'test-file-id';
            backend.userInfo = { email: 'test@example.com', name: 'Test User' };

            const status = await backend.getStatus();
            expect(status.type).toBe('google-drive');
            expect(status.connected).toBe(true);
            expect(status.userInfo).toEqual(backend.userInfo);
        });

        test('should include queue status in status', async () => {
            backend.accessToken = 'test-token';
            backend.fileId = 'test-file-id';
            backend.offlineQueue = [
                { operation: 'save', data: [], timestamp: new Date().toISOString() }
            ];

            const status = await backend.getStatus();
            expect(status.pendingSync).toBe(true);
            expect(status.queueSize).toBe(1);
        });

        test('should clear config', () => {
            backend.accessToken = 'test-token';
            backend.fileId = 'test-file-id';
            backend.saveConfig();

            backend.clearConfig();

            expect(backend.accessToken).toBe(null);
            expect(backend.fileId).toBe(null);
            expect(localStorage.getItem('googleDriveConfig')).toBe(null);
        });

        test('should save and load config', () => {
            backend.accessToken = 'test-token';
            backend.fileId = 'test-file-id';
            backend.userInfo = { email: 'test@example.com' };
            backend.saveConfig();

            const newBackend = new GoogleDriveBackend();
            expect(newBackend.accessToken).toBe('test-token');
            expect(newBackend.fileId).toBe('test-file-id');
            expect(newBackend.userInfo).toEqual({ email: 'test@example.com' });
            
            // Clean up after this test
            newBackend.clearConfig();
        });
    });

    describe('StorageManager', () => {
        let manager;

        beforeEach(() => {
            localStorageMock.clear(); // Clear ALL storage before each test
            manager = new StorageManager();
        });

        test('should initialize with local backend by default', () => {
            expect(manager.getBackend().getName()).toBe('Local Storage');
        });

        test('should save backend preference', async () => {
            manager.saveBackendPreference('local');
            const pref = localStorage.getItem('storageBackendPreference');
            expect(pref).toBe('local');
        });

        test('should not switch to unavailable backend', async () => {
            await expect(manager.switchBackend('google-drive')).rejects.toThrow();
            expect(manager.getBackend().getName()).toBe('Local Storage');
        });

        test('should switch backends', async () => {
            // Mock Google Drive backend as available
            const driveBackend = manager.getBackends()['google-drive'];
            driveBackend.accessToken = 'test-token';
            driveBackend.fileId = 'test-file-id';

            await manager.switchBackend('google-drive');

            expect(manager.getBackend().getName()).toBe('Google Drive');
            
            // Clean up - switch back to local
            await manager.switchBackend('local');
        });

        test('should load cards using current backend', async () => {
            const cards = [
                { id: '1', number: '123', name: 'Test Card' }
            ];

            await manager.saveCards(cards);
            const loaded = await manager.loadCards();

            expect(loaded).toEqual(cards);
        });

        test('should get status from current backend', async () => {
            const status = await manager.getStatus();
            expect(status.type).toBe('local');
        });
    });

    describe('Transaction owner tracking', () => {
        test('should include owner in transaction', () => {
            const transaction = {
                date: new Date().toISOString(),
                amount: -10,
                type: 'spend',
                balanceAfter: 40,
                description: 'Test purchase',
                owner: 'test@example.com'
            };

            expect(transaction.owner).toBe('test@example.com');
        });
    });
});

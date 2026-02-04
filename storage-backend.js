// Storage Backend Abstraction Layer
// Provides interface for different storage backends (LocalStorage, Google Drive)

// Application version (matches package.json)
const APP_VERSION = '2.1.0';

// Base Storage Backend Interface
class StorageBackend {
    constructor() {
        if (new.target === StorageBackend) {
            throw new TypeError("Cannot construct StorageBackend instances directly");
        }
    }

    // Load cards from storage
    async loadCards() {
        throw new Error("Method 'loadCards()' must be implemented");
    }

    // Save cards to storage
    async saveCards(cards) {
        throw new Error("Method 'saveCards()' must be implemented");
    }

    // Check if backend is available/connected
    async isAvailable() {
        throw new Error("Method 'isAvailable()' must be implemented");
    }

    // Get backend name for display
    getName() {
        throw new Error("Method 'getName()' must be implemented");
    }

    // Get connection status info
    async getStatus() {
        throw new Error("Method 'getStatus()' must be implemented");
    }
}

// LocalStorage Backend Implementation
class LocalStorageBackend extends StorageBackend {
    constructor() {
        super();
        this.storageKey = 'giftCards';
    }

    async loadCards() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Unable to load cards from localStorage:', error);
            return [];
        }
    }

    async saveCards(cards) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(cards));
        } catch (error) {
            console.error('Unable to save cards to localStorage:', error);
            throw error;
        }
    }

    async isAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    getName() {
        return 'Local Storage';
    }

    async getStatus() {
        return {
            connected: await this.isAvailable(),
            type: 'local',
            info: 'Data stored locally in browser'
        };
    }
}

// Google Drive Backend Implementation
class GoogleDriveBackend extends StorageBackend {
    constructor() {
        super();
        this.accessToken = null;
        this.fileId = null;
        this.userInfo = null;
        this.lastSyncTime = null;
        this.offlineQueue = [];
        this.isOnline = navigator.onLine;
        this.loadConfig();
        this.setupOfflineHandlers();
    }

    // Setup offline/online event handlers
    setupOfflineHandlers() {
        window.addEventListener('online', () => {
            console.log('Back online, syncing...');
            this.isOnline = true;
            this.syncOfflineChanges();
        });

        window.addEventListener('offline', () => {
            console.log('Gone offline');
            this.isOnline = false;
        });
    }

    // Load saved configuration from localStorage
    loadConfig() {
        try {
            const config = localStorage.getItem('googleDriveConfig');
            if (config) {
                const parsed = JSON.parse(config);
                this.accessToken = parsed.accessToken;
                this.fileId = parsed.fileId;
                this.userInfo = parsed.userInfo;
                this.lastSyncTime = parsed.lastSyncTime;
            }
            
            // Load offline queue
            const queue = localStorage.getItem('googleDriveOfflineQueue');
            if (queue) {
                this.offlineQueue = JSON.parse(queue);
            }
        } catch (error) {
            console.warn('Unable to load Google Drive config:', error);
        }
    }

    // Save configuration to localStorage
    saveConfig() {
        try {
            const config = {
                accessToken: this.accessToken,
                fileId: this.fileId,
                userInfo: this.userInfo,
                lastSyncTime: this.lastSyncTime
            };
            localStorage.setItem('googleDriveConfig', JSON.stringify(config));
            
            // Save offline queue
            localStorage.setItem('googleDriveOfflineQueue', JSON.stringify(this.offlineQueue));
        } catch (error) {
            console.error('Unable to save Google Drive config:', error);
        }
    }

    // Clear configuration
    clearConfig() {
        this.accessToken = null;
        this.fileId = null;
        this.userInfo = null;
        this.lastSyncTime = null;
        this.offlineQueue = [];
        try {
            localStorage.removeItem('googleDriveConfig');
            localStorage.removeItem('googleDriveOfflineQueue');
            localStorage.removeItem('googleDriveCache');
        } catch (error) {
            console.error('Unable to clear Google Drive config:', error);
        }
    }

    // Cache cards locally for offline access
    cacheCards(cards) {
        try {
            localStorage.setItem('googleDriveCache', JSON.stringify({
                cards: cards,
                cachedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Unable to cache cards:', error);
        }
    }

    // Load cached cards
    loadCachedCards() {
        try {
            const cached = localStorage.getItem('googleDriveCache');
            if (cached) {
                const data = JSON.parse(cached);
                return data.cards || [];
            }
        } catch (error) {
            console.warn('Unable to load cached cards:', error);
        }
        return [];
    }

    // Add operation to offline queue
    queueOfflineOperation(operation, data) {
        this.offlineQueue.push({
            operation,
            data,
            timestamp: new Date().toISOString()
        });
        this.saveConfig();
    }

    // Sync offline changes when back online
    async syncOfflineChanges() {
        if (this.offlineQueue.length === 0) return;

        try {
            // Process queued operations
            for (const item of this.offlineQueue) {
                if (item.operation === 'save') {
                    await this.saveCardsToDrive(item.data);
                }
            }

            // Clear queue after successful sync
            this.offlineQueue = [];
            this.saveConfig();

            // Dispatch event for UI update
            window.dispatchEvent(new CustomEvent('storageSynced', {
                detail: { backend: 'google-drive', success: true }
            }));
        } catch (error) {
            console.error('Failed to sync offline changes:', error);
            window.dispatchEvent(new CustomEvent('storageSyncFailed', {
                detail: { backend: 'google-drive', error: error.message }
            }));
        }
    }

    // Get Client ID from localStorage
    getClientId() {
        try {
            const clientId = localStorage.getItem('googleClientId');
            return clientId;
        } catch (error) {
            console.warn('Unable to load Client ID:', error);
        }
        return null;
    }

    // Save Client ID to localStorage
    saveClientId(clientId) {
        try {
            localStorage.setItem('googleClientId', clientId);
        } catch (error) {
            console.error('Unable to save Client ID:', error);
        }
    }

    // Check if Client ID is configured
    hasClientId() {
        const clientId = this.getClientId();
        return clientId && clientId.length > 0;
    }

    // Initialize Google API
    async initGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (typeof gapi === 'undefined') {
                reject(new Error('Google API not loaded'));
                return;
            }

            // Load Client ID from localStorage
            const clientId = this.getClientId();
            if (!clientId) {
                reject(new Error('Client ID not configured. Please configure it in the Storage section.'));
                return;
            }

            // Store Client ID for later use with GIS
            this.clientId = clientId;

            gapi.load('client:picker', async () => {
                try {
                    // Initialize without API key - OAuth is sufficient for Drive API access
                    await gapi.client.init({
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // Authenticate with Google using Google Identity Services (GIS)
    async authenticate() {
        try {
            // Check if Google API is loaded
            if (typeof gapi === 'undefined') {
                throw new Error('Google API not loaded. Please check your internet connection.');
            }

            // Check if Google Identity Services is loaded
            if (typeof google === 'undefined' || !google.accounts) {
                throw new Error('Google Identity Services not loaded. Please check your internet connection.');
            }

            // Initialize if needed
            if (!gapi.client || !gapi.client.drive) {
                await this.initGoogleAPI();
            }

            // Use Google Identity Services for authentication
            const tokenResponse = await new Promise((resolve, reject) => {
                const client = google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                    callback: (response) => {
                        if (response.error) {
                            reject(response);
                        } else {
                            resolve(response);
                        }
                    }
                });
                
                // Try silent authentication first for returning users
                // If it fails, user will be prompted to grant consent
                try {
                    client.requestAccessToken({ prompt: '' });
                } catch (error) {
                    // If silent auth fails, fall back to consent prompt
                    console.log('Silent authentication failed, requesting consent');
                    client.requestAccessToken({ prompt: 'consent' });
                }
            });

            this.accessToken = tokenResponse.access_token;

            // Set the access token for gapi.client
            gapi.client.setToken({
                access_token: this.accessToken
            });

            // Get user info using the access token
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (!userInfoResponse.ok) {
                throw new Error('Failed to get user info');
            }

            const userInfo = await userInfoResponse.json();
            this.userInfo = {
                id: userInfo.id,
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture
            };

            this.saveConfig();
            return true;
        } catch (error) {
            console.error('Google authentication failed:', error);
            throw error;
        }
    }

    // Sign out from Google
    async signOut() {
        try {
            // Revoke the token with proper error handling
            if (this.accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                await new Promise((resolve) => {
                    google.accounts.oauth2.revoke(this.accessToken, (done) => {
                        if (done.error) {
                            console.error('Token revocation failed:', done.error);
                        } else {
                            console.log('Token revoked successfully');
                        }
                        // Always resolve to allow cleanup to proceed
                        resolve();
                    });
                });
            }
            
            // Clear the token from gapi.client
            if (typeof gapi !== 'undefined' && gapi.client) {
                gapi.client.setToken(null);
            }
            
            this.clearConfig();
        } catch (error) {
            console.error('Google sign out failed:', error);
            throw error;
        }
    }

    // Ensure Google Picker API is loaded
    async ensurePickerLoaded() {
        return new Promise((resolve, reject) => {
            // Check if picker is already loaded
            if (typeof google !== 'undefined' && google.picker) {
                resolve();
                return;
            }

            // If not loaded, wait for it
            if (typeof gapi === 'undefined') {
                reject(new Error('Google API not loaded'));
                return;
            }

            // Load picker explicitly
            gapi.load('picker', {
                callback: () => {
                    if (typeof google !== 'undefined' && google.picker) {
                        resolve();
                    } else {
                        reject(new Error('Failed to load Google Picker API'));
                    }
                },
                onerror: () => {
                    reject(new Error('Error loading Google Picker API'));
                },
                timeout: 5000,
                ontimeout: () => {
                    reject(new Error('Timeout loading Google Picker API'));
                }
            });
        });
    }

    // Select or create a file in Google Drive
    async selectFile() {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // Ensure picker is loaded before using it
        await this.ensurePickerLoaded();

        return new Promise((resolve, reject) => {
            // Use Google Picker API to select a file
            if (typeof google === 'undefined' || !google.picker) {
                reject(new Error('Google Picker API not loaded'));
                return;
            }

            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(this.accessToken)
                // Developer key (API key) is optional - OAuth token is sufficient
                .setCallback((data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        const file = data.docs[0];
                        this.fileId = file.id;
                        this.saveConfig();
                        resolve(file);
                    } else if (data.action === google.picker.Action.CANCEL) {
                        reject(new Error('File selection cancelled'));
                    }
                })
                .build();
            picker.setVisible(true);
        });
    }

    // Create a new file in Google Drive
    async createFile(fileName = 'gift-cards.json') {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        try {
            const metadata = {
                name: fileName,
                mimeType: 'application/json'
            };

            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });

            if (!response.ok) {
                throw new Error(`Failed to create file: ${response.status}`);
            }

            const file = await response.json();
            this.fileId = file.id;
            this.saveConfig();

            // Initialize with empty cards array
            await this.saveCards([]);

            return file;
        } catch (error) {
            console.error('Failed to create file:', error);
            throw error;
        }
    }

    // Load cards from Google Drive
    async loadCards() {
        if (!this.accessToken || !this.fileId) {
            // Try to load from cache if offline
            return this.loadCachedCards();
        }

        // If offline, return cached data
        if (!this.isOnline) {
            console.log('Offline: loading from cache');
            return this.loadCachedCards();
        }

        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    // File not found, return cached or empty array
                    return this.loadCachedCards();
                }
                throw new Error(`Failed to load cards: ${response.status}`);
            }

            const data = await response.json();
            const cards = data.cards || [];
            
            this.lastSyncTime = new Date().toISOString();
            this.saveConfig();

            // Cache the loaded cards
            this.cacheCards(cards);

            return cards;
        } catch (error) {
            console.error('Failed to load cards from Google Drive, using cache:', error);
            // Return cached data as fallback
            return this.loadCachedCards();
        }
    }

    // Merge cards from two sources (conflict resolution)
    mergeCards(localCards, remoteCards) {
        const merged = {};
        
        // Index local cards by ID
        localCards.forEach(card => {
            merged[card.id] = { card, source: 'local' };
        });
        
        // Merge remote cards
        remoteCards.forEach(remoteCard => {
            const localEntry = merged[remoteCard.id];
            
            if (!localEntry) {
                // Card only exists remotely, add it
                merged[remoteCard.id] = { card: remoteCard, source: 'remote' };
            } else {
                const localCard = localEntry.card;
                
                // Merge transactions from both sources
                const allTransactions = {};
                
                // Add local transactions
                localCard.transactions.forEach(t => {
                    allTransactions[t.date + t.amount] = t;
                });
                
                // Add remote transactions (newer ones win)
                remoteCard.transactions.forEach(t => {
                    const key = t.date + t.amount;
                    if (!allTransactions[key] || new Date(t.date) >= new Date(allTransactions[key].date)) {
                        allTransactions[key] = t;
                    }
                });
                
                // Sort transactions by date
                const mergedTransactions = Object.values(allTransactions).sort((a, b) => 
                    new Date(a.date) - new Date(b.date)
                );
                
                // Use the card with the most recent modification
                const localModified = new Date(localCard.lastModified || 0);
                const remoteModified = new Date(remoteCard.lastModified || 0);
                
                const newerCard = remoteModified > localModified ? remoteCard : localCard;
                
                // Create merged card
                merged[remoteCard.id] = {
                    card: {
                        ...newerCard,
                        transactions: mergedTransactions,
                        currentBalance: this.calculateBalance(mergedTransactions, newerCard.initialBalance),
                        lastModified: new Date().toISOString()
                    },
                    source: 'merged'
                };
            }
        });
        
        return Object.values(merged).map(entry => entry.card);
    }
    
    // Calculate balance from transactions
    calculateBalance(transactions, initialBalance = 0) {
        if (transactions.length === 0) return initialBalance;
        
        // If last transaction has balanceAfter, use it
        const lastTransaction = transactions[transactions.length - 1];
        if (lastTransaction.balanceAfter !== undefined && lastTransaction.balanceAfter !== null) {
            return lastTransaction.balanceAfter;
        }
        
        // Otherwise calculate from all transactions
        let balance = initialBalance;
        for (const transaction of transactions) {
            if (transaction.balanceAfter !== undefined && transaction.balanceAfter !== null) {
                balance = transaction.balanceAfter;
            } else {
                balance += transaction.amount;
            }
        }
        return balance;
    }

    // Internal method to save directly to Drive
    async saveCardsToDrive(cards) {
        if (!this.accessToken || !this.fileId) {
            throw new Error('Not connected to Google Drive');
        }
        
        // First, check if there are remote changes we need to merge
        try {
            const remoteData = await this.loadCardsFromDrive();
            const remoteCards = remoteData.cards || [];
            
            // Check if remote was modified after our last sync
            if (remoteData.lastModified && this.lastSyncTime) {
                const remoteModified = new Date(remoteData.lastModified);
                const lastSync = new Date(this.lastSyncTime);
                
                if (remoteModified > lastSync) {
                    // Remote has changes, need to merge
                    console.log('Detected remote changes, merging...');
                    cards = this.mergeCards(cards, remoteCards);
                }
            }
        } catch (error) {
            // If we can't load remote, proceed with save (might be first save)
            console.log('Could not check for remote changes, proceeding with save');
        }

        const data = {
            cards: cards,
            version: APP_VERSION,
            lastModified: new Date().toISOString()
        };

        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to save cards: ${response.status}`);
        }

        this.lastSyncTime = new Date().toISOString();
        this.saveConfig();
        
        return cards; // Return merged cards
    }
    
    // Load cards from Drive (internal, does not update cache)
    async loadCardsFromDrive() {
        if (!this.accessToken || !this.fileId) {
            throw new Error('Not connected to Google Drive');
        }
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to load cards: ${response.status}`);
        }

        return await response.json();
    }

    // Save cards to Google Drive
    async saveCards(cards) {
        if (!this.accessToken || !this.fileId) {
            throw new Error('Not connected to Google Drive');
        }

        // Always cache locally first
        this.cacheCards(cards);

        // If offline, queue the operation
        if (!this.isOnline) {
            console.log('Offline: queuing save operation');
            this.queueOfflineOperation('save', cards);
            return cards; // Return original cards
        }

        try {
            const mergedCards = await this.saveCardsToDrive(cards);
            // If cards were merged, update cache with merged version
            if (mergedCards && mergedCards !== cards) {
                this.cacheCards(mergedCards);
                return mergedCards; // Return merged cards so caller can update
            }
            return cards;
        } catch (error) {
            console.error('Failed to save cards to Google Drive, queuing for later:', error);
            // Queue for retry when back online
            this.queueOfflineOperation('save', cards);
            // Don't throw - allow local operations to continue
            return cards;
        }
    }

    // Check if backend is available
    async isAvailable() {
        return this.accessToken !== null && this.fileId !== null;
    }

    getName() {
        return 'Google Drive';
    }

    async getStatus() {
        const connected = await this.isAvailable();
        return {
            connected,
            type: 'google-drive',
            info: connected
                ? `Connected as ${this.userInfo?.email || 'Unknown'}`
                : 'Not connected',
            userInfo: this.userInfo,
            lastSyncTime: this.lastSyncTime,
            fileId: this.fileId,
            isOnline: this.isOnline,
            pendingSync: this.offlineQueue.length > 0,
            queueSize: this.offlineQueue.length
        };
    }
}

// Storage Manager - manages current backend
class StorageManager {
    constructor() {
        this.backends = {
            local: new LocalStorageBackend(),
            'google-drive': new GoogleDriveBackend()
        };
        this.currentBackend = null;
        this.loadBackendPreference();
    }

    // Load saved backend preference
    loadBackendPreference() {
        try {
            const pref = localStorage.getItem('storageBackendPreference');
            if (pref && this.backends[pref]) {
                this.currentBackend = this.backends[pref];
            } else {
                this.currentBackend = this.backends.local;
            }
        } catch (error) {
            console.warn('Unable to load backend preference:', error);
            this.currentBackend = this.backends.local;
        }
    }

    // Save backend preference
    saveBackendPreference(backendType) {
        try {
            localStorage.setItem('storageBackendPreference', backendType);
        } catch (error) {
            console.error('Unable to save backend preference:', error);
        }
    }

    // Switch to a different backend
    async switchBackend(backendType) {
        if (!this.backends[backendType]) {
            throw new Error(`Unknown backend type: ${backendType}`);
        }

        const newBackend = this.backends[backendType];
        
        // Check if new backend is available
        const available = await newBackend.isAvailable();
        if (!available && backendType !== 'local') {
            throw new Error(`Backend ${backendType} is not available`);
        }

        this.currentBackend = newBackend;
        this.saveBackendPreference(backendType);
    }

    // Get current backend
    getBackend() {
        return this.currentBackend;
    }

    // Get all available backends
    getBackends() {
        return this.backends;
    }

    // Load cards using current backend
    async loadCards() {
        return await this.currentBackend.loadCards();
    }

    // Save cards using current backend
    async saveCards(cards) {
        return await this.currentBackend.saveCards(cards);
    }

    // Get current backend status
    async getStatus() {
        return await this.currentBackend.getStatus();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        StorageBackend, 
        LocalStorageBackend, 
        GoogleDriveBackend,
        StorageManager
    };
}

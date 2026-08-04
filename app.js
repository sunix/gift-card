// Gift Card Manager Application
class GiftCardManager {
    // Constants
    static DEFAULT_ARCHIVED_STATE = false;
    static PDFJS_VERSION = '3.11.174';
    
    constructor() {
        this.cards = this.loadCards();
        this.stores = [];
        this.draggedElement = null;
        this.draggedCardId = null;
        this.pendingBarcodeFormat = null;
        this.barcodeScannerStream = null;
        this.barcodeScannerFrameRequest = null;
        this.isScanningBarcodeFrame = false;
        this.preferredBarcodeDetectorFormats = null;
    }

    // Get locale string for date formatting based on current language
    getLocaleForLanguage(lang) {
        const localeMap = {
            'fr': 'fr-FR',
            'en': 'en-US',
            'uk': 'uk-UA',
            'ru': 'ru-RU'
        };
        return localeMap[lang] || 'en-US';
    }

    // Check if a card is a fidelity card (no balance tracking)
    isFidelityCard(card) {
        // Fidelity cards have null or 0 initialBalance AND null or 0 currentBalance
        // Gift cards have a positive initialBalance (even if currentBalance is 0 after spending)
        return (card.initialBalance === null || card.initialBalance === undefined || card.initialBalance === 0) &&
               (card.currentBalance === null || card.currentBalance === undefined || card.currentBalance === 0);
    }

    // Check if a card is expired
    isCardExpired(card) {
        if (!card.expiryDate || this.isFidelityCard(card)) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(card.expiryDate);
        return expiryDate < today;
    }

    // Check if a card expires soon (within 30 days)
    isCardExpiringSoon(card) {
        if (!card.expiryDate || this.isFidelityCard(card)) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(card.expiryDate);
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    }

    // Format expiry date for display
    formatExpiryDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        const currentLang = i18n.getCurrentLanguage();
        const locale = this.getLocaleForLanguage(currentLang);
        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Load stores configuration
    async loadStores() {
        try {
            const response = await fetch('stores.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch stores: ${response.status}`);
            }
            this.stores = await response.json();
            // Note: We use local SVG fallbacks by default due to CORS restrictions
            // on external retailer websites. Users can manually download official
            // logos and replace the SVG files if desired.
        } catch (error) {
            console.error('Failed to load stores configuration:', error);
            this.stores = [];
        }
    }

    // Get the icon path for a store (uses local fallback due to CORS)
    getStoreIcon(store) {
        // If iconUrl is defined, derive the downloaded file extension
        if (store.iconUrl) {
            try {
                const url = new URL(store.iconUrl);
                const urlExt = url.pathname.split('.').pop().toLowerCase();
                // Check if it's a valid image extension
                if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(urlExt)) {
                    // Build the downloaded file path by replacing the extension
                    // Remove existing extension and add the new one
                    const basePath = store.icon.replace(/\.[^.]+$/, '');
                    const downloadedPath = basePath + '.' + urlExt;
                    // Return the downloaded path - browser will try this first
                    // If it doesn't exist, the image will fail to load and we need to handle that
                    return downloadedPath;
                }
            } catch (e) {
                // Invalid URL, fall through to SVG fallback
            }
        }
        // Use local SVG fallback since external URLs typically have CORS restrictions
        return store.icon;
    }

    // Escape HTML to prevent XSS in store data
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Sanitize CSS color value
    sanitizeColor(color) {
        // Only allow hex colors, rgb/rgba, and named colors
        if (/^#[0-9A-Fa-f]{3,8}$/.test(color) || 
            /^rgb\([\d\s,]+\)$/.test(color) || 
            /^rgba\([\d\s,]+,[\d.]+\)$/.test(color)) {
            return color;
        }
        return null; // Return null if invalid, will use default
    }

    // Sanitize CSS gradient background
    sanitizeBackground(background) {
        // Only allow linear-gradient with hex colors
        if (/^linear-gradient\([\d\w\s,#().-]+\)$/.test(background)) {
            return background;
        }
        return null;
    }

    // Match a card name to a store
    matchStore(cardName) {
        if (!cardName) return null;
        const lowerCardName = cardName.toLowerCase();
        return this.stores.find(store => 
            store.matchStrings.some(match => 
                lowerCardName.includes(match.toLowerCase())
            )
        );
    }

    async init() {
        // Load stores configuration first
        await this.loadStores();
        
        // Handle introduction section positioning
        this.positionIntroSection();
        
        // Load cards on startup
        this.renderCards();
        
        // Set up event listeners
        document.getElementById('addCardForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCard();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        // Import file input
        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importData(e);
        });

        const scanBarcodeCameraBtn = document.getElementById('scanBarcodeCameraBtn');
        if (scanBarcodeCameraBtn) {
            scanBarcodeCameraBtn.addEventListener('click', () => {
                this.startBarcodeCameraScan();
            });
        }

        const importBarcodeImageBtn = document.getElementById('importBarcodeImageBtn');
        if (importBarcodeImageBtn) {
            importBarcodeImageBtn.addEventListener('click', () => {
                document.getElementById('barcodeImageInput').click();
            });
        }

        const barcodeImageInput = document.getElementById('barcodeImageInput');
        if (barcodeImageInput) {
            barcodeImageInput.addEventListener('change', (e) => {
                this.importBarcodeFromImage(e);
            });
        }

        const cancelBarcodeScanBtn = document.getElementById('cancelBarcodeScanBtn');
        if (cancelBarcodeScanBtn) {
            cancelBarcodeScanBtn.addEventListener('click', () => {
                this.stopBarcodeCameraScan();
                this.updateBarcodeImportStatus(i18n.t('form.barcode_scan_cancelled'), 'info');
            });
        }

        // Upload receipt button
        document.getElementById('uploadReceiptBtn').addEventListener('click', () => {
            document.getElementById('receiptFile').click();
        });

        // Receipt file input
        document.getElementById('receiptFile').addEventListener('change', (e) => {
            this.uploadReceipt(e);
        });

        // Modal close button
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('cardDetailModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Handle hash changes for navigation to archived cards section
        this.handleHashNavigation();
        window.addEventListener('hashchange', () => {
            this.handleHashNavigation();
        });
        
        // Listen for language changes to re-render dynamic content
        window.addEventListener('languageChanged', () => {
            this.renderCards();
            // Re-render archived cards if visible
            const archivedSection = document.getElementById('archivedCardsSection');
            if (archivedSection && archivedSection.style.display !== 'none') {
                this.renderArchivedCards();
            }
        });
    }
    
    // Handle navigation based on URL hash
    handleHashNavigation() {
        const hash = window.location.hash;
        
        // All known sections
        const allSectionIds = [
            'archivedCardsSection', 'cardsList', 'addCardSection',
            'importExportSection', 'introSection',
            'shoppingListsSection', 'shoppingListDetailSection'
        ];

        // Shopping list views
        const isShoppingLists = hash === '#shoppingListsSection';
        const isShoppingDetail = hash.startsWith('#shoppingListDetail:');
        const isArchived = hash === '#archivedCardsSection';
        const isDefault = !isShoppingLists && !isShoppingDetail && !isArchived;

        // Default sections shown on main view
        const defaultSections = ['cardsList', 'addCardSection', 'importExportSection', 'introSection'];

        allSectionIds.forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;
            if (isArchived) {
                element.style.display = id === 'archivedCardsSection' ? 'block' : 'none';
            } else if (isShoppingLists) {
                element.style.display = id === 'shoppingListsSection' ? 'block' : 'none';
            } else if (isShoppingDetail) {
                element.style.display = id === 'shoppingListDetailSection' ? 'block' : 'none';
            } else {
                element.style.display = defaultSections.includes(id) ? 'block' : 'none';
            }
        });
        
        // Render appropriate content
        if (isArchived) {
            this.renderArchivedCards();
        } else if (isShoppingLists && window.shoppingListManager) {
            window.shoppingListManager.renderShoppingLists();
        } else if (isShoppingDetail && window.shoppingListManager) {
            const listId = hash.split(':').slice(1).join(':');
            window.shoppingListManager.renderListDetail(listId);
        }
    }

    /**
     * Position the introduction section based on whether this is the user's first visit.
     * On first visit: section stays at the top (as positioned in HTML)
     * On subsequent visits: section is moved to the bottom of the main content
     * Uses localStorage to track visit status with error handling for private browsing mode.
     */
    positionIntroSection() {
        try {
            const hasVisited = localStorage.getItem('hasVisited');
            const introSection = document.getElementById('introSection');
            const main = document.querySelector('main');
            
            if (!hasVisited) {
                // First visit: intro section stays at top (already positioned in HTML)
                localStorage.setItem('hasVisited', 'true');
            } else {
                // Subsequent visits: move intro section to the bottom
                if (introSection && main) {
                    main.appendChild(introSection);
                }
            }
        } catch (error) {
            // Handle localStorage errors (e.g., private browsing mode, storage full)
            console.warn('Unable to access localStorage for intro positioning:', error);
            // Default behavior: keep intro section at top if localStorage fails
        }
    }

    // Load cards from localStorage
    loadCards() {
        try {
            const stored = localStorage.getItem('giftCards');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Unable to load cards from localStorage:', error);
            return [];
        }
    }

    // Save cards to localStorage
    saveCards() {
        try {
            localStorage.setItem('giftCards', JSON.stringify(this.cards));
        } catch (error) {
            console.error('Unable to save cards to localStorage:', error);
            // You could show a user-friendly error message here
        }
    }

    // Add a new gift card
    addCard() {
        const cardNumber = document.getElementById('cardNumber').value.trim();
        const cardName = document.getElementById('cardName').value.trim();
        const initialBalanceValue = document.getElementById('initialBalance').value.trim();
        const expiryDateValue = document.getElementById('expiryDate').value.trim();
        
        // Check if this is a fidelity card (no balance or 0 balance) or a gift card (with balance)
        const isFidelityCard = initialBalanceValue === '' || parseFloat(initialBalanceValue) === 0;
        const initialBalance = isFidelityCard ? null : parseFloat(initialBalanceValue);

        // Check if card number already exists
        if (this.cards.find(card => card.number === cardNumber)) {
            alert(i18n.t('alert.card_exists'));
            return;
        }

        const newCard = {
            id: Date.now().toString(),
            number: cardNumber,
            name: cardName,
            initialBalance: initialBalance,
            currentBalance: initialBalance,
            barcodeFormat: this.pendingBarcodeFormat || 'CODE128',
            transactions: isFidelityCard ? [] : [{
                date: new Date().toISOString(),
                amount: initialBalance,
                type: 'initial',
                balanceAfter: initialBalance,
                description: 'Initial balance'
            }],
            createdAt: new Date().toISOString(),
            archived: GiftCardManager.DEFAULT_ARCHIVED_STATE
        };
        
        // Add expiry date only for gift cards (not fidelity cards)
        if (!isFidelityCard && expiryDateValue) {
            newCard.expiryDate = expiryDateValue;
        }

        this.cards.push(newCard);
        this.saveCards();
        this.renderCards();

        // Reset form
        document.getElementById('addCardForm').reset();
        this.pendingBarcodeFormat = null;
        this.updateBarcodeImportStatus('');
        this.stopBarcodeCameraScan();

        // Show success message
        const alertKey = isFidelityCard ? 'alert.fidelity_added' : 'alert.gift_card_added';
        alert(i18n.t(alertKey, { name: cardName }));
    }

    updateBarcodeImportStatus(message, type = '') {
        const status = document.getElementById('barcodeImportStatus');
        if (!status) {
            return;
        }

        status.textContent = message || '';
        status.className = 'barcode-import-status';
        if (type) {
            status.classList.add(`barcode-import-status-${type}`);
        }
    }

    async getPreferredBarcodeDetectorFormats() {
        const preferredFormats = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'itf', 'codabar'];
        if (this.preferredBarcodeDetectorFormats) {
            return this.preferredBarcodeDetectorFormats;
        }

        if (typeof BarcodeDetector === 'undefined' || !BarcodeDetector.getSupportedFormats) {
            this.preferredBarcodeDetectorFormats = preferredFormats;
            return this.preferredBarcodeDetectorFormats;
        }

        try {
            const supportedFormats = await BarcodeDetector.getSupportedFormats();
            const matchedFormats = preferredFormats.filter(format => supportedFormats.includes(format));
            this.preferredBarcodeDetectorFormats = matchedFormats.length > 0 ? matchedFormats : preferredFormats;
        } catch (error) {
            console.warn('Unable to retrieve supported barcode formats:', error);
            this.preferredBarcodeDetectorFormats = preferredFormats;
        }

        return this.preferredBarcodeDetectorFormats;
    }

    mapDetectedBarcodeFormat(format) {
        const formatMap = {
            'code_128': 'CODE128',
            'code_39': 'CODE39',
            'ean_13': 'EAN13',
            'ean_8': 'EAN8',
            'upc_a': 'UPC',
            'itf': 'ITF14',
            'codabar': 'CODABAR'
        };

        return formatMap[String(format || '').toLowerCase()] || 'CODE128';
    }

    applyDetectedBarcode(rawValue, format) {
        const cardNumberInput = document.getElementById('cardNumber');
        if (!cardNumberInput) {
            return;
        }

        cardNumberInput.value = String(rawValue || '').trim();
        this.pendingBarcodeFormat = this.mapDetectedBarcodeFormat(format);
        this.updateBarcodeImportStatus(i18n.t('form.barcode_import_success', { format: this.pendingBarcodeFormat }), 'success');

        const cardNameInput = document.getElementById('cardName');
        if (cardNameInput && typeof cardNameInput.focus === 'function') {
            cardNameInput.focus();
        }
    }

    async detectBarcodeFromSource(source) {
        if (typeof BarcodeDetector === 'undefined') {
            throw new Error(i18n.t('alert.barcode_import_unsupported'));
        }

        const detector = new BarcodeDetector({
            formats: await this.getPreferredBarcodeDetectorFormats()
        });
        const results = await detector.detect(source);
        return results[0] || null;
    }

    async loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            let objectUrl;

            try {
                objectUrl = URL.createObjectURL(file);
                const image = new Image();

                image.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(image);
                };

                image.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error(i18n.t('alert.import_read_failed')));
                };

                image.src = objectUrl;
            } catch (error) {
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }
                reject(new Error(i18n.t('alert.import_read_failed')));
            }
        });
    }

    async importBarcodeFromImage(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        this.updateBarcodeImportStatus(i18n.t('form.barcode_image_processing'), 'info');

        try {
            const image = await this.loadImageFromFile(file);
            const detectedBarcode = await this.detectBarcodeFromSource(image);

            if (!detectedBarcode) {
                throw new Error(i18n.t('alert.barcode_not_found'));
            }

            this.applyDetectedBarcode(detectedBarcode.rawValue, detectedBarcode.format);
        } catch (error) {
            alert(error.message);
            this.updateBarcodeImportStatus(error.message, 'error');
        } finally {
            event.target.value = '';
        }
    }

    async startBarcodeCameraScan() {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            alert(i18n.t('alert.barcode_camera_unsupported'));
            this.updateBarcodeImportStatus(i18n.t('alert.barcode_camera_unsupported'), 'error');
            return;
        }

        if (typeof BarcodeDetector === 'undefined') {
            alert(i18n.t('alert.barcode_import_unsupported'));
            this.updateBarcodeImportStatus(i18n.t('alert.barcode_import_unsupported'), 'error');
            return;
        }

        const scannerContainer = document.getElementById('barcodeScanner');
        const scannerVideo = document.getElementById('barcodeScannerVideo');
        if (!scannerContainer || !scannerVideo) {
            return;
        }

        this.stopBarcodeCameraScan();
        this.updateBarcodeImportStatus(i18n.t('form.barcode_camera_ready'), 'info');

        try {
            this.barcodeScannerStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                }
            });

            scannerContainer.style.display = 'block';
            scannerVideo.srcObject = this.barcodeScannerStream;
            if (typeof scannerVideo.play === 'function') {
                await scannerVideo.play();
            }

            this.scanBarcodeCameraFrame();
        } catch (error) {
            console.error('Unable to start barcode camera scan:', error);
            this.stopBarcodeCameraScan();
            this.updateBarcodeImportStatus(i18n.t('alert.barcode_camera_failed'), 'error');
            alert(i18n.t('alert.barcode_camera_failed'));
        }
    }

    scanBarcodeCameraFrame() {
        const scannerVideo = document.getElementById('barcodeScannerVideo');
        const videoReadyStateThreshold = typeof HTMLMediaElement !== 'undefined'
            ? HTMLMediaElement.HAVE_CURRENT_DATA
            : 2;

        if (!this.barcodeScannerStream || !scannerVideo || this.isScanningBarcodeFrame) {
            return;
        }

        this.barcodeScannerFrameRequest = requestAnimationFrame(() => {
            if (scannerVideo.readyState < videoReadyStateThreshold) {
                this.scanBarcodeCameraFrame();
                return;
            }

            this.isScanningBarcodeFrame = true;

            this.detectBarcodeFromSource(scannerVideo)
                .then((detectedBarcode) => {
                    if (detectedBarcode) {
                        this.applyDetectedBarcode(detectedBarcode.rawValue, detectedBarcode.format);
                        this.stopBarcodeCameraScan();
                    }
                })
                .catch((error) => {
                    console.warn('Unable to scan barcode from camera frame:', error);
                })
                .finally(() => {
                    const shouldContinueScanning = !!this.barcodeScannerStream;
                    this.isScanningBarcodeFrame = false;

                    if (shouldContinueScanning) {
                        this.scanBarcodeCameraFrame();
                    }
                });
        });
    }

    stopBarcodeCameraScan() {
        if (this.barcodeScannerFrameRequest) {
            cancelAnimationFrame(this.barcodeScannerFrameRequest);
            this.barcodeScannerFrameRequest = null;
        }

        if (this.barcodeScannerStream) {
            this.barcodeScannerStream.getTracks().forEach(track => track.stop());
            this.barcodeScannerStream = null;
        }

        this.isScanningBarcodeFrame = false;

        const scannerContainer = document.getElementById('barcodeScanner');
        if (scannerContainer) {
            scannerContainer.style.display = 'none';
        }

        const scannerVideo = document.getElementById('barcodeScannerVideo');
        if (scannerVideo) {
            scannerVideo.srcObject = null;
        }
    }

    // Render all cards
    renderCards() {
        const container = document.getElementById('cardsContainer');
        
        // Filter out archived cards
        const activeCards = this.cards.filter(card => !card.archived);
        const archivedCards = this.cards.filter(card => card.archived);
        
        if (activeCards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p><span>${i18n.t('cards.empty')}</span><a href="#addCardSection" class="nav-section-link">${i18n.t('cards.empty_link')}</a>!</p>
                </div>
            `;
            
            // Still show link to archived cards if there are any
            if (archivedCards.length > 0) {
                container.innerHTML += this.generateArchivedCardsLink(archivedCards.length);
            }
            return;
        }

        container.innerHTML = activeCards.map(card => this.generateCardHTML(card)).join('');
        
        // Add link to archived cards if there are any
        if (archivedCards.length > 0) {
            container.innerHTML += this.generateArchivedCardsLink(archivedCards.length);
        }
        
        // Setup drag and drop event listeners for cards
        this.setupDragAndDrop();
    }
    
    // Helper method to generate archived cards link HTML
    generateArchivedCardsLink(archivedCount) {
        return `
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                <a href="#archivedCardsSection" class="nav-section-link" style="font-size: 1rem; font-weight: 600;">
                    ${i18n.t('cards.view_archived', { count: archivedCount })}
                </a>
            </div>
        `;
    }
    
    // Helper method to generate card HTML
    generateCardHTML(card) {
        const store = this.matchStore(card.name);
        const storeIcon = store ? `<img src="${this.escapeHtml(this.getStoreIcon(store))}" alt="${this.escapeHtml(store.name)}" onerror="this.src='${this.escapeHtml(store.icon)}'" style="width: 2rem; height: 2rem; margin-right: 10px; object-fit: contain;" />` : '';
        const cardStyle = store ? `border-left: 4px solid ${store.color};` : '';
        
        // Check if this is a fidelity card (no balance tracking)
        const balanceDisplay = this.isFidelityCard(card)
            ? `<span class="fidelity-badge" style="background: #9C27B0; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${i18n.t('card.fidelity_badge')}</span>` 
            : `<div class="card-balance" ${store ? `style="color: ${store.color};"` : ''}>€${card.currentBalance.toFixed(2)}</div>`;
        
        return `
            <div class="card" draggable="false" data-card-id="${card.id}" onclick="window.giftCardManager.showCardDetail('${card.id}')" style="${cardStyle}">
                <div class="card-header">
                    <div class="drag-handle" draggable="true" role="button" tabindex="0" aria-label="${i18n.t('card.drag_to_reorder')}" title="${i18n.t('card.drag_to_reorder')}">⋮⋮</div>
                    <div style="display: flex; align-items: center; flex: 1;">
                        ${storeIcon}
                        <div>
                            <div class="card-name">${this.escapeHtml(card.name)}</div>
                            <div class="card-number">Card #${this.escapeHtml(card.number)}</div>
                        </div>
                    </div>
                    ${balanceDisplay}
                </div>
            </div>
        `;
    }

    // Render archived cards
    renderArchivedCards() {
        const container = document.getElementById('archivedCardsContainer');
        
        // Filter archived cards
        const archivedCards = this.cards.filter(card => card.archived);
        
        if (archivedCards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${i18n.t('archived.empty')}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = archivedCards.map(card => this.generateCardHTML(card)).join('');
    }
    
    // Helper method to update archived cards view if it's currently visible
    updateArchivedViewIfVisible() {
        const archivedSection = document.getElementById('archivedCardsSection');
        if (archivedSection && archivedSection.style.display !== 'none') {
            this.renderArchivedCards();
        }
    }

    // Archive a card
    archiveCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        card.archived = true;
        this.saveCards();
        this.closeModal();
        this.renderCards();
        this.updateArchivedViewIfVisible();
    }

    // Unarchive a card
    unarchiveCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        card.archived = false;
        this.saveCards();
        this.closeModal();
        this.renderCards();
        this.updateArchivedViewIfVisible();
    }

    // Show card detail modal
    showCardDetail(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // Match store for theming
        const store = this.matchStore(card.name);
        
        const content = document.getElementById('cardDetailContent');
        
        // Apply store theming if matched
        if (store) {
            content.innerHTML = `
                <div class="store-header" style="background: ${store.background}; padding: 20px; margin: -30px -30px 20px -30px; border-radius: 10px 10px 0 0;">
                    <div style="text-align: center; margin-bottom: 10px;"><img src="${this.escapeHtml(this.getStoreIcon(store))}" alt="${this.escapeHtml(store.name)}" onerror="this.src='${this.escapeHtml(store.icon)}'" style="width: 4rem; height: 4rem; object-fit: contain;" /></div>
                    <h2 style="text-align: center; color: white; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${this.escapeHtml(card.name)}</h2>
                </div>
                <p><strong>${i18n.t('form.card_number')}</strong> ${this.escapeHtml(card.number)}</p>
                ${this.isFidelityCard(card) ? `<p><strong>${i18n.t('card.type')}</strong> <span style="color: #9C27B0; font-weight: bold;">${i18n.t('card.fidelity_badge')}</span></p>` : `<p><strong>${i18n.t('card.current_balance')}</strong> <span style="color: ${store.color}; font-weight: bold;">€${card.currentBalance.toFixed(2)}</span></p>
                <p><strong>${i18n.t('card.initial_balance')}</strong> €${card.initialBalance.toFixed(2)}</p>
                ${this.generateExpiryDateHTML(card)}`}
            `;
        } else {
            content.innerHTML = `
                <h2>${this.escapeHtml(card.name)}</h2>
                <p><strong>${i18n.t('form.card_number')}</strong> ${this.escapeHtml(card.number)}</p>
                ${this.isFidelityCard(card) ? `<p><strong>${i18n.t('card.type')}</strong> <span style="color: #9C27B0; font-weight: bold;">${i18n.t('card.fidelity_badge')}</span></p>` : `<p><strong>${i18n.t('card.current_balance')}</strong> <span class="text-success">€${card.currentBalance.toFixed(2)}</span></p>
                <p><strong>${i18n.t('card.initial_balance')}</strong> €${card.initialBalance.toFixed(2)}</p>
                ${this.generateExpiryDateHTML(card)}`}
            `;
        }
        
        content.innerHTML += `
            <div class="barcode-settings">
                <div class="form-group">
                    <label for="barcodeFormat">${i18n.t('card.barcode_type')}</label>
                    <select id="barcodeFormat" class="barcode-format-select">
                        <option value="CODE128" ${(card.barcodeFormat || 'CODE128') === 'CODE128' ? 'selected' : ''}>CODE 128</option>
                        <option value="CODE39" ${card.barcodeFormat === 'CODE39' ? 'selected' : ''}>CODE 39</option>
                        <option value="EAN13" ${card.barcodeFormat === 'EAN13' ? 'selected' : ''}>EAN-13</option>
                        <option value="EAN8" ${card.barcodeFormat === 'EAN8' ? 'selected' : ''}>EAN-8</option>
                        <option value="UPC" ${card.barcodeFormat === 'UPC' ? 'selected' : ''}>UPC</option>
                        <option value="ITF14" ${card.barcodeFormat === 'ITF14' ? 'selected' : ''}>ITF-14</option>
                        <option value="MSI" ${card.barcodeFormat === 'MSI' ? 'selected' : ''}>MSI</option>
                        <option value="CODABAR" ${card.barcodeFormat === 'CODABAR' ? 'selected' : ''}>Codabar</option>
                    </select>
                </div>
            </div>

            <div class="barcode-container">
                <div id="barcode"></div>
            </div>

            ${this.isFidelityCard(card) ? '' : `<div class="transaction-form">
                <h3>${i18n.t('card.add_transaction')}</h3>
                <form id="transactionForm">
                    <div class="form-group">
                        <label for="transactionAmount">${i18n.t('card.amount_spent')}</label>
                        <input type="number" id="transactionAmount" step="0.01" min="0" max="${card.currentBalance}" required placeholder="${i18n.t('card.amount_placeholder')}">
                    </div>
                    <div class="form-group">
                        <label for="transactionDescription">${i18n.t('card.description')}</label>
                        <input type="text" id="transactionDescription" placeholder="${i18n.t('card.description_placeholder')}">
                    </div>
                    <button type="submit" class="btn btn-secondary">${i18n.t('card.record_button')}</button>
                </form>
            </div>

            <div class="transaction-history">
                <h3>${i18n.t('card.transaction_history')}</h3>
                ${this.renderTransactions(card)}
            </div>`}

            <div class="mt-20">
                ${!this.isFidelityCard(card) 
                    ? `<button class="btn btn-secondary btn-small" onclick="window.giftCardManager.resetBalance('${card.id}')">${i18n.t('card.reset_balance_button')}</button>`
                    : ''
                }
                ${!this.isFidelityCard(card) 
                    ? `<button class="btn btn-secondary btn-small" onclick="window.giftCardManager.toggleExpiryDateEdit('${card.id}')">${i18n.t('card.edit_expiry')}</button>`
                    : ''
                }
                ${card.archived 
                    ? `<button class="btn btn-secondary btn-small" onclick="window.giftCardManager.unarchiveCard('${card.id}')">${i18n.t('card.unarchive_button')}</button>`
                    : `<button class="btn btn-secondary btn-small" onclick="window.giftCardManager.archiveCard('${card.id}')">${i18n.t('card.archive_button')}</button>`
                }
                <button class="btn btn-danger btn-small" onclick="window.giftCardManager.deleteCard('${card.id}')">${i18n.t('card.delete_button')}</button>
            </div>
            ${!this.isFidelityCard(card) 
                ? `<div id="expiryDateEditForm" style="display: none; margin-top: 15px; padding: 15px; background: #f0f8ff; border-radius: 8px; border: 2px solid #e0e0e0;">
                    <div style="margin-bottom: 10px;">
                        <label for="expiryDateInput" style="display: block; margin-bottom: 5px; font-weight: 600;">${i18n.t('card.expiry_date')}</label>
                        <input type="date" id="expiryDateInput" value="${card.expiryDate || ''}" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 100%; max-width: 250px;">
                    </div>
                    <button class="btn btn-secondary btn-small" onclick="window.giftCardManager.saveExpiryDate('${card.id}')">${i18n.t('card.save_expiry')}</button>
                    <button class="btn btn-secondary btn-small" onclick="window.giftCardManager.toggleExpiryDateEdit('${card.id}')">${i18n.t('card.cancel_edit')}</button>
                </div>`
                : ''
            }
        `;

        // Generate barcode using bwip-js
        const generateBarcode = () => {
            const selectedFormat = document.getElementById('barcodeFormat').value;
            renderBarcode('#barcode', card.number, {
                format: selectedFormat,
                scale: 3,         // module width
                height: 15,       // mm
                includetext: true,
                textsize: 14
            });
        };

        
        // Initial barcode generation
        generateBarcode();
        
        // Set up barcode format change listener for dynamic updates
        document.getElementById('barcodeFormat').addEventListener('change', (e) => {
            const newFormat = e.target.value;
            card.barcodeFormat = newFormat;
            this.saveCards();
            generateBarcode();
        });

        // Set up transaction form (only for gift cards with balance)
        if (!this.isFidelityCard(card)) {
            document.getElementById('transactionForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.addTransaction(cardId);
            });
        }

        // Show modal
        document.getElementById('cardDetailModal').style.display = 'block';
    }

    // Generate expiry date HTML with edit functionality (only for gift cards)
    generateExpiryDateHTML(card) {
        if (this.isFidelityCard(card)) {
            return ''; // No expiry date for fidelity cards
        }

        let expiryHTML = '<div id="expiryDateSection" style="margin-top: 10px;">';
        expiryHTML += `<p><strong>${i18n.t('card.expiry_date')}</strong> `;
        
        if (card.expiryDate) {
            const formattedDate = this.formatExpiryDate(card.expiryDate);
            let dateStyle = '';
            let statusBadge = '';
            
            if (this.isCardExpired(card)) {
                dateStyle = 'color: #d32f2f; font-weight: bold;';
                statusBadge = `<span style="background: #d32f2f; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; margin-left: 8px;">${i18n.t('card.expired')}</span>`;
            } else if (this.isCardExpiringSoon(card)) {
                dateStyle = 'color: #f57c00; font-weight: bold;';
                statusBadge = `<span style="background: #f57c00; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; margin-left: 8px;">${i18n.t('card.expires_soon')}</span>`;
            }
            
            expiryHTML += `<span id="expiryDateDisplay" style="${dateStyle}">${this.escapeHtml(formattedDate)}</span>${statusBadge}`;
        } else {
            expiryHTML += `<span id="expiryDateDisplay" style="color: #999;">${i18n.t('card.no_expiry')}</span>`;
        }
        
        expiryHTML += `</p>`;
        expiryHTML += '</div>';
        
        return expiryHTML;
    }

    // Toggle expiry date edit form
    toggleExpiryDateEdit(cardId) {
        const editForm = document.getElementById('expiryDateEditForm');
        const displaySpan = document.getElementById('expiryDateDisplay');
        
        if (editForm.style.display === 'none') {
            editForm.style.display = 'block';
        } else {
            editForm.style.display = 'none';
        }
    }

    // Save expiry date
    saveExpiryDate(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card || this.isFidelityCard(card)) return;

        const newExpiryDate = document.getElementById('expiryDateInput').value.trim();
        
        if (newExpiryDate) {
            card.expiryDate = newExpiryDate;
        } else {
            // Remove expiry date if empty
            delete card.expiryDate;
        }
        
        this.saveCards();
        
        // Refresh the card detail view
        this.showCardDetail(cardId);
    }

    // Render transaction history
    renderTransactions(card) {
        if (card.transactions.length === 0) {
            return `<p class="empty-state">${i18n.t('card.no_transactions')}</p>`;
        }

        // Sort transactions by date (newest first)
        const sortedTransactions = [...card.transactions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        return sortedTransactions.map(transaction => {
            const date = new Date(transaction.date);
            const currentLang = i18n.getCurrentLanguage();
            const locale = this.getLocaleForLanguage(currentLang);
            const formattedDate = date.toLocaleString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const isPositive = transaction.type === 'initial' || transaction.type === 'reset' || transaction.amount > 0;
            let amountDisplay;
            if (transaction.type === 'initial') {
                amountDisplay = i18n.t('transaction.initial_balance', { amount: transaction.amount.toFixed(2) });
            } else if (transaction.type === 'reset') {
                amountDisplay = i18n.t('transaction.reset', { amount: transaction.balanceAfter.toFixed(2) });
            } else {
                amountDisplay = i18n.t('transaction.spent', { amount: Math.abs(transaction.amount).toFixed(2) });
            }

            return `
                <div class="transaction-item ${isPositive && (transaction.type === 'initial' || transaction.type === 'reset') ? 'positive' : ''}">
                    <div class="transaction-date">${formattedDate}</div>
                    <div class="transaction-amount ${(transaction.type === 'initial' || transaction.type === 'reset') ? 'text-success' : 'text-danger'}">
                        ${amountDisplay}
                    </div>
                    ${transaction.description ? `<div><small>${this.escapeHtml(transaction.description)}</small></div>` : ''}
                    <div class="transaction-balance">${i18n.t('transaction.balance_after', { amount: transaction.balanceAfter.toFixed(2) })}</div>
                </div>
            `;
        }).join('');
    }

    // Add transaction to a card
    addTransaction(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // Fidelity cards don't support transactions
        if (this.isFidelityCard(card)) {
            alert(i18n.t('alert.fidelity_no_transactions'));
            return;
        }

        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const description = document.getElementById('transactionDescription').value.trim();

        if (amount > card.currentBalance) {
            alert(i18n.t('alert.transaction_exceeds'));
            return;
        }

        const newBalance = card.currentBalance - amount;

        const transaction = {
            date: new Date().toISOString(),
            amount: -amount, // Negative for spending
            type: 'spend',
            balanceAfter: newBalance,
            description: description || 'Purchase'
        };

        card.transactions.push(transaction);
        card.currentBalance = newBalance;

        this.saveCards();
        this.showCardDetail(cardId); // Refresh the modal
        this.renderCards(); // Refresh the cards list
    }

    // Reset balance to a custom value (default: initial balance)
    resetBalance(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // Fidelity cards don't have balance
        if (this.isFidelityCard(card)) {
            alert(i18n.t('alert.fidelity_no_transactions'));
            return;
        }

        // Prompt user for new balance amount with initial balance as default
        const newBalanceInput = prompt(
            i18n.t('alert.reset_balance_prompt', { initial: card.initialBalance.toFixed(2) }), 
            card.initialBalance.toFixed(2)
        );

        // User cancelled
        if (newBalanceInput === null) {
            return;
        }

        // Validate input
        const newBalance = parseFloat(newBalanceInput);
        if (isNaN(newBalance) || newBalance < 0) {
            alert(i18n.t('alert.reset_balance_invalid'));
            return;
        }

        // Create a reset transaction
        const transaction = {
            date: new Date().toISOString(),
            amount: newBalance - card.currentBalance, // Difference to add
            type: 'reset',
            balanceAfter: newBalance,
            description: i18n.t('transaction.reset_description', { amount: newBalance.toFixed(2) })
        };

        card.transactions.push(transaction);
        card.currentBalance = newBalance;

        this.saveCards();
        this.showCardDetail(cardId); // Refresh the modal
        this.renderCards(); // Refresh the cards list
        
        // Show success message
        alert(i18n.t('alert.reset_balance_success', { amount: newBalance.toFixed(2) }));
    }

    // Delete a card
    deleteCard(cardId) {
        if (!confirm(i18n.t('alert.delete_confirm'))) {
            return;
        }

        this.cards = this.cards.filter(c => c.id !== cardId);
        this.saveCards();
        this.closeModal();
        this.renderCards();
        this.updateArchivedViewIfVisible();
    }

    // Export all data to JSON file
    exportData() {
        try {
            // Create export data object with metadata
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: this.cards,
                shoppingLists: window.shoppingListManager ? window.shoppingListManager.getExportData() : []
            };

            // Convert to JSON
            const jsonString = JSON.stringify(exportData, null, 2);
            
            // Create blob
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Generate filename with date and time
            const now = new Date();
            // Format: YYYY-MM-DDTHH-MM-SS (remove milliseconds and timezone, replace separators)
            const dateStr = now.toISOString().split('.')[0].replace(/:/g, '-');
            const filename = `gift-cards-backup-${dateStr}.json`;
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert(i18n.t('alert.export_success', { filename }));
        } catch (error) {
            console.error('Export error:', error);
            alert(i18n.t('alert.export_failed'));
        }
    }

    // Import data from JSON file
    importData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate imported data structure
                if (!importedData.cards || !Array.isArray(importedData.cards)) {
                    throw new Error(i18n.t('alert.import_invalid'));
                }

                // Validate each card has required fields with proper types
                for (const card of importedData.cards) {
                    // Check for required fields and their types
                    if (!card.id || typeof card.id !== 'string' || card.id.trim() === '') {
                        throw new Error(i18n.t('alert.import_invalid_id'));
                    }
                    if (!card.number || typeof card.number !== 'string' || card.number.trim() === '') {
                        throw new Error(i18n.t('alert.import_invalid_number'));
                    }
                    if (!card.name || typeof card.name !== 'string' || card.name.trim() === '') {
                        throw new Error(i18n.t('alert.import_invalid_name'));
                    }
                    if (!Array.isArray(card.transactions)) {
                        throw new Error(i18n.t('alert.import_invalid_transactions'));
                    }
                    // Validate balance fields (can be null for fidelity cards, or numbers for gift cards)
                    if (card.initialBalance !== null && card.initialBalance !== undefined && typeof card.initialBalance !== 'number') {
                        throw new Error(i18n.t('alert.import_invalid_balance'));
                    }
                    if (card.currentBalance !== null && card.currentBalance !== undefined && typeof card.currentBalance !== 'number') {
                        throw new Error(i18n.t('alert.import_invalid_current'));
                    }
                }

                // Ask for confirmation before overwriting
                const currentCount = this.cards.length;
                const importCount = importedData.cards.length;
                const confirmMessage = i18n.t('alert.import_confirm', { current: currentCount, imported: importCount });
                if (!confirm(confirmMessage)) {
                    // Reset file input
                    event.target.value = '';
                    return;
                }

                // Import the data and ensure archived property exists for backward compatibility
                this.cards = importedData.cards.map(card => ({
                    ...card,
                    archived: card.archived ?? GiftCardManager.DEFAULT_ARCHIVED_STATE
                }));
                this.saveCards();
                this.renderCards();

                // Import shopping lists if present (backward compatible: older backups may not have this)
                if (window.shoppingListManager && Array.isArray(importedData.shoppingLists)) {
                    window.shoppingListManager.importShoppingLists(importedData.shoppingLists);
                }
                
                // Format success message with export date if available and valid
                let exportDateStr = 'backup';
                if (importedData.exportDate) {
                    const exportDate = new Date(importedData.exportDate);
                    // Check if the date is valid
                    if (!isNaN(exportDate.getTime())) {
                        const currentLang = i18n.getCurrentLanguage();
                        const locale = this.getLocaleForLanguage(currentLang);
                        exportDateStr = exportDate.toLocaleString(locale);
                    }
                }
                alert(i18n.t('alert.import_success', { count: importCount, date: exportDateStr }));
            } catch (error) {
                console.error('Import error:', error);
                alert(i18n.t('alert.import_failed', { error: error.message }));
            } finally {
                // Reset file input so the same file can be selected again
                event.target.value = '';
            }
        };
        
        reader.onerror = () => {
            alert(i18n.t('alert.import_read_failed'));
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }

    // Upload and process one or more PDF receipts, showing a single summary at the end
    async uploadReceipt(event) {
        const files = Array.from(event.target.files || []);

        const results = [];
        for (const file of files) {
            results.push(await this.processReceiptFile(file));
        }

        event.target.value = '';

        if (results.length === 0) {
            return;
        }

        const totalAdded = results.reduce((sum, r) => sum + (r.addedCount || 0), 0);
        if (totalAdded > 0) {
            this.saveCards();
            this.renderCards();
        }

        alert(this.buildReceiptSummary(results));
    }

    // Parse a single PDF receipt and apply its gift card transactions.
    // Returns a result descriptor instead of alerting directly, so uploadReceipt
    // can combine the outcome of every selected file into one summary popup.
    async processReceiptFile(file) {
        // Check if it's a PDF
        if (file.type !== 'application/pdf') {
            return { fileName: file.name, status: 'invalid_type' };
        }

        try {
            // Read the PDF file
            const arrayBuffer = await file.arrayBuffer();

            // Configure PDF.js worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${GiftCardManager.PDFJS_VERSION}/build/pdf.worker.min.js`;
            }

            // Load the PDF document
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            // Extract text from all pages
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += this.groupTextItemsIntoLines(textContent.items).join('\n') + '\n';
            }

            // Extract transactions from the text
            const transactions = this.extractTransactionsFromReceipt(fullText);

            if (transactions.length === 0) {
                return { fileName: file.name, status: 'no_transactions' };
            }

            // The receipt's own date/time (when printed), reused for every
            // transaction found on it instead of the upload time
            const receiptDate = this.extractReceiptDate(fullText);
            const transactionDate = (receiptDate || new Date()).toISOString();

            // Process each transaction
            let addedCount = 0;
            const notFoundCards = [];

            for (const transaction of transactions) {
                const card = this.cards.find(c => c.number === transaction.cardNumber);

                if (!card) {
                    notFoundCards.push(transaction.cardNumber);
                    continue;
                }

                // Check if this is a fidelity card
                if (this.isFidelityCard(card)) {
                    console.log(`Skipping transaction for fidelity card ${card.number}`);
                    continue;
                }

                // Check if transaction would exceed balance
                if (card.currentBalance < transaction.amount) {
                    console.log(`Transaction amount ${transaction.amount} exceeds balance ${card.currentBalance} for card ${card.number}`);
                    continue;
                }

                // Add the transaction
                const newBalance = card.currentBalance - transaction.amount;
                card.transactions.push({
                    date: transactionDate,
                    amount: transaction.amount,
                    type: 'expense',
                    balanceAfter: newBalance,
                    description: transaction.description || 'Receipt transaction'
                });
                card.currentBalance = newBalance;
                addedCount++;
            }

            return { fileName: file.name, status: 'ok', addedCount, notFoundCards };
        } catch (error) {
            console.error(`Receipt processing error for ${file.name}:`, error);
            return { fileName: file.name, status: 'error', error: error.message };
        }
    }

    // Find the receipt's own "DD/MM/YY HH:MM:SS" print timestamp (as printed by the
    // store's POS system, e.g. "05/07/26 11:00:26") and turn it into a Date.
    // Returns null when no such timestamp is found, so callers can fall back to now.
    extractReceiptDate(text) {
        const dateTimePattern = /(\d{2})\/(\d{2})\/(\d{2})[ \t]+(\d{2}):(\d{2}):(\d{2})/;
        const match = dateTimePattern.exec(text);
        if (!match) {
            return null;
        }

        const [, day, month, year, hour, minute, second] = match.map(Number);
        const date = new Date(2000 + year, month - 1, day, hour, minute, second);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    // Combine the per-file results of uploadReceipt into a single summary message
    buildReceiptSummary(results) {
        const lines = [];

        const totalAdded = results.reduce((sum, r) => sum + (r.addedCount || 0), 0);
        if (totalAdded > 0) {
            lines.push(i18n.t('receipt.success', { count: totalAdded }));
        }

        const notFoundCards = [...new Set(results.flatMap(r => r.notFoundCards || []))];
        if (notFoundCards.length > 0) {
            lines.push(i18n.t('receipt.card_not_found', { number: notFoundCards.join(', ') }));
        }

        for (const result of results) {
            if (result.status === 'no_transactions') {
                lines.push(i18n.t('receipt.file_no_transactions', { file: result.fileName }));
            } else if (result.status === 'invalid_type') {
                lines.push(i18n.t('receipt.file_parse_error', { file: result.fileName }));
            } else if (result.status === 'error') {
                lines.push(i18n.t('receipt.file_error', { file: result.fileName, error: result.error }));
            }
        }

        if (lines.length === 0) {
            lines.push(i18n.t('receipt.no_transactions'));
        }

        return lines.join('\n');
    }

    // Group PDF.js text items into lines using their vertical position.
    // PDF.js text items carry no newline information, so items must be
    // grouped by y-coordinate (item.transform[5]) to reconstruct the
    // visual lines of the receipt; otherwise an entire page collapses
    // into a single line and line-based parsing below cannot work.
    groupTextItemsIntoLines(items) {
        const Y_TOLERANCE = 2;
        const lines = [];
        let currentLine = [];
        let currentY = null;

        for (const item of items) {
            const y = item.transform[5];
            if (currentY === null || Math.abs(y - currentY) <= Y_TOLERANCE) {
                currentLine.push(item.str);
                if (currentY === null) currentY = y;
            } else {
                lines.push(currentLine.join(' '));
                currentLine = [item.str];
                currentY = y;
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine.join(' '));
        }

        return lines;
    }

    // Extract gift card transactions from receipt text
    extractTransactionsFromReceipt(text) {
        const transactions = [];
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const MAX_LINES_TO_SEARCH_FOR_CARD = 4;

        const giftCardPattern = /(?:CARTE[ \t]+CADEAU(?:[ \t]+U)?|GIFT[ \t]+CARD)(?:[ \t]+(\d+(?:[ \t]\d+)*[.,]\d{2})[ \t]*€)?/i;
        const cardPattern = /(?:N°|NO|N)[ \t]*:[ \t]*(\d{10,20})|Card[ \t]*:[ \t]*(\d{10,20})|Carte[ \t]*:[ \t]*(\d{10,20})/i;
        const standaloneAmountPattern = /^(\d+(?:[ \t]\d+)*[.,]\d{2})[ \t]*€$/;

        // Cards whose amounts appear on later lines, matched in FIFO order
        const pendingCards = [];

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // If cards are waiting for their amounts, try to match this line as a standalone amount
            if (pendingCards.length > 0) {
                const amountMatch = standaloneAmountPattern.exec(line);
                if (amountMatch) {
                    const amount = parseFloat(amountMatch[1].replace(/[ \t]/g, '').replace(',', '.'));
                    if (amount > 0) {
                        const pending = pendingCards.shift();
                        transactions.push({ cardNumber: pending.cardNumber, amount, description: pending.description });
                        i++;
                        continue;
                    }
                }
            }

            const match = giftCardPattern.exec(line);
            if (match) {
                let description = 'Receipt transaction';
                const storeMatch = line.match(/CARTE[ \t]+CADEAU[ \t]+([A-Za-z]+)/i);
                if (storeMatch) description = `Receipt transaction (${storeMatch[1]})`;

                // Find card number in the next few lines (stop at another gift card trigger)
                let cardNumber = null;
                for (let j = i + 1; j < Math.min(i + 1 + MAX_LINES_TO_SEARCH_FOR_CARD, lines.length); j++) {
                    if (giftCardPattern.test(lines[j])) break;
                    const cardMatch = cardPattern.exec(lines[j]);
                    if (cardMatch) {
                        cardNumber = cardMatch[1] || cardMatch[2] || cardMatch[3];
                        break;
                    }
                }

                if (cardNumber) {
                    if (match[1]) {
                        // Amount on same line — record immediately
                        const amount = parseFloat(match[1].replace(/[ \t]/g, '').replace(',', '.'));
                        if (amount > 0) transactions.push({ cardNumber, amount, description });
                    } else {
                        // Amount on a later line — queue in FIFO order
                        pendingCards.push({ cardNumber, description });
                    }
                }
            }
            
            i++;
        }
        
        return transactions;
    }

    // Close modal
    closeModal() {
        document.getElementById('cardDetailModal').style.display = 'none';
    }

    // Setup drag and drop functionality for cards
    setupDragAndDrop() {
        const dragHandles = document.querySelectorAll('.drag-handle[draggable="true"]');
        const cardElements = document.querySelectorAll('.card');
        
        dragHandles.forEach(dragHandle => {
            const cardElement = dragHandle.closest('.card');
            
            // Dragstart - save the dragged element
            dragHandle.addEventListener('dragstart', (e) => {
                this.draggedElement = cardElement;
                this.draggedCardId = cardElement.getAttribute('data-card-id');
                cardElement.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Use card ID instead of full HTML content for security
                e.dataTransfer.setData('text/plain', this.draggedCardId);
            });
            
            // Dragend - cleanup
            dragHandle.addEventListener('dragend', (e) => {
                cardElement.classList.remove('dragging');
                // Remove drag-over class only from elements that have it
                const dragOverElements = document.querySelectorAll('.card.drag-over');
                dragOverElements.forEach(card => {
                    card.classList.remove('drag-over');
                });
            });
        });
        
        cardElements.forEach(cardElement => {
            // Dragover - allow drop
            cardElement.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (this.draggedElement !== cardElement) {
                    cardElement.classList.add('drag-over');
                }
            });
            
            // Dragleave - remove hover effect, check for child element transitions
            cardElement.addEventListener('dragleave', (e) => {
                // Only remove class if actually leaving the card element
                if (!cardElement.contains(e.relatedTarget)) {
                    cardElement.classList.remove('drag-over');
                }
            });
            
            // Drop - reorder cards
            cardElement.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                cardElement.classList.remove('drag-over');
                
                if (this.draggedElement !== cardElement) {
                    const targetCardId = cardElement.getAttribute('data-card-id');
                    this.reorderCards(this.draggedCardId, targetCardId);
                }
            });
        });
    }
    
    // Reorder cards in the array
    reorderCards(draggedCardId, targetCardId) {
        // Find indices
        const draggedIndex = this.cards.findIndex(card => card.id === draggedCardId);
        const targetIndex = this.cards.findIndex(card => card.id === targetCardId);
        
        if (draggedIndex === -1 || targetIndex === -1) {
            return;
        }
        
        // Remove the dragged card
        const [draggedCard] = this.cards.splice(draggedIndex, 1);
        
        // Insert at the new position
        this.cards.splice(targetIndex, 0, draggedCard);
        
        // Save and re-render
        this.saveCards();
        this.renderCards();
    }
}

// Export for testing (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GiftCardManager };
}

// Initialize the app when DOM is loaded (browser environment)
if (typeof window !== 'undefined') {
    // Wait for i18n to be ready before initializing the app
    window.addEventListener('i18nReady', async () => {
        window.giftCardManager = new GiftCardManager();
        await window.giftCardManager.init();

        // Initialize Shopping List Manager
        if (typeof ShoppingListManager !== 'undefined') {
            window.shoppingListManager = new ShoppingListManager(window.giftCardManager);
            window.shoppingListManager.init();
            // Trigger navigation again so shopping sections render if needed
            window.giftCardManager.handleHashNavigation();
        }
        
        // Register service worker for PWA functionality
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('Service Worker registered successfully:', registration.scope);
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    });
}

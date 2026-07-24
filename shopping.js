// Shopping List Manager
'use strict';

class ShoppingListManager {
    constructor(cardManager) {
        this.shoppingLists = this.loadShoppingLists();
        this.productCache = this.loadProductCache();
        this.cardManager = cardManager;
        this.currentListId = null;
        this.pendingItemScanListId = null;
        this.pendingItemScanItemId = null;
        this.pendingProductInfo = null;
        this.barcodeScannerStream = null;
        this.barcodeScannerFrameRequest = null;
        this.isScanningBarcodeFrame = false;
        this.preferredBarcodeDetectorFormats = null;
        this.wakeLock = null;
        this.draggedShoppingItemId = null;
    }

    // ===========================
    // Persistence
    // ===========================

    loadShoppingLists() {
        try {
            const stored = localStorage.getItem('shoppingLists');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Unable to load shopping lists from localStorage:', error);
            return [];
        }
    }

    saveShoppingLists() {
        try {
            localStorage.setItem('shoppingLists', JSON.stringify(this.shoppingLists));
        } catch (error) {
            console.error('Unable to save shopping lists to localStorage:', error);
        }
    }

    // ===========================
    // Product Cache
    // ===========================

    loadProductCache() {
        try {
            const stored = localStorage.getItem('productCache');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    }

    saveProductCache() {
        try {
            localStorage.setItem('productCache', JSON.stringify(this.productCache));
        } catch (error) {
            console.error('Unable to save product cache:', error);
        }
    }

    getProductFromCache(barcode) {
        if (!barcode) return null;
        return this.productCache[barcode] || null;
    }

    saveProductToCache(barcode, productInfo) {
        if (!barcode) return;
        const existing = this.productCache[barcode] || {};
        this.productCache[barcode] = { ...existing, ...productInfo };
        this.saveProductCache();
    }

    recordPriceForBarcode(barcode, store, unitPriceCents) {
        if (!barcode || !store || unitPriceCents === null || unitPriceCents === undefined) return;
        const product = this.productCache[barcode] || {};
        const prices = Array.isArray(product.prices) ? product.prices : [];
        const today = new Date().toISOString().slice(0, 10);
        const filtered = prices.filter(p => p.store !== store);
        product.prices = [{ store, unitPriceCents, observedAt: today }, ...filtered];
        this.productCache[barcode] = product;
        this.saveProductCache();
    }

    getSuggestedPriceForStore(barcode, store) {
        if (!barcode || !store) return null;
        const product = this.getProductFromCache(barcode);
        if (!product || !Array.isArray(product.prices)) return null;
        return product.prices.find(p => p.store === store) || null;
    }

    // ===========================
    // Money Utilities (cents avoid floating-point issues)
    // ===========================

    eurToCents(eur) {
        if (eur === null || eur === undefined || eur === '') return null;
        const val = parseFloat(eur);
        if (isNaN(val)) return null;
        return Math.round(val * 100);
    }

    centsToEur(cents) {
        if (cents === null || cents === undefined) return null;
        return cents / 100;
    }

    formatCents(cents) {
        if (cents === null || cents === undefined) return '—';
        return '€' + (cents / 100).toFixed(2);
    }

    // ===========================
    // ID Generation
    // ===========================

    generateId() {
        return Date.now().toString() + Math.random().toString(36).slice(2, 7);
    }

    // ===========================
    // List CRUD
    // ===========================

    createList(name, store, plannedDate) {
        const now = new Date().toISOString();
        const list = {
            id: this.generateId(),
            name: name.trim(),
            store: store ? store.trim() : '',
            plannedDate: plannedDate || null,
            status: 'draft',
            createdAt: now,
            updatedAt: now,
            giftCardIds: [],
            loyaltyCardIds: [],
            items: [],
            estimatedTotalCents: 0,
            finalTotalCents: null,
            payments: []
        };
        this.shoppingLists.push(list);
        this.saveShoppingLists();
        return list;
    }

    updateList(id, updates) {
        const list = this.getList(id);
        if (!list) return null;
        Object.assign(list, updates, { updatedAt: new Date().toISOString() });
        this.saveShoppingLists();
        return list;
    }

    deleteList(id) {
        const index = this.shoppingLists.findIndex(l => l.id === id);
        if (index === -1) return false;
        this.shoppingLists.splice(index, 1);
        this.saveShoppingLists();
        return true;
    }

    getList(id) {
        return this.shoppingLists.find(l => l.id === id) || null;
    }

    // ===========================
    // Item CRUD
    // ===========================

    addItem(listId, name, note) {
        const list = this.getList(listId);
        if (!list) return null;
        const item = {
            id: this.generateId(),
            name: name.trim(),
            note: note ? note.trim() : '',
            checked: false,
            barcode: null,
            barcodeFormat: null,
            pricingMode: 'unit',
            unitPriceCents: null,
            quantity: 1,
            pricePerKgCents: null,
            weightKg: null,
            totalCents: 0
        };
        list.items.push(item);
        this.recalculateList(listId);
        return item;
    }

    updateItem(listId, itemId, updates) {
        const list = this.getList(listId);
        if (!list) return null;
        const item = list.items.find(i => i.id === itemId);
        if (!item) return null;
        Object.assign(item, updates);
        item.totalCents = this.calculateItemTotalCents(item);
        this.recalculateList(listId);
        return item;
    }

    removeItem(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return false;
        const index = list.items.findIndex(i => i.id === itemId);
        if (index === -1) return false;
        list.items.splice(index, 1);
        this.recalculateList(listId);
        return true;
    }

    checkItem(listId, itemId, checked) {
        return this.updateItem(listId, itemId, { checked });
    }

    isValidItemReorder(list, fromIndex, toIndex) {
        return !!list &&
            fromIndex >= 0 &&
            fromIndex < list.items.length &&
            toIndex >= 0 &&
            toIndex < list.items.length &&
            fromIndex !== toIndex;
    }

    reorderItems(listId, fromIndex, toIndex) {
        const list = this.getList(listId);
        if (!this.isValidItemReorder(list, fromIndex, toIndex)) return;
        const [moved] = list.items.splice(fromIndex, 1);
        list.items.splice(toIndex, 0, moved);
        list.updatedAt = new Date().toISOString();
        this.saveShoppingLists();
    }

    // ===========================
    // Calculations
    // ===========================

    calculateItemTotalCents(item) {
        if (item.pricingMode === 'weight') {
            if (item.pricePerKgCents !== null && item.weightKg !== null) {
                return Math.round(item.pricePerKgCents * item.weightKg);
            }
            return 0;
        } else {
            if (item.unitPriceCents !== null) {
                const qty = item.quantity !== null ? item.quantity : 1;
                return item.unitPriceCents * qty;
            }
            return 0;
        }
    }

    calculateListTotalCents(list) {
        return list.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);
    }

    recalculateList(listId) {
        const list = this.getList(listId);
        if (!list) return;
        list.items.forEach(item => {
            item.totalCents = this.calculateItemTotalCents(item);
        });
        list.estimatedTotalCents = this.calculateListTotalCents(list);
        list.updatedAt = new Date().toISOString();
        this.saveShoppingLists();
    }

    // ===========================
    // Card Associations
    // ===========================

    addGiftCard(listId, cardId) {
        const list = this.getList(listId);
        if (!list) return false;
        if (!list.giftCardIds.includes(cardId)) {
            list.giftCardIds.push(cardId);
            this.saveShoppingLists();
        }
        return true;
    }

    removeGiftCard(listId, cardId) {
        const list = this.getList(listId);
        if (!list) return false;
        const index = list.giftCardIds.indexOf(cardId);
        if (index !== -1) {
            list.giftCardIds.splice(index, 1);
            this.saveShoppingLists();
        }
        return true;
    }

    addLoyaltyCard(listId, cardId) {
        const list = this.getList(listId);
        if (!list) return false;
        if (!list.loyaltyCardIds.includes(cardId)) {
            list.loyaltyCardIds.push(cardId);
            this.saveShoppingLists();
        }
        return true;
    }

    removeLoyaltyCard(listId, cardId) {
        const list = this.getList(listId);
        if (!list) return false;
        const index = list.loyaltyCardIds.indexOf(cardId);
        if (index !== -1) {
            list.loyaltyCardIds.splice(index, 1);
            this.saveShoppingLists();
        }
        return true;
    }

    reorderGiftCards(listId, fromIndex, toIndex) {
        const list = this.getList(listId);
        if (!list) return;
        if (fromIndex < 0 || fromIndex >= list.giftCardIds.length) return;
        if (toIndex < 0 || toIndex >= list.giftCardIds.length) return;
        const [moved] = list.giftCardIds.splice(fromIndex, 1);
        list.giftCardIds.splice(toIndex, 0, moved);
        list.updatedAt = new Date().toISOString();
        this.saveShoppingLists();
    }

    // ===========================
    // Checkout Calculations
    // ===========================

    getCardBalanceCents(cardId) {
        if (!this.cardManager) return 0;
        const card = this.cardManager.cards.find(c => c.id === cardId);
        if (!card) return 0;
        if (this.cardManager.isFidelityCard(card)) return 0;
        return Math.round((card.currentBalance || 0) * 100);
    }

    calculateCheckoutSummary(listId) {
        const list = this.getList(listId);
        if (!list) return null;

        const shoppingTotalCents = list.estimatedTotalCents || 0;

        const totalGiftCardBalanceCents = list.giftCardIds.reduce((sum, cardId) => {
            return sum + this.getCardBalanceCents(cardId);
        }, 0);

        const giftCardCoverageCents = Math.min(shoppingTotalCents, totalGiftCardBalanceCents);
        const remainingToPayCents = Math.max(0, shoppingTotalCents - totalGiftCardBalanceCents);
        const unusedGiftCardBalanceCents = Math.max(0, totalGiftCardBalanceCents - shoppingTotalCents);

        const allocation = this.calculateGiftCardAllocation(listId, shoppingTotalCents);

        const totalItems = list.items.length;
        const checkedItems = list.items.filter(i => i.checked).length;
        const remainingItems = totalItems - checkedItems;

        return {
            shoppingTotalCents,
            totalGiftCardBalanceCents,
            giftCardCoverageCents,
            remainingToPayCents,
            unusedGiftCardBalanceCents,
            allocation,
            totalItems,
            checkedItems,
            remainingItems
        };
    }

    calculateGiftCardAllocation(listId, shoppingTotalCents) {
        const list = this.getList(listId);
        if (!list) return [];

        let remaining = shoppingTotalCents;

        return list.giftCardIds.map(cardId => {
            const balanceCents = this.getCardBalanceCents(cardId);
            const suggestedUsageCents = Math.min(remaining, balanceCents);
            remaining = Math.max(0, remaining - balanceCents);
            return {
                cardId,
                balanceCents,
                suggestedUsageCents,
                unusedBalanceCents: balanceCents - suggestedUsageCents
            };
        });
    }

    prepareDefaultPayments(listId) {
        const summary = this.calculateCheckoutSummary(listId);
        if (!summary) return [];
        return summary.allocation.map(a => ({
            cardId: a.cardId,
            amountCents: a.suggestedUsageCents
        }));
    }

    confirmPayment(listId, finalTotalCents, payments) {
        const list = this.getList(listId);
        if (!list) return false;

        if (this.cardManager) {
            payments.forEach(payment => {
                if (payment.amountCents > 0) {
                    const card = this.cardManager.cards.find(c => c.id === payment.cardId);
                    if (card && !this.cardManager.isFidelityCard(card)) {
                        const amountEur = payment.amountCents / 100;
                        const newBalance = Math.max(0, card.currentBalance - amountEur);
                        card.transactions.push({
                            date: new Date().toISOString(),
                            amount: -amountEur,
                            type: 'spend',
                            balanceAfter: newBalance,
                            description: list.name + (list.store ? ' - ' + list.store : '')
                        });
                        card.currentBalance = newBalance;
                    }
                }
            });
            this.cardManager.saveCards();
        }

        list.status = 'completed';
        list.finalTotalCents = finalTotalCents;
        list.payments = payments;
        list.updatedAt = new Date().toISOString();
        this.saveShoppingLists();
        return true;
    }

    // ===========================
    // Export / Import
    // ===========================

    getExportData() {
        return this.shoppingLists;
    }

    importShoppingLists(shoppingLists) {
        if (!Array.isArray(shoppingLists)) return false;
        this.shoppingLists = shoppingLists.map(list => ({
            ...list,
            items: Array.isArray(list.items) ? list.items : [],
            giftCardIds: Array.isArray(list.giftCardIds) ? list.giftCardIds : [],
            loyaltyCardIds: Array.isArray(list.loyaltyCardIds) ? list.loyaltyCardIds : [],
            payments: Array.isArray(list.payments) ? list.payments : [],
            status: list.status || 'draft',
            estimatedTotalCents: list.estimatedTotalCents || 0,
            finalTotalCents: list.finalTotalCents || null
        }));
        this.saveShoppingLists();
        return true;
    }

    // ===========================
    // HTML Helpers
    // ===========================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCardInfo(cardId) {
        if (!this.cardManager) return null;
        return this.cardManager.cards.find(c => c.id === cardId) || null;
    }

    // ===========================
    // Barcode Scanning (for items)
    // ===========================

    async getPreferredBarcodeDetectorFormats() {
        if (this.preferredBarcodeDetectorFormats) {
            return this.preferredBarcodeDetectorFormats;
        }
        const preferred = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'itf', 'codabar'];
        if (typeof BarcodeDetector === 'undefined' || !BarcodeDetector.getSupportedFormats) {
            this.preferredBarcodeDetectorFormats = preferred;
            return preferred;
        }
        try {
            const supported = await BarcodeDetector.getSupportedFormats();
            const matched = preferred.filter(f => supported.includes(f));
            this.preferredBarcodeDetectorFormats = matched.length > 0 ? matched : preferred;
        } catch {
            this.preferredBarcodeDetectorFormats = preferred;
        }
        return this.preferredBarcodeDetectorFormats;
    }

    mapDetectedBarcodeFormat(format) {
        const map = {
            'code_128': 'CODE128', 'code_39': 'CODE39',
            'ean_13': 'EAN13', 'ean_8': 'EAN8',
            'upc_a': 'UPC', 'itf': 'ITF14', 'codabar': 'CODABAR'
        };
        return map[format] || 'CODE128';
    }

    async detectBarcodeFromSource(source) {
        try {
            const formats = await this.getPreferredBarcodeDetectorFormats();
            const detector = new BarcodeDetector({ formats });
            const results = await detector.detect(source);
            return results.length > 0 ? results[0] : null;
        } catch {
            return null;
        }
    }

    async startItemBarcodeScan(listId, itemId) {
        if (typeof BarcodeDetector === 'undefined') {
            this.updateScanStatus(i18n.t('form.barcode_camera_unsupported'), 'error');
            return;
        }
        this.pendingItemScanListId = listId;
        this.pendingItemScanItemId = itemId;

        const scannerDiv = document.getElementById('itemBarcodeScanner');
        const video = document.getElementById('itemBarcodeScannerVideo');
        if (!scannerDiv || !video) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            this.barcodeScannerStream = stream;
            video.srcObject = stream;
            await video.play();
            scannerDiv.style.display = 'block';
            this.updateScanStatus(i18n.t('form.barcode_camera_ready'), 'info');
            this.isScanningBarcodeFrame = true;
            this.scanItemBarcodeFrame(video);
        } catch {
            this.updateScanStatus(i18n.t('alert.barcode_camera_failed'), 'error');
        }
    }

    async scanItemBarcodeFrame(video) {
        if (!this.isScanningBarcodeFrame) return;
        if (!video || video.readyState < 2) {
            this.barcodeScannerFrameRequest = requestAnimationFrame(() => this.scanItemBarcodeFrame(video));
            return;
        }
        const result = await this.detectBarcodeFromSource(video);
        if (result) {
            this.stopItemBarcodeScan();
            this.applyBarcodeToItem(this.pendingItemScanListId, this.pendingItemScanItemId, result.rawValue, this.mapDetectedBarcodeFormat(result.format));
        } else if (this.isScanningBarcodeFrame) {
            this.barcodeScannerFrameRequest = requestAnimationFrame(() => this.scanItemBarcodeFrame(video));
        }
    }

    stopItemBarcodeScan() {
        this.isScanningBarcodeFrame = false;
        if (this.barcodeScannerFrameRequest) {
            cancelAnimationFrame(this.barcodeScannerFrameRequest);
            this.barcodeScannerFrameRequest = null;
        }
        if (this.barcodeScannerStream) {
            this.barcodeScannerStream.getTracks().forEach(t => t.stop());
            this.barcodeScannerStream = null;
        }
        const scannerDiv = document.getElementById('itemBarcodeScanner');
        if (scannerDiv) scannerDiv.style.display = 'none';
        const video = document.getElementById('itemBarcodeScannerVideo');
        if (video) video.srcObject = null;
    }

    async importItemBarcodeFromImage(event, listId, itemId) {
        const file = event.target.files[0];
        if (!file) return;
        this.updateScanStatus(i18n.t('form.barcode_image_processing'), 'info');
        try {
            const img = await this.loadImageFromFile(file);
            const result = await this.detectBarcodeFromSource(img);
            if (result) {
                // applyBarcodeToItem handles all subsequent status updates (lookup + result)
                await this.applyBarcodeToItem(listId, itemId, result.rawValue, this.mapDetectedBarcodeFormat(result.format));
            } else {
                this.updateScanStatus(i18n.t('alert.barcode_not_found'), 'error');
            }
        } catch {
            this.updateScanStatus(i18n.t('alert.barcode_not_found'), 'error');
        }
        event.target.value = '';
    }

    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(img.src);
                    resolve(img);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async applyBarcodeToItem(listId, itemId, barcode, format) {
        const barcodeFormat = format || 'CODE128';
        const isNewItem = !itemId || itemId === '__new__';

        if (!isNewItem) {
            this.updateItem(listId, itemId, { barcode, barcodeFormat });
        }

        this.updateScanStatus(i18n.t('shopping.product_lookup_loading'), 'info');
        this.renderListDetail(listId);

        const product = await this.lookupProductInfo(barcode);

        if (!isNewItem) {
            if (product) {
                const list = this.getList(listId);
                const item = list && list.items.find(it => it.id === itemId);
                if (item) {
                    const updates = {};
                    if (product.name) {
                        updates.name = item.name ? item.name + ' | ' + product.name : product.name;
                    }
                    const productNote = this.buildProductNote(product);
                    if (productNote) {
                        updates.note = item.note ? item.note + '; ' + productNote : productNote;
                    }
                    if (Object.keys(updates).length > 0) {
                        this.updateItem(listId, itemId, updates);
                        this.renderListDetail(listId);
                    }
                }
                this.updateScanStatus(i18n.t('shopping.product_lookup_found', { name: product.name || barcode }), 'success');
            } else {
                this.updateScanStatus(i18n.t('form.barcode_import_success', { format: barcodeFormat }), 'success');
            }
        } else {
            // New item: store info so showAddItemModal can pre-fill the form
            this.pendingProductInfo = product
                ? { ...product, barcode, barcodeFormat }
                : { barcode, barcodeFormat };
            this.showAddItemModal(listId);
            if (product) {
                this.updateScanStatus(i18n.t('shopping.product_lookup_found', { name: product.name || barcode }), 'success');
            } else {
                this.updateScanStatus(i18n.t('form.barcode_import_success', { format: barcodeFormat }), 'success');
            }
        }
    }

    updateScanStatus(message, type) {
        const el = document.getElementById('itemBarcodeImportStatus');
        if (!el) return;
        el.textContent = message || '';
        el.className = 'barcode-import-status';
        if (type) el.classList.add('barcode-import-status-' + type);
    }

    // ===========================
    // Product Lookup
    // ===========================

    buildProductNote(product) {
        if (!product) return '';
        return [product.brand, product.quantity, product.category]
            .filter(Boolean)
            .join(', ');
    }

    async fetchOpenFoodFacts(barcode) {
        try {
            const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
            const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined;
            const resp = await fetch(url, signal ? { signal } : {});
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.status !== 1 || !data.product) return null;
            const p = data.product;
            return {
                name: p.product_name || p.product_name_en || null,
                brand: p.brands || null,
                quantity: p.quantity || null,
                category: (p.categories_tags && p.categories_tags[0]) || null,
                imageUrl: p.image_front_small_url || p.image_url || null,
                source: 'openfoodfacts'
            };
        } catch {
            return null;
        }
    }

    async fetchOpenProductsFacts(barcode) {
        try {
            const url = `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
            const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined;
            const resp = await fetch(url, signal ? { signal } : {});
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.status !== 1 || !data.product) return null;
            const p = data.product;
            return {
                name: p.product_name || null,
                brand: p.brands || null,
                quantity: p.quantity || null,
                category: null,
                imageUrl: p.image_front_small_url || p.image_url || null,
                source: 'openproductsfacts'
            };
        } catch {
            return null;
        }
    }

    async lookupProductInfo(barcode) {
        if (!barcode) return null;
        // 1. Check local cache first
        const cached = this.getProductFromCache(barcode);
        if (cached && cached.name) return { ...cached, fromCache: true };
        // 2. Try Open Food Facts
        let product = await this.fetchOpenFoodFacts(barcode);
        // 3. Try Open Products Facts for non-food items
        if (!product) product = await this.fetchOpenProductsFacts(barcode);
        if (product) {
            this.saveProductToCache(barcode, product);
        }
        return product;
    }

    // ===========================
    // Wake Lock
    // ===========================

    async acquireWakeLock() {
        if (!('wakeLock' in navigator)) return;
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
        } catch {
            // Wake lock not available
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    // ===========================
    // Navigation
    // ===========================

    handleHashNavigation(hash) {
        if (hash === '#shoppingListsSection') {
            this.renderShoppingLists();
        } else if (hash.startsWith('#shoppingListDetail:')) {
            const listId = hash.split(':').slice(1).join(':');
            this.currentListId = listId;
            this.renderListDetail(listId);
        }
    }

    navigateToLists() {
        window.location.hash = '#shoppingListsSection';
    }

    navigateToDetail(listId) {
        window.location.hash = '#shoppingListDetail:' + listId;
    }

    // ===========================
    // UI: Shopping Lists Overview
    // ===========================

    renderShoppingLists() {
        const container = document.getElementById('shoppingListsContainer');
        if (!container) return;

        const active = this.shoppingLists.filter(l => l.status !== 'completed');
        const completed = this.shoppingLists.filter(l => l.status === 'completed');

        let html = '';

        // Active lists
        html += `<div class="shopping-lists-section">
            <h3>${this.escapeHtml(i18n.t('shopping.active_lists'))}</h3>`;
        if (active.length === 0) {
            html += `<p class="shopping-empty">${this.escapeHtml(i18n.t('shopping.no_active_lists'))}</p>`;
        } else {
            active.forEach(list => {
                html += this.renderListCard(list);
            });
        }
        html += `</div>`;

        // Completed lists
        if (completed.length > 0) {
            html += `<div class="shopping-lists-section">
                <h3>${this.escapeHtml(i18n.t('shopping.completed_lists'))}</h3>`;
            completed.forEach(list => {
                html += this.renderListCard(list);
            });
            html += `</div>`;
        }

        container.innerHTML = html;

        // Bind events
        container.querySelectorAll('[data-action="open-list"]').forEach(btn => {
            btn.addEventListener('click', () => this.navigateToDetail(btn.dataset.listId));
        });
        container.querySelectorAll('[data-action="delete-list"]').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDeleteList(btn.dataset.listId));
        });
    }

    renderListCard(list) {
        const total = this.formatCents(list.estimatedTotalCents);
        const store = list.store ? ` – ${this.escapeHtml(list.store)}` : '';
        const date = list.plannedDate ? ` (${this.escapeHtml(list.plannedDate)})` : '';
        const statusLabel = i18n.t('shopping.status_' + list.status);
        const checkedItems = list.items.filter(i => i.checked).length;
        const totalItems = list.items.length;

        return `<div class="shopping-list-card">
            <div class="shopping-list-card-info">
                <strong class="shopping-list-name">${this.escapeHtml(list.name)}</strong>
                <span class="shopping-list-meta">${this.escapeHtml(store + date)}</span>
                <span class="shopping-list-status shopping-status-${this.escapeHtml(list.status)}">${this.escapeHtml(statusLabel)}</span>
                <span class="shopping-list-summary">${this.escapeHtml(i18n.t('shopping.items_summary', { checked: checkedItems, total: totalItems }))} · ${this.escapeHtml(total)}</span>
            </div>
            <div class="shopping-list-card-actions">
                <button class="btn btn-primary btn-small" data-action="open-list" data-list-id="${this.escapeHtml(list.id)}">${this.escapeHtml(i18n.t('shopping.open'))}</button>
                <button class="btn btn-danger btn-small" data-action="delete-list" data-list-id="${this.escapeHtml(list.id)}">${this.escapeHtml(i18n.t('shopping.delete_list'))}</button>
            </div>
        </div>`;
    }

    confirmDeleteList(listId) {
        const list = this.getList(listId);
        if (!list) return;
        if (confirm(i18n.t('shopping.confirm_delete_list', { name: list.name }))) {
            this.deleteList(listId);
            this.renderShoppingLists();
        }
    }

    showCreateListModal() {
        const modal = document.getElementById('shoppingCreateListModal');
        if (!modal) return;
        const form = document.getElementById('shoppingCreateListForm');
        if (form) form.reset();
        modal.style.display = 'block';
    }

    hideCreateListModal() {
        const modal = document.getElementById('shoppingCreateListModal');
        if (modal) modal.style.display = 'none';
    }

    handleCreateListSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('newListName').value.trim();
        const store = document.getElementById('newListStore').value.trim();
        const plannedDate = document.getElementById('newListDate').value;
        if (!name) return;
        const list = this.createList(name, store, plannedDate || null);
        this.hideCreateListModal();
        this.navigateToDetail(list.id);
    }

    // ===========================
    // UI: Shopping List Detail
    // ===========================

    renderListDetail(listId) {
        const list = this.getList(listId);
        const container = document.getElementById('shoppingListDetailContent');
        if (!container) return;

        if (!list) {
            container.innerHTML = `<p>${this.escapeHtml(i18n.t('shopping.list_not_found'))}</p>
                <a href="#shoppingListsSection" class="btn btn-secondary">${this.escapeHtml(i18n.t('shopping.back_to_lists'))}</a>`;
            return;
        }

        const summary = this.calculateCheckoutSummary(listId);

        let html = `
        <div class="shopping-detail-header">
            <a href="#shoppingListsSection" class="btn btn-secondary btn-small shopping-back-btn" aria-label="${this.escapeHtml(i18n.t('shopping.back_to_lists'))}">← ${this.escapeHtml(i18n.t('shopping.back_to_lists'))}</a>
            <h2 class="shopping-detail-title">${this.escapeHtml(list.name)}</h2>
            <span class="shopping-list-status shopping-status-${this.escapeHtml(list.status)}">${this.escapeHtml(i18n.t('shopping.status_' + list.status))}</span>
        </div>

        ${list.store ? `<p class="shopping-detail-store">🏪 ${this.escapeHtml(list.store)}</p>` : ''}
        ${list.plannedDate ? `<p class="shopping-detail-date">📅 ${this.escapeHtml(list.plannedDate)}</p>` : ''}

        <div class="shopping-detail-actions">
            <button class="btn btn-secondary btn-small" id="editListInfoBtn">${this.escapeHtml(i18n.t('shopping.edit_info'))}</button>
            ${list.status !== 'completed' ? `<button class="btn btn-primary" id="checkoutModeBtn">🛒 ${this.escapeHtml(i18n.t('shopping.checkout_mode'))}</button>` : ''}
        </div>

        <!-- Summary bar -->
        <div class="shopping-summary-bar">
            <div class="shopping-summary-item">
                <span class="shopping-summary-label">${this.escapeHtml(i18n.t('shopping.items_done'))}</span>
                <span class="shopping-summary-value">${summary.checkedItems} / ${summary.totalItems}</span>
            </div>
            <div class="shopping-summary-item">
                <span class="shopping-summary-label">${this.escapeHtml(i18n.t('shopping.estimated_total'))}</span>
                <span class="shopping-summary-value">${this.escapeHtml(this.formatCents(summary.shoppingTotalCents))}</span>
            </div>
            <div class="shopping-summary-item">
                <span class="shopping-summary-label">${this.escapeHtml(i18n.t('shopping.gift_card_coverage'))}</span>
                <span class="shopping-summary-value">${this.escapeHtml(this.formatCents(summary.giftCardCoverageCents))}</span>
            </div>
            <div class="shopping-summary-item">
                <span class="shopping-summary-label">${this.escapeHtml(i18n.t('shopping.remaining_to_pay'))}</span>
                <span class="shopping-summary-value shopping-remaining">${this.escapeHtml(this.formatCents(summary.remainingToPayCents))}</span>
            </div>
        </div>

        <!-- Items section -->
        <div class="shopping-items-section">
            <div class="shopping-items-header">
                <h3>${this.escapeHtml(i18n.t('shopping.items'))}</h3>
                ${list.status !== 'completed' ? `<button class="btn btn-primary btn-small" id="addItemBtn">+ ${this.escapeHtml(i18n.t('shopping.add_item'))}</button>` : ''}
            </div>
            <div id="shoppingItemsList">
                ${this.renderItemsList(list)}
            </div>

            <!-- Item barcode scanner -->
            <div id="itemBarcodeScanner" style="display:none;" class="barcode-scanner">
                <video id="itemBarcodeScannerVideo" playsinline muted></video>
                <button type="button" class="btn btn-secondary btn-small" id="cancelItemScanBtn">${this.escapeHtml(i18n.t('form.barcode_scan_cancel'))}</button>
            </div>
            <div id="itemBarcodeImportStatus" class="barcode-import-status" aria-live="polite"></div>
            <input type="file" id="itemBarcodeImageInput" accept="image/*" style="display:none;">
        </div>

        <!-- Cards section -->
        <div class="shopping-cards-section">
            <h3>${this.escapeHtml(i18n.t('shopping.associated_cards'))}</h3>
            ${this.renderAssociatedCards(list)}
            ${list.status !== 'completed' ? `
            <div class="shopping-card-add-buttons">
                <button class="btn btn-secondary btn-small" id="addGiftCardBtn">+ ${this.escapeHtml(i18n.t('shopping.add_gift_card'))}</button>
                <button class="btn btn-secondary btn-small" id="addLoyaltyCardBtn">+ ${this.escapeHtml(i18n.t('shopping.add_loyalty_card'))}</button>
            </div>` : ''}
        </div>`;

        container.innerHTML = html;

        // Bind events
        this.bindListDetailEvents(listId, list);
    }

    renderItemsList(list) {
        if (list.items.length === 0) {
            return `<p class="shopping-empty">${this.escapeHtml(i18n.t('shopping.no_items'))}</p>`;
        }

        return list.items.map((item, index) => {
            const checkedClass = item.checked ? 'shopping-item-checked' : '';
            const checkedIcon = item.checked ? '✅' : '⬜';
            const total = item.totalCents ? this.formatCents(item.totalCents) : '—';
            const priceInfo = this.getItemPriceDisplay(item);

            return `<div class="shopping-item ${checkedClass}" data-item-id="${this.escapeHtml(item.id)}" data-item-index="${index}" draggable="true">
                <button class="shopping-item-check btn-icon" data-action="check-item" data-item-id="${this.escapeHtml(item.id)}" data-checked="${item.checked}" aria-label="${this.escapeHtml(item.checked ? i18n.t('shopping.mark_not_found') : i18n.t('shopping.mark_found'))}" title="${this.escapeHtml(item.checked ? i18n.t('shopping.mark_not_found') : i18n.t('shopping.mark_found'))}">${checkedIcon}</button>
                <div class="shopping-item-info">
                    <span class="shopping-item-name">${this.escapeHtml(item.name)}</span>
                    ${item.note ? `<span class="shopping-item-note">${this.escapeHtml(item.note)}</span>` : ''}
                </div>
                <div class="shopping-item-side">
                    <div class="shopping-item-price-row">
                        <span class="shopping-item-price">${this.escapeHtml(priceInfo)}</span>
                        <span class="shopping-item-total">${this.escapeHtml(total)}</span>
                    </div>
                    <div class="shopping-item-actions">
                        <button class="btn btn-secondary btn-icon" data-action="scan-item-barcode" data-item-id="${this.escapeHtml(item.id)}" aria-label="${this.escapeHtml(i18n.t('form.scan_barcode_camera'))}" title="${this.escapeHtml(i18n.t('form.scan_barcode_camera'))}">📷</button>
                        <button class="btn btn-secondary btn-icon" data-action="edit-item" data-item-id="${this.escapeHtml(item.id)}" aria-label="${this.escapeHtml(i18n.t('shopping.edit_item'))}" title="${this.escapeHtml(i18n.t('shopping.edit_item'))}">✏️</button>
                        <button class="btn btn-danger btn-icon" data-action="remove-item" data-item-id="${this.escapeHtml(item.id)}" aria-label="${this.escapeHtml(i18n.t('shopping.remove_item'))}" title="${this.escapeHtml(i18n.t('shopping.remove_item'))}">🗑️</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    getItemPriceDisplay(item) {
        if (item.pricingMode === 'weight') {
            const ppu = item.pricePerKgCents !== null ? this.formatCents(item.pricePerKgCents) + '/kg' : '—/kg';
            const w = item.weightKg !== null ? item.weightKg + ' kg' : '— kg';
            return `${ppu} × ${w}`;
        } else {
            const price = item.unitPriceCents !== null ? this.formatCents(item.unitPriceCents) : '—';
            const qty = item.quantity !== null ? item.quantity : 1;
            return `${price} × ${qty}`;
        }
    }

    renderAssociatedCards(list) {
        let html = '';

        if (list.giftCardIds.length > 0) {
            html += `<div class="associated-cards-group">
                <h4>${this.escapeHtml(i18n.t('shopping.gift_cards'))}</h4>`;
            list.giftCardIds.forEach((cardId, index) => {
                const card = this.getCardInfo(cardId);
                const name = card ? this.escapeHtml(card.name) : this.escapeHtml(i18n.t('shopping.card_not_found'));
                const balance = card ? this.escapeHtml('€' + (card.currentBalance || 0).toFixed(2)) : '—';
                html += `<div class="associated-card-item">
                    <button class="associated-card-name" type="button" data-action="open-card" data-card-id="${this.escapeHtml(cardId)}">${name}</button>
                    <button class="associated-card-balance" type="button" data-action="open-card" data-card-id="${this.escapeHtml(cardId)}">${balance}</button>
                    <div class="associated-card-order">
                        ${index > 0 ? `<button class="btn btn-secondary btn-icon" data-action="move-gift-card-up" data-card-id="${this.escapeHtml(cardId)}" data-index="${index}" aria-label="${this.escapeHtml(i18n.t('shopping.move_up'))}" title="${this.escapeHtml(i18n.t('shopping.move_up'))}">↑</button>` : '<span class="btn-icon-placeholder"></span>'}
                        ${index < list.giftCardIds.length - 1 ? `<button class="btn btn-secondary btn-icon" data-action="move-gift-card-down" data-card-id="${this.escapeHtml(cardId)}" data-index="${index}" aria-label="${this.escapeHtml(i18n.t('shopping.move_down'))}" title="${this.escapeHtml(i18n.t('shopping.move_down'))}">↓</button>` : '<span class="btn-icon-placeholder"></span>'}
                    </div>
                    <button class="btn btn-danger btn-icon" data-action="remove-gift-card" data-card-id="${this.escapeHtml(cardId)}" aria-label="${this.escapeHtml(i18n.t('shopping.remove_card'))}" title="${this.escapeHtml(i18n.t('shopping.remove_card'))}">✕</button>
                </div>`;
            });
            html += `</div>`;
        }

        if (list.loyaltyCardIds.length > 0) {
            html += `<div class="associated-cards-group">
                <h4>${this.escapeHtml(i18n.t('shopping.loyalty_cards'))}</h4>`;
            list.loyaltyCardIds.forEach(cardId => {
                const card = this.getCardInfo(cardId);
                const name = card ? this.escapeHtml(card.name) : this.escapeHtml(i18n.t('shopping.card_not_found'));
                html += `<div class="associated-card-item">
                    <button class="associated-card-name" type="button" data-action="open-card" data-card-id="${this.escapeHtml(cardId)}">${name}</button>
                    <button class="btn btn-danger btn-icon" data-action="remove-loyalty-card" data-card-id="${this.escapeHtml(cardId)}" aria-label="${this.escapeHtml(i18n.t('shopping.remove_card'))}" title="${this.escapeHtml(i18n.t('shopping.remove_card'))}">✕</button>
                </div>`;
            });
            html += `</div>`;
        }

        if (list.giftCardIds.length === 0 && list.loyaltyCardIds.length === 0) {
            html = `<p class="shopping-empty">${this.escapeHtml(i18n.t('shopping.no_cards_associated'))}</p>`;
        }

        return html;
    }

    bindListDetailEvents(listId, list) {
        // Back button already handled by link href

        // Edit info
        const editInfoBtn = document.getElementById('editListInfoBtn');
        if (editInfoBtn) {
            editInfoBtn.addEventListener('click', () => this.showEditListModal(listId));
        }

        // Checkout mode
        const checkoutBtn = document.getElementById('checkoutModeBtn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.showCheckoutModal(listId));
        }

        // Add item
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => this.showAddItemModal(listId));
        }

        // Item actions
        const itemsList = document.getElementById('shoppingItemsList');
        if (itemsList) {
            itemsList.addEventListener('click', e => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const action = btn.dataset.action;
                const itemId = btn.dataset.itemId;

                if (action === 'check-item') {
                    const checked = btn.dataset.checked === 'true';
                    this.checkItem(listId, itemId, !checked);
                    this.renderListDetail(listId);
                } else if (action === 'scan-item-barcode') {
                    this.pendingItemScanListId = listId;
                    this.pendingItemScanItemId = itemId;
                    this.startItemBarcodeScan(listId, itemId);
                } else if (action === 'edit-item') {
                    this.showEditItemModal(listId, itemId);
                } else if (action === 'remove-item') {
                    if (confirm(i18n.t('shopping.confirm_remove_item'))) {
                        this.removeItem(listId, itemId);
                        this.renderListDetail(listId);
                    }
                }
            });

            itemsList.addEventListener('dragstart', e => {
                const item = e.target.closest('.shopping-item');
                if (!item) return;
                this.draggedShoppingItemId = item.dataset.itemId;
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.dataset.itemId);
                }
            });

            itemsList.addEventListener('dragover', e => {
                if (!this.draggedShoppingItemId) return;
                const item = e.target.closest('.shopping-item');
                if (!item || item.dataset.itemId === this.draggedShoppingItemId) return;
                e.preventDefault();
            });

            itemsList.addEventListener('drop', e => {
                const item = e.target.closest('.shopping-item');
                if (!item || !this.draggedShoppingItemId) return;
                e.preventDefault();
                const currentList = this.getList(listId);
                if (!currentList) return;
                const fromIndex = currentList.items.findIndex(entry => entry.id === this.draggedShoppingItemId);
                const toIndex = parseInt(item.dataset.itemIndex, 10);
                if (!this.isValidItemReorder(currentList, fromIndex, toIndex)) {
                    this.draggedShoppingItemId = null;
                    return;
                }
                this.draggedShoppingItemId = null;
                this.reorderItems(listId, fromIndex, toIndex);
                this.renderListDetail(listId);
            });

            itemsList.addEventListener('dragend', () => {
                this.draggedShoppingItemId = null;
            });
        }

        // Barcode scanner for items
        const cancelScanBtn = document.getElementById('cancelItemScanBtn');
        if (cancelScanBtn) {
            cancelScanBtn.addEventListener('click', () => {
                this.stopItemBarcodeScan();
                this.updateScanStatus(i18n.t('form.barcode_scan_cancelled'), 'info');
            });
        }

        const imageInput = document.getElementById('itemBarcodeImageInput');
        if (imageInput) {
            imageInput.addEventListener('change', e => {
                this.importItemBarcodeFromImage(e, this.pendingItemScanListId, this.pendingItemScanItemId);
            });
        }

        // Card associations
        const cardsSection = document.querySelector('.shopping-cards-section');
        if (cardsSection) {
            cardsSection.addEventListener('click', e => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const action = btn.dataset.action;
                const cardId = btn.dataset.cardId;
                const idx = parseInt(btn.dataset.index, 10);

                if (action === 'open-card') {
                    if (this.cardManager && typeof this.cardManager.showCardDetail === 'function') {
                        this.cardManager.showCardDetail(cardId);
                    }
                } else if (action === 'remove-gift-card') {
                    this.removeGiftCard(listId, cardId);
                    this.renderListDetail(listId);
                } else if (action === 'remove-loyalty-card') {
                    this.removeLoyaltyCard(listId, cardId);
                    this.renderListDetail(listId);
                } else if (action === 'move-gift-card-up') {
                    this.reorderGiftCards(listId, idx, idx - 1);
                    this.renderListDetail(listId);
                } else if (action === 'move-gift-card-down') {
                    this.reorderGiftCards(listId, idx, idx + 1);
                    this.renderListDetail(listId);
                }
            });
        }

        const addGiftCardBtn = document.getElementById('addGiftCardBtn');
        if (addGiftCardBtn) {
            addGiftCardBtn.addEventListener('click', () => this.showCardSelectionModal(listId, 'gift'));
        }

        const addLoyaltyCardBtn = document.getElementById('addLoyaltyCardBtn');
        if (addLoyaltyCardBtn) {
            addLoyaltyCardBtn.addEventListener('click', () => this.showCardSelectionModal(listId, 'loyalty'));
        }
    }

    // ===========================
    // UI: Edit List Info Modal
    // ===========================

    showEditListModal(listId) {
        const list = this.getList(listId);
        if (!list) return;
        const modal = document.getElementById('shoppingEditListModal');
        if (!modal) return;
        document.getElementById('editListName').value = list.name;
        document.getElementById('editListStore').value = list.store || '';
        document.getElementById('editListDate').value = list.plannedDate || '';
        document.getElementById('editListStatus').value = list.status;
        modal.dataset.listId = listId;
        modal.style.display = 'block';
    }

    hideEditListModal() {
        const modal = document.getElementById('shoppingEditListModal');
        if (modal) modal.style.display = 'none';
    }

    handleEditListSubmit(e) {
        e.preventDefault();
        const modal = document.getElementById('shoppingEditListModal');
        if (!modal) return;
        const listId = modal.dataset.listId;
        const name = document.getElementById('editListName').value.trim();
        const store = document.getElementById('editListStore').value.trim();
        const plannedDate = document.getElementById('editListDate').value;
        const status = document.getElementById('editListStatus').value;
        if (!name) return;
        this.updateList(listId, { name, store, plannedDate: plannedDate || null, status });
        this.hideEditListModal();
        this.renderListDetail(listId);
    }

    // ===========================
    // UI: Item Add/Edit Modal
    // ===========================

    showAddItemModal(listId) {
        const modal = document.getElementById('shoppingItemModal');
        if (!modal) return;
        modal.dataset.listId = listId;
        modal.dataset.itemId = '';

        const content = document.getElementById('shoppingItemModalContent');
        const prefill = this.pendingProductInfo;
        this.pendingProductInfo = null;
        const list = this.getList(listId);
        content.innerHTML = this.renderItemForm(null, prefill, list ? list.store : '');
        modal.style.display = 'block';
        this.bindItemFormEvents(listId, null);
    }

    showEditItemModal(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.id === itemId);
        if (!item) return;
        const modal = document.getElementById('shoppingItemModal');
        if (!modal) return;
        modal.dataset.listId = listId;
        modal.dataset.itemId = itemId;

        const content = document.getElementById('shoppingItemModalContent');
        const priceSuggestion = item.barcode ? this.getSuggestedPriceForStore(item.barcode, list.store) : null;
        content.innerHTML = this.renderItemForm(item, null, list.store, priceSuggestion);
        modal.style.display = 'block';
        this.bindItemFormEvents(listId, itemId);
    }

    renderItemForm(item, prefill = null, store = '', priceSuggestion = null) {
        const isEdit = !!item;
        const title = isEdit ? i18n.t('shopping.edit_item_title') : i18n.t('shopping.add_item_title');

        const name = item ? this.escapeHtml(item.name)
            : (prefill && prefill.name ? this.escapeHtml(prefill.name) : '');
        const note = item ? this.escapeHtml(item.note || '')
            : (prefill ? this.escapeHtml(this.buildProductNote(prefill)) : '');
        const pricingMode = item ? item.pricingMode : 'unit';
        const unitPrice = item && item.unitPriceCents !== null ? (item.unitPriceCents / 100).toFixed(2) : '';
        const qty = item ? (item.quantity !== null ? item.quantity : 1) : 1;
        const pricePerKg = item && item.pricePerKgCents !== null ? (item.pricePerKgCents / 100).toFixed(2) : '';
        const weight = item && item.weightKg !== null ? item.weightKg : '';
        const barcode = item && item.barcode ? this.escapeHtml(item.barcode)
            : (prefill && prefill.barcode ? this.escapeHtml(prefill.barcode) : '');

        // Product info from cache
        const barcodeValue = item && item.barcode ? item.barcode : (prefill && prefill.barcode ? prefill.barcode : null);
        const cachedProduct = barcodeValue ? this.getProductFromCache(barcodeValue) : null;
        let productInfoHtml = '';
        if (cachedProduct && cachedProduct.name) {
            const imgHtml = cachedProduct.imageUrl
                ? `<img src="${this.escapeHtml(cachedProduct.imageUrl)}" alt="" class="product-lookup-image" loading="lazy">`
                : '';
            const brandHtml = cachedProduct.brand
                ? `<span class="product-lookup-brand">${this.escapeHtml(cachedProduct.brand)}</span>` : '';
            const qtyHtml = cachedProduct.quantity
                ? `<span class="product-lookup-qty">${this.escapeHtml(cachedProduct.quantity)}</span>` : '';
            productInfoHtml = `<div class="product-lookup-info">
                ${imgHtml}
                <div class="product-lookup-details">
                    <span class="product-lookup-name">${this.escapeHtml(cachedProduct.name)}</span>
                    ${brandHtml}${qtyHtml}
                </div>
            </div>`;
        }

        // Price suggestion hint
        let priceSuggestionHtml = '';
        if (priceSuggestion) {
            const suggestedPrice = (priceSuggestion.unitPriceCents / 100).toFixed(2);
            priceSuggestionHtml = `<div class="price-suggestion" data-price="${priceSuggestion.unitPriceCents}">
                <span>${this.escapeHtml(i18n.t('shopping.price_suggestion', { price: suggestedPrice, store: store, date: priceSuggestion.observedAt }))}</span>
                <button type="button" class="btn btn-secondary btn-small" id="useSuggestedPriceBtn">${this.escapeHtml(i18n.t('shopping.use_suggested_price'))}</button>
            </div>`;
        }

        return `<h3>${this.escapeHtml(title)}</h3>
        <form id="shoppingItemForm">
            ${productInfoHtml}
            <div class="form-group">
                <label for="itemName">${this.escapeHtml(i18n.t('shopping.item_name'))}</label>
                <input type="text" id="itemName" value="${name}" required autocomplete="off">
            </div>
            <div class="form-group">
                <label for="itemNote">${this.escapeHtml(i18n.t('shopping.item_note'))}</label>
                <input type="text" id="itemNote" value="${note}" autocomplete="off">
            </div>
            <div class="form-group">
                <label for="itemBarcode">${this.escapeHtml(i18n.t('shopping.item_barcode'))}</label>
                <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                    <input type="text" id="itemBarcode" value="${barcode}" autocomplete="off" style="flex:1;min-width:120px;">
                    <button type="button" class="btn btn-secondary btn-small" id="scanItemBarcodeBtn">📷</button>
                    <button type="button" class="btn btn-secondary btn-small" id="importItemBarcodeBtn">🖼️</button>
                </div>
            </div>

            <div class="form-group">
                <label>${this.escapeHtml(i18n.t('shopping.pricing_mode'))}</label>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="pricingMode" value="unit" ${pricingMode === 'unit' ? 'checked' : ''}>
                        ${this.escapeHtml(i18n.t('shopping.pricing_unit'))}
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="pricingMode" value="weight" ${pricingMode === 'weight' ? 'checked' : ''}>
                        ${this.escapeHtml(i18n.t('shopping.pricing_weight'))}
                    </label>
                </div>
            </div>

            <div id="unitPriceFields" class="pricing-fields" style="display:${pricingMode === 'unit' ? 'block' : 'none'};">
                ${priceSuggestionHtml}
                <div class="form-group">
                    <label for="itemUnitPrice">${this.escapeHtml(i18n.t('shopping.unit_price'))}</label>
                    <input type="number" id="itemUnitPrice" value="${unitPrice}" step="0.01" min="0" inputmode="decimal">
                </div>
                <div class="form-group">
                    <label for="itemQuantity">${this.escapeHtml(i18n.t('shopping.quantity'))}</label>
                    <input type="number" id="itemQuantity" value="${qty}" step="1" min="1" inputmode="numeric">
                </div>
            </div>

            <div id="weightPriceFields" class="pricing-fields" style="display:${pricingMode === 'weight' ? 'block' : 'none'};">
                <div class="form-group">
                    <label for="itemPricePerKg">${this.escapeHtml(i18n.t('shopping.price_per_kg'))}</label>
                    <input type="number" id="itemPricePerKg" value="${pricePerKg}" step="0.01" min="0" inputmode="decimal">
                </div>
                <div class="form-group">
                    <label for="itemWeight">${this.escapeHtml(i18n.t('shopping.weight_kg'))}</label>
                    <input type="number" id="itemWeight" value="${weight}" step="0.001" min="0" inputmode="decimal">
                </div>
            </div>

            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button type="submit" class="btn btn-primary">${this.escapeHtml(i18n.t(isEdit ? 'shopping.save_item' : 'shopping.add_item'))}</button>
                <button type="button" class="btn btn-secondary" id="cancelItemFormBtn">${this.escapeHtml(i18n.t('shopping.cancel'))}</button>
            </div>
        </form>`;
    }

    bindItemFormEvents(listId, itemId) {
        // Pricing mode toggle
        document.querySelectorAll('input[name="pricingMode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const mode = document.querySelector('input[name="pricingMode"]:checked').value;
                document.getElementById('unitPriceFields').style.display = mode === 'unit' ? 'block' : 'none';
                document.getElementById('weightPriceFields').style.display = mode === 'weight' ? 'block' : 'none';
            });
        });

        // Use suggested price button
        const useSuggBtn = document.getElementById('useSuggestedPriceBtn');
        if (useSuggBtn) {
            useSuggBtn.addEventListener('click', () => {
                const hint = document.querySelector('.price-suggestion');
                if (!hint) return;
                const price = parseInt(hint.dataset.price, 10);
                const priceInput = document.getElementById('itemUnitPrice');
                if (priceInput) priceInput.value = (price / 100).toFixed(2);
                // Ensure unit pricing mode is selected
                const unitRadio = document.querySelector('input[name="pricingMode"][value="unit"]');
                if (unitRadio) {
                    unitRadio.checked = true;
                    document.getElementById('unitPriceFields').style.display = 'block';
                    document.getElementById('weightPriceFields').style.display = 'none';
                }
            });
        }

        // Barcode scan
        const scanBtn = document.getElementById('scanItemBarcodeBtn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                // Store pending item for scanner
                this.pendingItemScanListId = listId;
                this.pendingItemScanItemId = itemId || '__new__';
                // Close modal, then show scanner in detail view
                this.hideItemModal();
                this.startItemBarcodeScan(listId, itemId || '__new__');
            });
        }

        const importBarcodeBtn = document.getElementById('importItemBarcodeBtn');
        if (importBarcodeBtn) {
            importBarcodeBtn.addEventListener('click', () => {
                this.pendingItemScanListId = listId;
                this.pendingItemScanItemId = itemId || '__new__';
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', e => this.importItemBarcodeFromImage(e, listId, itemId || '__new__'));
                input.click();
            });
        }

        // Cancel
        const cancelBtn = document.getElementById('cancelItemFormBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideItemModal());
        }

        // Submit
        const form = document.getElementById('shoppingItemForm');
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                this.handleItemFormSubmit(listId, itemId);
            });
        }
    }

    handleItemFormSubmit(listId, itemId) {
        const name = document.getElementById('itemName').value.trim();
        if (!name) return;

        const note = document.getElementById('itemNote').value.trim();
        const pricingMode = document.querySelector('input[name="pricingMode"]:checked').value;
        const barcode = document.getElementById('itemBarcode').value.trim() || null;

        let unitPriceCents = null;
        let quantity = 1;
        let pricePerKgCents = null;
        let weightKg = null;

        if (pricingMode === 'unit') {
            const unitPriceVal = document.getElementById('itemUnitPrice').value;
            if (unitPriceVal !== '') unitPriceCents = this.eurToCents(unitPriceVal);
            const qtyVal = document.getElementById('itemQuantity').value;
            quantity = qtyVal !== '' ? parseInt(qtyVal, 10) : 1;
        } else {
            const ppkgVal = document.getElementById('itemPricePerKg').value;
            if (ppkgVal !== '') pricePerKgCents = this.eurToCents(ppkgVal);
            const wVal = document.getElementById('itemWeight').value;
            if (wVal !== '') weightKg = parseFloat(wVal);
        }

        if (itemId) {
            this.updateItem(listId, itemId, { name, note, pricingMode, barcode, unitPriceCents, quantity, pricePerKgCents, weightKg });
        } else {
            const item = this.addItem(listId, name, note);
            this.updateItem(listId, item.id, { pricingMode, barcode, unitPriceCents, quantity, pricePerKgCents, weightKg });
        }

        // Save price to product cache for future suggestions
        if (barcode && pricingMode === 'unit' && unitPriceCents !== null) {
            const list = this.getList(listId);
            if (list && list.store) {
                this.recordPriceForBarcode(barcode, list.store, unitPriceCents);
            }
        }
        // Persist manually entered product name if not already cached
        if (barcode && name) {
            const existing = this.getProductFromCache(barcode);
            if (!existing || !existing.name) {
                this.saveProductToCache(barcode, { ...(existing || {}), name });
            }
        }

        this.hideItemModal();
        this.renderListDetail(listId);
    }

    hideItemModal() {
        const modal = document.getElementById('shoppingItemModal');
        if (modal) modal.style.display = 'none';
    }

    // ===========================
    // UI: Card Selection Modal
    // ===========================

    showCardSelectionModal(listId, cardType) {
        const modal = document.getElementById('shoppingCardSelectionModal');
        if (!modal) return;
        modal.dataset.listId = listId;
        modal.dataset.cardType = cardType;

        const content = document.getElementById('shoppingCardSelectionContent');
        const list = this.getList(listId);
        if (!list) return;

        const alreadyAdded = cardType === 'gift' ? list.giftCardIds : list.loyaltyCardIds;

        const availableCards = this.cardManager ? this.cardManager.cards.filter(card => {
            if (card.archived) return false;
            if (alreadyAdded.includes(card.id)) return false;
            const isFidelity = this.cardManager.isFidelityCard(card);
            return cardType === 'gift' ? !isFidelity : isFidelity;
        }) : [];

        const title = cardType === 'gift' ? i18n.t('shopping.select_gift_card') : i18n.t('shopping.select_loyalty_card');

        let html = `<h3>${this.escapeHtml(title)}</h3>`;
        if (availableCards.length === 0) {
            html += `<p class="shopping-empty">${this.escapeHtml(i18n.t('shopping.no_cards_available'))}</p>`;
        } else {
            html += '<div class="card-selection-list">';
            availableCards.forEach(card => {
                const balance = !this.cardManager.isFidelityCard(card) ? ` – €${(card.currentBalance || 0).toFixed(2)}` : '';
                html += `<button class="card-selection-item" data-card-id="${this.escapeHtml(card.id)}">
                    <span class="card-selection-name">${this.escapeHtml(card.name)}</span>
                    <span class="card-selection-balance">${this.escapeHtml(balance)}</span>
                </button>`;
            });
            html += '</div>';
        }
        html += `<button class="btn btn-secondary" id="cancelCardSelectionBtn">${this.escapeHtml(i18n.t('shopping.cancel'))}</button>`;

        content.innerHTML = html;
        modal.style.display = 'block';

        content.querySelectorAll('.card-selection-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const cardId = btn.dataset.cardId;
                if (cardType === 'gift') {
                    this.addGiftCard(listId, cardId);
                } else {
                    this.addLoyaltyCard(listId, cardId);
                }
                modal.style.display = 'none';
                this.renderListDetail(listId);
            });
        });

        const cancelBtn = document.getElementById('cancelCardSelectionBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
    }

    // ===========================
    // UI: Checkout Mode
    // ===========================

    showCheckoutModal(listId) {
        const list = this.getList(listId);
        const modal = document.getElementById('shoppingCheckoutModal');
        if (!list || !modal) return;

        this.renderCheckoutContent(listId);
        modal.style.display = 'block';

        // Try to keep screen awake
        this.acquireWakeLock();
    }

    hideCheckoutModal() {
        const modal = document.getElementById('shoppingCheckoutModal');
        if (modal) modal.style.display = 'none';
        this.releaseWakeLock();
    }

    renderCheckoutContent(listId) {
        const list = this.getList(listId);
        const content = document.getElementById('shoppingCheckoutContent');
        if (!list || !content) return;

        const summary = this.calculateCheckoutSummary(listId);
        const allCards = [
            ...list.loyaltyCardIds.map(id => ({ id, type: 'loyalty' })),
            ...list.giftCardIds.map(id => ({ id, type: 'gift' }))
        ];

        let html = `
        <div class="checkout-header">
            <h2>🛒 ${this.escapeHtml(i18n.t('shopping.checkout_mode'))}</h2>
            <button class="btn btn-secondary btn-small" id="closeCheckoutBtn">✕ ${this.escapeHtml(i18n.t('shopping.close'))}</button>
        </div>

        <div class="checkout-summary">
            <div class="checkout-total-row">
                <span>${this.escapeHtml(i18n.t('shopping.estimated_total'))}</span>
                <strong>${this.escapeHtml(this.formatCents(summary.shoppingTotalCents))}</strong>
            </div>
            <div class="checkout-total-row">
                <span>${this.escapeHtml(i18n.t('shopping.gift_card_coverage'))}</span>
                <strong class="checkout-covered">${this.escapeHtml(this.formatCents(summary.giftCardCoverageCents))}</strong>
            </div>
            <div class="checkout-total-row checkout-remaining-row">
                <span>${this.escapeHtml(i18n.t('shopping.remaining_to_pay'))}</span>
                <strong class="checkout-remaining">${this.escapeHtml(this.formatCents(summary.remainingToPayCents))}</strong>
            </div>
        </div>

        ${summary.allocation.length > 0 ? `
        <div class="checkout-allocation">
            <h3>${this.escapeHtml(i18n.t('shopping.gift_card_allocation'))}</h3>
            ${summary.allocation.map(a => {
                const card = this.getCardInfo(a.cardId);
                const name = card ? this.escapeHtml(card.name) : i18n.t('shopping.card_not_found');
                return `<div class="checkout-allocation-item">
                    <span class="checkout-alloc-name">${name}</span>
                    <span class="checkout-alloc-balance">${this.escapeHtml(i18n.t('shopping.balance'))}: ${this.escapeHtml(this.formatCents(a.balanceCents))}</span>
                    <span class="checkout-alloc-usage">${this.escapeHtml(i18n.t('shopping.suggested_use'))}: <strong>${this.escapeHtml(this.formatCents(a.suggestedUsageCents))}</strong></span>
                    ${a.unusedBalanceCents > 0 ? `<span class="checkout-alloc-remaining">${this.escapeHtml(i18n.t('shopping.remaining_balance'))}: ${this.escapeHtml(this.formatCents(a.unusedBalanceCents))}</span>` : ''}
                </div>`;
            }).join('')}
        </div>` : ''}

        ${allCards.length > 0 ? `
        <div class="checkout-cards">
            <h3>${this.escapeHtml(i18n.t('shopping.cards_for_checkout'))}</h3>
            <div class="checkout-cards-nav">
                <button class="btn btn-secondary" id="checkoutPrevCard" aria-label="${this.escapeHtml(i18n.t('shopping.prev_card'))}">&lsaquo;</button>
                <span id="checkoutCardCounter">1 / ${allCards.length}</span>
                <button class="btn btn-secondary" id="checkoutNextCard" aria-label="${this.escapeHtml(i18n.t('shopping.next_card'))}">&rsaquo;</button>
            </div>
            <div id="checkoutCardDisplay"></div>
        </div>` : ''}

        <div class="checkout-actions">
            <button class="btn btn-primary" id="confirmPaymentBtn">${this.escapeHtml(i18n.t('shopping.confirm_payment'))}</button>
        </div>`;

        content.innerHTML = html;

        // Bind events
        const closeBtn = document.getElementById('closeCheckoutBtn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideCheckoutModal());

        const confirmBtn = document.getElementById('confirmPaymentBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.showConfirmPaymentModal(listId));

        // Card navigation
        if (allCards.length > 0) {
            let currentCardIndex = 0;
            const showCard = (index) => {
                currentCardIndex = Math.max(0, Math.min(allCards.length - 1, index));
                const cardInfo = allCards[currentCardIndex];
                const card = this.getCardInfo(cardInfo.id);
                const counter = document.getElementById('checkoutCardCounter');
                if (counter) counter.textContent = `${currentCardIndex + 1} / ${allCards.length}`;
                this.renderCheckoutCard(cardInfo.id, cardInfo.type);
            };

            const prevBtn = document.getElementById('checkoutPrevCard');
            if (prevBtn) prevBtn.addEventListener('click', () => showCard(currentCardIndex - 1));

            const nextBtn = document.getElementById('checkoutNextCard');
            if (nextBtn) nextBtn.addEventListener('click', () => showCard(currentCardIndex + 1));

            showCard(0);
        }
    }

    renderCheckoutCard(cardId, cardType) {
        const display = document.getElementById('checkoutCardDisplay');
        if (!display) return;
        const card = this.getCardInfo(cardId);
        if (!card) {
            display.innerHTML = `<p>${this.escapeHtml(i18n.t('shopping.card_not_found'))}</p>`;
            return;
        }

        const typeLabel = cardType === 'loyalty' ? i18n.t('card.fidelity_badge') : i18n.t('shopping.gift_card_label');
        const balance = cardType === 'loyalty' ? '' :
            `<p class="checkout-card-balance">${this.escapeHtml(i18n.t('card.current_balance'))} <strong>€${(card.currentBalance || 0).toFixed(2)}</strong></p>`;

        display.innerHTML = `
        <div class="checkout-card-display">
            <div class="checkout-card-header">
                <span class="checkout-card-name">${this.escapeHtml(card.name)}</span>
                <span class="checkout-card-type">${this.escapeHtml(typeLabel)}</span>
            </div>
            ${balance}
            <button class="btn btn-primary checkout-barcode-btn" data-card-id="${this.escapeHtml(cardId)}"
                aria-label="${this.escapeHtml(i18n.t('shopping.show_barcode', { name: card.name }))}"
                id="showCheckoutBarcodeBtn">
                🔖 ${this.escapeHtml(i18n.t('shopping.show_barcode_btn'))}
            </button>
            <div id="checkoutBarcodeDisplay" class="checkout-barcode-display" style="display:none;"></div>
        </div>`;

        const barcodeBtn = document.getElementById('showCheckoutBarcodeBtn');
        if (barcodeBtn) {
            barcodeBtn.addEventListener('click', () => this.toggleCheckoutBarcode(card));
        }
    }

    toggleCheckoutBarcode(card) {
        const barcodeDisplay = document.getElementById('checkoutBarcodeDisplay');
        if (!barcodeDisplay) return;

        if (barcodeDisplay.style.display !== 'none') {
            barcodeDisplay.style.display = 'none';
            return;
        }

        // Generate barcode using existing barcode.js
        if (typeof generateBarcode === 'function') {
            const canvas = document.createElement('canvas');
            canvas.setAttribute('aria-label', i18n.t('shopping.barcode_for', { name: card.name }));
            barcodeDisplay.innerHTML = '';
            barcodeDisplay.appendChild(canvas);
            try {
                generateBarcode(canvas, card.number, card.barcodeFormat || 'CODE128');
            } catch {
                barcodeDisplay.innerHTML = `<p>${this.escapeHtml(card.number)}</p>`;
            }
        } else {
            barcodeDisplay.innerHTML = `<p>${this.escapeHtml(card.number)}</p>`;
        }
        barcodeDisplay.style.display = 'block';
    }

    // ===========================
    // UI: Confirm Payment Modal
    // ===========================

    showConfirmPaymentModal(listId) {
        const list = this.getList(listId);
        const modal = document.getElementById('shoppingConfirmPaymentModal');
        if (!list || !modal) return;

        const defaultPayments = this.prepareDefaultPayments(listId);
        const summary = this.calculateCheckoutSummary(listId);

        let html = `<h3>${this.escapeHtml(i18n.t('shopping.confirm_payment_title'))}</h3>
        <form id="confirmPaymentForm">
            <div class="form-group">
                <label for="finalTotal">${this.escapeHtml(i18n.t('shopping.final_total'))}</label>
                <input type="number" id="finalTotal" value="${(summary.shoppingTotalCents / 100).toFixed(2)}" step="0.01" min="0" inputmode="decimal" required>
            </div>

            <h4>${this.escapeHtml(i18n.t('shopping.payment_breakdown'))}</h4>`;

        defaultPayments.forEach((payment, index) => {
            const card = this.getCardInfo(payment.cardId);
            const name = card ? this.escapeHtml(card.name) : this.escapeHtml(i18n.t('shopping.card_not_found'));
            html += `<div class="form-group">
                <label for="paymentAmount${index}">${name}</label>
                <input type="number" id="paymentAmount${index}" data-card-id="${this.escapeHtml(payment.cardId)}"
                    value="${(payment.amountCents / 100).toFixed(2)}" step="0.01" min="0" inputmode="decimal">
            </div>`;
        });

        html += `<div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
            <button type="submit" class="btn btn-primary">${this.escapeHtml(i18n.t('shopping.confirm_and_update'))}</button>
            <button type="button" class="btn btn-secondary" id="cancelConfirmPaymentBtn">${this.escapeHtml(i18n.t('shopping.cancel'))}</button>
        </div>
        </form>`;

        document.getElementById('shoppingConfirmPaymentContent').innerHTML = html;
        modal.dataset.listId = listId;
        modal.style.display = 'block';

        const cancelBtn = document.getElementById('cancelConfirmPaymentBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });

        const form = document.getElementById('confirmPaymentForm');
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                const finalTotal = document.getElementById('finalTotal').value;
                const finalTotalCents = this.eurToCents(finalTotal);

                const payments = defaultPayments.map((p, index) => ({
                    cardId: p.cardId,
                    amountCents: this.eurToCents(document.getElementById('paymentAmount' + index).value) || 0
                }));

                this.confirmPayment(listId, finalTotalCents, payments);
                modal.style.display = 'none';
                this.hideCheckoutModal();
                alert(i18n.t('shopping.payment_confirmed'));
                this.renderListDetail(listId);
            });
        }
    }

    // ===========================
    // Init
    // ===========================

    init() {
        // Create list button
        const createBtn = document.getElementById('createShoppingListBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateListModal());
        }

        // Create list form
        const createForm = document.getElementById('shoppingCreateListForm');
        if (createForm) {
            createForm.addEventListener('submit', e => this.handleCreateListSubmit(e));
        }

        // Create list modal close
        const createModalClose = document.getElementById('shoppingCreateListModalClose');
        if (createModalClose) {
            createModalClose.addEventListener('click', () => this.hideCreateListModal());
        }

        // Edit list form
        const editForm = document.getElementById('shoppingEditListForm');
        if (editForm) {
            editForm.addEventListener('submit', e => this.handleEditListSubmit(e));
        }

        // Edit list modal close
        const editModalClose = document.getElementById('shoppingEditListModalClose');
        if (editModalClose) {
            editModalClose.addEventListener('click', () => this.hideEditListModal());
        }

        const cancelEditListBtn = document.getElementById('cancelEditListBtn');
        if (cancelEditListBtn) {
            cancelEditListBtn.addEventListener('click', () => this.hideEditListModal());
        }

        // Item modal close
        const itemModalClose = document.getElementById('shoppingItemModalClose');
        if (itemModalClose) {
            itemModalClose.addEventListener('click', () => this.hideItemModal());
        }

        // Card selection modal close
        const cardSelectionClose = document.getElementById('shoppingCardSelectionModalClose');
        if (cardSelectionClose) {
            cardSelectionClose.addEventListener('click', () => {
                const modal = document.getElementById('shoppingCardSelectionModal');
                if (modal) modal.style.display = 'none';
            });
        }

        // Checkout modal close
        const checkoutModalClose = document.getElementById('shoppingCheckoutModalClose');
        if (checkoutModalClose) {
            checkoutModalClose.addEventListener('click', () => this.hideCheckoutModal());
        }

        // Confirm payment modal close
        const confirmPaymentClose = document.getElementById('shoppingConfirmPaymentModalClose');
        if (confirmPaymentClose) {
            confirmPaymentClose.addEventListener('click', () => {
                const modal = document.getElementById('shoppingConfirmPaymentModal');
                if (modal) modal.style.display = 'none';
            });
        }

        // Close modals when clicking backdrop
        ['shoppingCreateListModal', 'shoppingEditListModal', 'shoppingItemModal',
         'shoppingCardSelectionModal', 'shoppingCheckoutModal', 'shoppingConfirmPaymentModal']
        .forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', e => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                        if (modalId === 'shoppingCheckoutModal') this.releaseWakeLock();
                    }
                });
            }
        });

        // Re-render on language change
        window.addEventListener('languageChanged', () => {
            const hash = window.location.hash;
            if (hash === '#shoppingListsSection') {
                this.renderShoppingLists();
            } else if (hash.startsWith('#shoppingListDetail:')) {
                const listId = hash.split(':').slice(1).join(':');
                this.renderListDetail(listId);
            }
        });
    }
}

// Export for testing (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShoppingListManager };
}

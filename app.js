// Gift Card Manager Application
class GiftCardManager {
    constructor() {
        this.cards = this.loadCards();
        this.stores = [];
    }

    // Check if a card is a fidelity card (no balance tracking)
    isFidelityCard(card) {
        return card.currentBalance === null || card.currentBalance === undefined || card.currentBalance === 0;
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
    }
    
    // Handle navigation based on URL hash
    handleHashNavigation() {
        const hash = window.location.hash;
        
        // Define section visibility rules
        const sections = {
            'archivedCardsSection': { id: 'archivedCardsSection', visibleOn: ['#archivedCardsSection'] },
            'cardsList': { id: 'cardsList', visibleOn: ['default'] },
            'addCardSection': { id: 'addCardSection', visibleOn: ['default'] },
            'importExportSection': { id: 'importExportSection', visibleOn: ['default'] },
            'introSection': { id: 'introSection', visibleOn: ['default'] }
        };
        
        // Determine current view
        const currentView = hash === '#archivedCardsSection' ? '#archivedCardsSection' : 'default';
        
        // Update visibility for all sections
        Object.values(sections).forEach(section => {
            const element = document.getElementById(section.id);
            if (element) {
                element.style.display = section.visibleOn.includes(currentView) ? 'block' : 'none';
            }
        });
        
        // Render archived cards if on that view
        if (currentView === '#archivedCardsSection') {
            this.renderArchivedCards();
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
        const stored = localStorage.getItem('giftCards');
        return stored ? JSON.parse(stored) : [];
    }

    // Save cards to localStorage
    saveCards() {
        localStorage.setItem('giftCards', JSON.stringify(this.cards));
    }

    // Add a new gift card
    addCard() {
        const cardNumber = document.getElementById('cardNumber').value.trim();
        const cardName = document.getElementById('cardName').value.trim();
        const initialBalanceValue = document.getElementById('initialBalance').value.trim();
        
        // Check if this is a fidelity card (no balance or 0 balance) or a gift card (with balance)
        const isFidelityCard = initialBalanceValue === '' || parseFloat(initialBalanceValue) === 0;
        const initialBalance = isFidelityCard ? null : parseFloat(initialBalanceValue);

        // Check if card number already exists
        if (this.cards.find(card => card.number === cardNumber)) {
            alert('A card with this number already exists!');
            return;
        }

        const newCard = {
            id: Date.now().toString(),
            number: cardNumber,
            name: cardName,
            initialBalance: initialBalance,
            currentBalance: initialBalance,
            barcodeFormat: 'CODE128', // Default barcode format
            transactions: isFidelityCard ? [] : [{
                date: new Date().toISOString(),
                amount: initialBalance,
                type: 'initial',
                balanceAfter: initialBalance,
                description: 'Initial balance'
            }],
            createdAt: new Date().toISOString(),
            archived: false
        };

        this.cards.push(newCard);
        this.saveCards();
        this.renderCards();

        // Reset form
        document.getElementById('addCardForm').reset();

        // Show success message
        const cardType = isFidelityCard ? 'Fidelity card' : 'Gift card';
        alert(`${cardType} "${cardName}" added successfully!`);
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
                    <p>No gift cards yet. <a href="#addCardSection" class="nav-section-link">Add your first card</a>!</p>
                </div>
            `;
            
            // Still show link to archived cards if there are any
            if (archivedCards.length > 0) {
                container.innerHTML += `
                    <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                        <a href="#archivedCardsSection" class="nav-section-link" style="font-size: 1rem; font-weight: 600;">
                            📦 View Archived Cards (${archivedCards.length})
                        </a>
                    </div>
                `;
            }
            return;
        }

        container.innerHTML = activeCards.map(card => {
            const store = this.matchStore(card.name);
            const storeIcon = store ? `<img src="${this.escapeHtml(this.getStoreIcon(store))}" alt="${this.escapeHtml(store.name)}" onerror="this.src='${this.escapeHtml(store.icon)}'" style="width: 2rem; height: 2rem; margin-right: 10px; object-fit: contain;" />` : '';
            const cardStyle = store ? `border-left: 4px solid ${store.color};` : '';
            
            // Check if this is a fidelity card (no balance tracking)
            const balanceDisplay = this.isFidelityCard(card)
                ? '<span class="fidelity-badge" style="background: #9C27B0; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Fidelity Card</span>' 
                : `<div class="card-balance" ${store ? `style="color: ${store.color};"` : ''}>€${card.currentBalance.toFixed(2)}</div>`;
            
            return `
                <div class="card" onclick="giftCardManager.showCardDetail('${card.id}')" style="${cardStyle}">
                    <div class="card-header">
                        <div style="display: flex; align-items: center;">
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
        }).join('');
        
        // Add link to archived cards if there are any
        if (archivedCards.length > 0) {
            container.innerHTML += `
                <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                    <a href="#archivedCardsSection" class="nav-section-link" style="font-size: 1rem; font-weight: 600;">
                        📦 View Archived Cards (${archivedCards.length})
                    </a>
                </div>
            `;
        }
    }

    // Render archived cards
    renderArchivedCards() {
        const container = document.getElementById('archivedCardsContainer');
        
        // Filter archived cards
        const archivedCards = this.cards.filter(card => card.archived);
        
        if (archivedCards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No archived cards.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = archivedCards.map(card => {
            const store = this.matchStore(card.name);
            const storeIcon = store ? `<img src="${this.escapeHtml(this.getStoreIcon(store))}" alt="${this.escapeHtml(store.name)}" onerror="this.src='${this.escapeHtml(store.icon)}'" style="width: 2rem; height: 2rem; margin-right: 10px; object-fit: contain;" />` : '';
            const cardStyle = store ? `border-left: 4px solid ${store.color};` : '';
            
            // Check if this is a fidelity card (no balance tracking)
            const balanceDisplay = this.isFidelityCard(card)
                ? '<span class="fidelity-badge" style="background: #9C27B0; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Fidelity Card</span>' 
                : `<div class="card-balance" ${store ? `style="color: ${store.color};"` : ''}>€${card.currentBalance.toFixed(2)}</div>`;
            
            return `
                <div class="card" onclick="giftCardManager.showCardDetail('${card.id}')" style="${cardStyle}">
                    <div class="card-header">
                        <div style="display: flex; align-items: center;">
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
        }).join('');
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
                <p><strong>Card Number:</strong> ${this.escapeHtml(card.number)}</p>
                ${this.isFidelityCard(card) ? '<p><strong>Type:</strong> <span style="color: #9C27B0; font-weight: bold;">Fidelity Card</span></p>' : `<p><strong>Current Balance:</strong> <span style="color: ${store.color}; font-weight: bold;">€${card.currentBalance.toFixed(2)}</span></p>
                <p><strong>Initial Balance:</strong> €${card.initialBalance.toFixed(2)}</p>`}
            `;
        } else {
            content.innerHTML = `
                <h2>${this.escapeHtml(card.name)}</h2>
                <p><strong>Card Number:</strong> ${this.escapeHtml(card.number)}</p>
                ${this.isFidelityCard(card) ? '<p><strong>Type:</strong> <span style="color: #9C27B0; font-weight: bold;">Fidelity Card</span></p>' : `<p><strong>Current Balance:</strong> <span class="text-success">€${card.currentBalance.toFixed(2)}</span></p>
                <p><strong>Initial Balance:</strong> €${card.initialBalance.toFixed(2)}</p>`}
            `;
        }
        
        content.innerHTML += `
            <div class="barcode-settings">
                <div class="form-group">
                    <label for="barcodeFormat">Barcode Type:</label>
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
                <h3>Add Transaction</h3>
                <form id="transactionForm">
                    <div class="form-group">
                        <label for="transactionAmount">Amount Spent (€):</label>
                        <input type="number" id="transactionAmount" step="0.01" min="0" max="${card.currentBalance}" required placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label for="transactionDescription">Description (optional):</label>
                        <input type="text" id="transactionDescription" placeholder="e.g., Coffee at Starbucks">
                    </div>
                    <button type="submit" class="btn btn-secondary">Record Transaction</button>
                </form>
            </div>

            <div class="transaction-history">
                <h3>Transaction History</h3>
                ${this.renderTransactions(card)}
            </div>`}

            <div class="mt-20">
                ${card.archived 
                    ? `<button class="btn btn-secondary btn-small" onclick="giftCardManager.unarchiveCard('${card.id}')">Unarchive Card</button>`
                    : `<button class="btn btn-secondary btn-small" onclick="giftCardManager.archiveCard('${card.id}')">Archive Card</button>`
                }
                <button class="btn btn-danger btn-small" onclick="giftCardManager.deleteCard('${card.id}')">Delete Card</button>
            </div>
        `;

        // Generate barcode-style visual
// Génération réelle avec bwip-js
const generateBarcode = () => {
    const selectedFormat = document.getElementById('barcodeFormat').value;
    renderBarcode('#barcode', card.number, {
        format: selectedFormat,
        scale: 3,         // largeur des modules
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

    // Render transaction history
    renderTransactions(card) {
        if (card.transactions.length === 0) {
            return '<p class="empty-state">No transactions yet.</p>';
        }

        // Sort transactions by date (newest first)
        const sortedTransactions = [...card.transactions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        return sortedTransactions.map(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const isPositive = transaction.type === 'initial' || transaction.amount > 0;
            const amountDisplay = transaction.type === 'initial' 
                ? `Initial Balance: €${transaction.amount.toFixed(2)}`
                : `Spent: €${Math.abs(transaction.amount).toFixed(2)}`;

            return `
                <div class="transaction-item ${isPositive && transaction.type === 'initial' ? 'positive' : ''}">
                    <div class="transaction-date">${formattedDate}</div>
                    <div class="transaction-amount ${transaction.type === 'initial' ? 'text-success' : 'text-danger'}">
                        ${amountDisplay}
                    </div>
                    ${transaction.description ? `<div><small>${this.escapeHtml(transaction.description)}</small></div>` : ''}
                    <div class="transaction-balance">Balance after: €${transaction.balanceAfter.toFixed(2)}</div>
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
            alert('Transactions are not supported for fidelity cards.');
            return;
        }

        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const description = document.getElementById('transactionDescription').value.trim();

        if (amount > card.currentBalance) {
            alert('Transaction amount exceeds current balance!');
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

    // Delete a card
    deleteCard(cardId) {
        if (!confirm('Are you sure you want to delete this gift card? This action cannot be undone.')) {
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
                cards: this.cards
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
            
            alert(`Data exported successfully to ${filename}`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data. Please try again.');
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
                    throw new Error('Invalid data format: missing cards array');
                }

                // Validate each card has required fields with proper types
                for (const card of importedData.cards) {
                    // Check for required fields and their types
                    if (!card.id || typeof card.id !== 'string' || card.id.trim() === '') {
                        throw new Error('Invalid card data: id must be a non-empty string');
                    }
                    if (!card.number || typeof card.number !== 'string' || card.number.trim() === '') {
                        throw new Error('Invalid card data: number must be a non-empty string');
                    }
                    if (!card.name || typeof card.name !== 'string' || card.name.trim() === '') {
                        throw new Error('Invalid card data: name must be a non-empty string');
                    }
                    if (!Array.isArray(card.transactions)) {
                        throw new Error('Invalid card data: transactions must be an array');
                    }
                    // Validate balance fields (can be null for fidelity cards, or numbers for gift cards)
                    if (card.initialBalance !== null && card.initialBalance !== undefined && typeof card.initialBalance !== 'number') {
                        throw new Error('Invalid card data: initialBalance must be null or a number');
                    }
                    if (card.currentBalance !== null && card.currentBalance !== undefined && typeof card.currentBalance !== 'number') {
                        throw new Error('Invalid card data: currentBalance must be null or a number');
                    }
                }

                // Ask for confirmation before overwriting
                const currentCount = this.cards.length;
                const importCount = importedData.cards.length;
                const confirmMessage = `This will replace all current data (${currentCount} cards) with imported data (${importCount} cards). Continue?`;
                if (!confirm(confirmMessage)) {
                    // Reset file input
                    event.target.value = '';
                    return;
                }

                // Import the data and ensure archived property exists for backward compatibility
                this.cards = importedData.cards.map(card => ({
                    ...card,
                    archived: card.archived !== undefined ? card.archived : false
                }));
                this.saveCards();
                this.renderCards();
                
                // Format success message with export date if available and valid
                let exportDateStr = 'backup';
                if (importedData.exportDate) {
                    const exportDate = new Date(importedData.exportDate);
                    // Check if the date is valid
                    if (!isNaN(exportDate.getTime())) {
                        exportDateStr = exportDate.toLocaleString();
                    }
                }
                alert(`Successfully imported ${importCount} card(s) from ${exportDateStr}`);
            } catch (error) {
                console.error('Import error:', error);
                alert(`Failed to import data: ${error.message}`);
            } finally {
                // Reset file input so the same file can be selected again
                event.target.value = '';
            }
        };
        
        reader.onerror = () => {
            alert('Failed to read file. Please try again.');
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }

    // Close modal
    closeModal() {
        document.getElementById('cardDetailModal').style.display = 'none';
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
let giftCardManager;
document.addEventListener('DOMContentLoaded', async () => {
    giftCardManager = new GiftCardManager();
    await giftCardManager.init();
    
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

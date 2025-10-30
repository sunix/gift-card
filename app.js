// Gift Card Manager Application
class GiftCardManager {
    constructor() {
        this.cards = this.loadCards();
        this.stores = [];
    }

    // Load stores configuration
    async loadStores() {
        try {
            const response = await fetch('stores.json');
            this.stores = await response.json();
        } catch (error) {
            console.error('Failed to load stores configuration:', error);
            this.stores = [];
        }
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
        
        // Load cards on startup
        this.renderCards();
        
        // Set up event listeners
        document.getElementById('addCardForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCard();
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
        const initialBalance = parseFloat(document.getElementById('initialBalance').value);

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
            transactions: [{
                date: new Date().toISOString(),
                amount: initialBalance,
                type: 'initial',
                balanceAfter: initialBalance,
                description: 'Initial balance'
            }],
            createdAt: new Date().toISOString()
        };

        this.cards.push(newCard);
        this.saveCards();
        this.renderCards();

        // Reset form
        document.getElementById('addCardForm').reset();

        // Show success message
        alert(`Gift card "${cardName}" added successfully!`);
    }

    // Render all cards
    renderCards() {
        const container = document.getElementById('cardsContainer');
        
        if (this.cards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No gift cards yet. Add your first card above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.cards.map(card => {
            const store = this.matchStore(card.name);
            const storeIcon = store ? `<span style="font-size: 1.5rem; margin-right: 10px;">${store.icon}</span>` : '';
            const cardStyle = store ? `border-left: 4px solid ${store.color};` : '';
            
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
                        <div class="card-balance" ${store ? `style="color: ${store.color};"` : ''}>€${card.currentBalance.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');
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
                    <div style="font-size: 3rem; text-align: center; margin-bottom: 10px;">${store.icon}</div>
                    <h2 style="text-align: center; color: white; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${this.escapeHtml(card.name)}</h2>
                </div>
                <p><strong>Card Number:</strong> ${this.escapeHtml(card.number)}</p>
                <p><strong>Current Balance:</strong> <span style="color: ${store.color}; font-weight: bold;">€${card.currentBalance.toFixed(2)}</span></p>
                <p><strong>Initial Balance:</strong> €${card.initialBalance.toFixed(2)}</p>
            `;
        } else {
            content.innerHTML = `
                <h2>${this.escapeHtml(card.name)}</h2>
                <p><strong>Card Number:</strong> ${this.escapeHtml(card.number)}</p>
                <p><strong>Current Balance:</strong> <span class="text-success">€${card.currentBalance.toFixed(2)}</span></p>
                <p><strong>Initial Balance:</strong> €${card.initialBalance.toFixed(2)}</p>
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

            <div class="transaction-form">
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
            </div>

            <div class="mt-20">
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

        // Set up transaction form
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction(cardId);
        });

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

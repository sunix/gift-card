// Gift Card Manager Application
class GiftCardManager {
    constructor() {
        this.cards = this.loadCards();
        this.init();
    }

    init() {
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

        container.innerHTML = this.cards.map(card => `
            <div class="card" onclick="giftCardManager.showCardDetail('${card.id}')">
                <div class="card-header">
                    <div>
                        <div class="card-name">${this.escapeHtml(card.name)}</div>
                        <div class="card-number">Card #${this.escapeHtml(card.number)}</div>
                    </div>
                    <div class="card-balance">€${card.currentBalance.toFixed(2)}</div>
                </div>
            </div>
        `).join('');
    }

    // Show card detail modal
    showCardDetail(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        const content = document.getElementById('cardDetailContent');
        content.innerHTML = `
            <h2>${this.escapeHtml(card.name)}</h2>
            <p><strong>Card Number:</strong> ${this.escapeHtml(card.number)}</p>
            <p><strong>Current Balance:</strong> <span class="text-success">€${card.currentBalance.toFixed(2)}</span></p>
            <p><strong>Initial Balance:</strong> €${card.initialBalance.toFixed(2)}</p>

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

        // Generate barcode
        try {
            JsBarcode("#barcode", card.number, {
                format: "CODE128",
                width: 2,
                height: 100,
                displayValue: true
            });
        } catch (e) {
            console.error('Barcode generation failed:', e);
            document.getElementById('barcode').innerHTML = '<p>Barcode could not be generated</p>';
        }

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
document.addEventListener('DOMContentLoaded', () => {
    giftCardManager = new GiftCardManager();
});

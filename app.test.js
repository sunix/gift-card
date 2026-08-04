// app.test.js - Unit tests for GiftCardManager

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

// Mock i18n
const i18nMock = {
    t: (key, params) => {
        const translations = {
            'alert.card_exists': 'Card already exists',
            'alert.fidelity_added': 'Fidelity card {name} added',
            'alert.gift_card_added': 'Gift card {name} added',
            'alert.import_invalid': 'Invalid import data structure',
            'alert.import_invalid_id': 'Invalid card ID',
            'alert.import_invalid_number': 'Invalid card number',
            'alert.import_invalid_name': 'Invalid card name',
            'alert.import_invalid_transactions': 'Invalid transactions array',
            'alert.import_invalid_balance': 'Invalid initial balance',
            'alert.import_invalid_current': 'Invalid current balance',
            'alert.import_confirm': 'Replace {current} cards with {imported} cards?',
            'alert.import_success': 'Imported {count} cards from {date}',
            'alert.import_failed': 'Import failed: {error}',
            'alert.export_success': 'Data exported to {filename}',
            'alert.export_failed': 'Export failed',
            'alert.transaction_exceeds': 'Transaction exceeds balance',
            'alert.fidelity_no_transactions': 'Fidelity cards do not support transactions',
            'alert.barcode_import_unsupported': 'Barcode import is not supported by this browser.',
            'alert.barcode_camera_unsupported': 'Camera access is not available on this device or browser.',
            'alert.barcode_camera_failed': 'Unable to start the camera for barcode scanning.',
            'alert.barcode_not_found': 'No barcode was found in the selected picture.',
            'alert.reset_balance_prompt': 'Enter the new balance amount (default is initial balance of €{initial}):',
            'alert.reset_balance_invalid': 'Invalid amount. Please enter a valid positive number.',
            'alert.reset_balance_success': 'Balance reset to €{amount}',
            'transaction.reset_description': 'Balance reset to €{amount}',
            'form.barcode_image_processing': 'Reading barcode from picture…',
            'form.barcode_import_success': 'Barcode imported. Detected format: {format}.',
            'form.barcode_scan_cancelled': 'Barcode scan cancelled.',
            'form.barcode_camera_ready': 'Point your camera at the barcode.',
            'receipt.success': 'Successfully added {count} transaction(s)',
            'receipt.no_transactions': 'No gift card transactions found in the receipt',
            'receipt.card_not_found': 'Gift card {number} not found in your cards. Please add it first.',
            'receipt.file_no_transactions': '{file}: no gift card transaction found',
            'receipt.file_parse_error': '{file}: failed to parse. Please make sure it\'s a valid PDF receipt.',
            'receipt.file_error': '{file}: {error}'
        };
        let msg = translations[key] || key;
        if (params) {
            Object.keys(params).forEach(k => {
                msg = msg.replace(`{${k}}`, params[k]);
            });
        }
        return msg;
    },
    getCurrentLanguage: () => 'en'
};

global.localStorage = localStorageMock;
global.i18n = i18nMock;
global.alert = jest.fn();
global.confirm = jest.fn();
global.prompt = jest.fn();

// Mock window object for browser-specific code
global.window = global.window || {};

// Import the actual GiftCardManager class from app.js
const { GiftCardManager: BaseGiftCardManager } = require('./app.js');

// Extend the real GiftCardManager for testing purposes
class GiftCardManager extends BaseGiftCardManager {
    constructor() {
        super();
        // Mock input property for testing
        this.mockInput = {
            cardNumber: '',
            cardName: '',
            initialBalance: '',
            expiryDate: '',
            transactionAmount: '',
            transactionDescription: ''
        };
    }

    // Override addCard to use mockInput instead of DOM elements
    addCard() {
        const cardNumber = this.mockInput.cardNumber.trim();
        const cardName = this.mockInput.cardName.trim();
        const initialBalanceValue = this.mockInput.initialBalance.trim();
        const expiryDateValue = this.mockInput.expiryDate ? this.mockInput.expiryDate.trim() : '';
        
        const isFidelityCard = initialBalanceValue === '' || parseFloat(initialBalanceValue) === 0;
        const initialBalance = isFidelityCard ? null : parseFloat(initialBalanceValue);

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

        const alertKey = isFidelityCard ? 'alert.fidelity_added' : 'alert.gift_card_added';
        alert(i18n.t(alertKey, { name: cardName }));
        this.pendingBarcodeFormat = null;
        
        return newCard;
    }

    // Override exportData to avoid DOM dependencies
    exportData() {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            cards: this.cards
        };
        return exportData;
    }

    // Override importData for testing
    importData(importedDataString) {
        try {
            const importedData = JSON.parse(importedDataString);
            
            if (!importedData.cards || !Array.isArray(importedData.cards)) {
                throw new Error(i18n.t('alert.import_invalid'));
            }

            for (const card of importedData.cards) {
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
                if (card.initialBalance !== null && card.initialBalance !== undefined && typeof card.initialBalance !== 'number') {
                    throw new Error(i18n.t('alert.import_invalid_balance'));
                }
                if (card.currentBalance !== null && card.currentBalance !== undefined && typeof card.currentBalance !== 'number') {
                    throw new Error(i18n.t('alert.import_invalid_current'));
                }
            }

            this.cards = importedData.cards.map(card => ({
                ...card,
                archived: card.archived ?? GiftCardManager.DEFAULT_ARCHIVED_STATE
            }));
            this.saveCards();
            
            return true;
        } catch (error) {
            throw error;
        }
    }

    // Override addTransaction to use mockInput
    addTransaction(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        if (this.isFidelityCard(card)) {
            alert(i18n.t('alert.fidelity_no_transactions'));
            return;
        }

        const amount = parseFloat(this.mockInput.transactionAmount);
        const description = this.mockInput.transactionDescription.trim();

        if (amount > card.currentBalance) {
            alert(i18n.t('alert.transaction_exceeds'));
            return;
        }

        const newBalance = card.currentBalance - amount;

        const transaction = {
            date: new Date().toISOString(),
            amount: -amount,
            type: 'spend',
            balanceAfter: newBalance,
            description: description || 'Purchase'
        };

        card.transactions.push(transaction);
        card.currentBalance = newBalance;

        this.saveCards();
        
        return transaction;
    }

    // Override resetBalance for testing
    resetBalance(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        if (this.isFidelityCard(card)) {
            alert(i18n.t('alert.fidelity_no_transactions'));
            return;
        }

        const newBalanceInput = prompt(
            i18n.t('alert.reset_balance_prompt', { initial: card.initialBalance.toFixed(2) }), 
            card.initialBalance.toFixed(2)
        );

        if (newBalanceInput === null) {
            return;
        }

        const newBalance = parseFloat(newBalanceInput);
        if (isNaN(newBalance) || newBalance < 0) {
            alert(i18n.t('alert.reset_balance_invalid'));
            return;
        }

        const transaction = {
            date: new Date().toISOString(),
            amount: newBalance - card.currentBalance,
            type: 'reset',
            balanceAfter: newBalance,
            description: i18n.t('transaction.reset_description', { amount: newBalance.toFixed(2) })
        };

        card.transactions.push(transaction);
        card.currentBalance = newBalance;

        this.saveCards();
        
        alert(i18n.t('alert.reset_balance_success', { amount: newBalance.toFixed(2) }));
        
        return transaction;
    }
}


describe('GiftCardManager', () => {
    let manager;

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Reset alert, confirm, and prompt mocks
        global.alert.mockClear();
        global.confirm.mockClear();
        global.prompt.mockClear();
        document.body.innerHTML = `
            <input id="cardNumber" />
            <input id="cardName" />
            <div id="barcodeImportStatus"></div>
            <input id="barcodeImageInput" />
            <div id="barcodeScanner"></div>
            <video id="barcodeScannerVideo"></video>
        `;
        // Create a new manager instance
        manager = new GiftCardManager();
    });

    describe('addCard', () => {
        test('should add a gift card with balance', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Test Gift Card',
                initialBalance: '100'
            };

            const card = manager.addCard();

            expect(card).toBeDefined();
            expect(card.number).toBe('1234567890');
            expect(card.name).toBe('Test Gift Card');
            expect(card.initialBalance).toBe(100);
            expect(card.currentBalance).toBe(100);
            expect(card.transactions).toHaveLength(1);
            expect(card.transactions[0].type).toBe('initial');
            expect(card.transactions[0].amount).toBe(100);
            expect(manager.cards).toHaveLength(1);
            expect(alert).toHaveBeenCalledWith('Gift card Test Gift Card added');
        });

        test('should add a fidelity card without balance', () => {
            manager.mockInput = {
                cardNumber: '9876543210',
                cardName: 'Test Fidelity Card',
                initialBalance: ''
            };

            const card = manager.addCard();

            expect(card).toBeDefined();
            expect(card.number).toBe('9876543210');
            expect(card.name).toBe('Test Fidelity Card');
            expect(card.initialBalance).toBeNull();
            expect(card.currentBalance).toBeNull();
            expect(card.transactions).toHaveLength(0);
            expect(manager.isFidelityCard(card)).toBe(true);
            expect(alert).toHaveBeenCalledWith('Fidelity card Test Fidelity Card added');
        });

        test('should prevent duplicate card numbers', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'First Card',
                initialBalance: '50'
            };
            manager.addCard();

            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Duplicate Card',
                initialBalance: '100'
            };
            manager.addCard();

            expect(manager.cards).toHaveLength(1);
            expect(manager.cards[0].name).toBe('First Card');
            expect(alert).toHaveBeenLastCalledWith('Card already exists');
        });

        test('should treat 0 balance as fidelity card', () => {
            manager.mockInput = {
                cardNumber: '1111111111',
                cardName: 'Zero Balance Card',
                initialBalance: '0'
            };

            const card = manager.addCard();

            expect(manager.isFidelityCard(card)).toBe(true);
            expect(card.initialBalance).toBeNull();
            expect(card.currentBalance).toBeNull();
        });

        test('should NOT treat fully spent gift card as fidelity card', () => {
            // Reproduce the bug: Carte cadeau Super U with initial balance 100, spent down to 0
            manager.mockInput = {
                cardNumber: 'xxxxxxxxxxx',
                cardName: 'Carte cadeau Super U',
                initialBalance: '100'
            };

            const card = manager.addCard();
            const cardId = card.id;

            // Verify it's initially a gift card
            expect(card.initialBalance).toBe(100);
            expect(card.currentBalance).toBe(100);
            expect(manager.isFidelityCard(card)).toBe(false);

            // Add transactions to spend the full balance (as in the issue)
            manager.mockInput = { transactionAmount: '26.33', transactionDescription: 'Purchase' };
            manager.addTransaction(cardId);

            manager.mockInput = { transactionAmount: '23.73', transactionDescription: 'Purchase' };
            manager.addTransaction(cardId);

            manager.mockInput = { transactionAmount: '9.33', transactionDescription: 'Purchase' };
            manager.addTransaction(cardId);

            manager.mockInput = { transactionAmount: '26.54', transactionDescription: 'Purchase' };
            manager.addTransaction(cardId);

            manager.mockInput = { transactionAmount: '14.07', transactionDescription: 'Purchase' };
            manager.addTransaction(cardId);

            // After all transactions, balance should be 0
            expect(card.currentBalance).toBe(0);

            // A gift card that has been fully spent should still be a gift card, not a fidelity card
            expect(manager.isFidelityCard(card)).toBe(false);
        });

        test('should treat fidelity card with initialBalance=0 and currentBalance=0 as fidelity card', () => {
            // Test for existing fidelity cards that have numeric 0 instead of null
            const fidelityCard = {
                id: '12345',
                number: '9999999999',
                name: 'Old Fidelity Card',
                initialBalance: 0,
                currentBalance: 0,
                transactions: [],
                createdAt: new Date().toISOString(),
                archived: false
            };

            manager.cards.push(fidelityCard);

            expect(manager.isFidelityCard(fidelityCard)).toBe(true);
        });

        test('should keep the detected barcode format when adding a scanned card', () => {
            manager.applyDetectedBarcode('1234567890123', 'ean_13');
            manager.mockInput = {
                cardNumber: document.getElementById('cardNumber').value,
                cardName: 'Scanned Card',
                initialBalance: '40'
            };

            const card = manager.addCard();

            expect(document.getElementById('cardNumber').value).toBe('1234567890123');
            expect(card.barcodeFormat).toBe('EAN13');
            expect(manager.pendingBarcodeFormat).toBeNull();
        });
    });

    describe('barcode import', () => {
        test('should map detected barcode formats to app barcode formats', () => {
            expect(manager.mapDetectedBarcodeFormat('code_128')).toBe('CODE128');
            expect(manager.mapDetectedBarcodeFormat('ean_13')).toBe('EAN13');
            expect(manager.mapDetectedBarcodeFormat('upc_a')).toBe('UPC');
            expect(manager.mapDetectedBarcodeFormat('unknown')).toBe('CODE128');
        });

        test('should import a barcode from an image and prefill the card number', async () => {
            const event = {
                target: {
                    files: [{}],
                    value: 'selected-file'
                }
            };

            manager.loadImageFromFile = jest.fn().mockResolvedValue({ src: 'image' });
            manager.detectBarcodeFromSource = jest.fn().mockResolvedValue({
                rawValue: '3216549870123',
                format: 'ean_13'
            });

            await manager.importBarcodeFromImage(event);

            expect(manager.loadImageFromFile).toHaveBeenCalledWith(event.target.files[0]);
            expect(manager.detectBarcodeFromSource).toHaveBeenCalled();
            expect(document.getElementById('cardNumber').value).toBe('3216549870123');
            expect(manager.pendingBarcodeFormat).toBe('EAN13');
            expect(document.getElementById('barcodeImportStatus').textContent).toBe('Barcode imported. Detected format: EAN13.');
            expect(event.target.value).toBe('');
        });

        test('should show an error when no barcode is found in the selected image', async () => {
            const event = {
                target: {
                    files: [{}],
                    value: 'selected-file'
                }
            };

            manager.loadImageFromFile = jest.fn().mockResolvedValue({ src: 'image' });
            manager.detectBarcodeFromSource = jest.fn().mockResolvedValue(null);

            await manager.importBarcodeFromImage(event);

            expect(alert).toHaveBeenCalledWith('No barcode was found in the selected picture.');
            expect(document.getElementById('barcodeImportStatus').textContent).toBe('No barcode was found in the selected picture.');
            expect(event.target.value).toBe('');
        });
    });

    describe('balance tracking', () => {
        test('should set initial balance correctly', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Balance Test Card',
                initialBalance: '150.50'
            };

            const card = manager.addCard();

            expect(card.initialBalance).toBe(150.50);
            expect(card.currentBalance).toBe(150.50);
            expect(card.transactions[0].balanceAfter).toBe(150.50);
        });

        test('should reduce balance when adding transaction', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Transaction Test',
                initialBalance: '100'
            };

            const card = manager.addCard();
            const cardId = card.id;

            manager.mockInput = {
                transactionAmount: '25.50',
                transactionDescription: 'Coffee'
            };

            const transaction = manager.addTransaction(cardId);

            expect(transaction).toBeDefined();
            expect(transaction.amount).toBe(-25.50);
            expect(transaction.balanceAfter).toBe(74.50);
            expect(card.currentBalance).toBe(74.50);
            expect(card.transactions).toHaveLength(2);
        });

        test('should maintain transaction history', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'History Test',
                initialBalance: '200'
            };

            const card = manager.addCard();
            const cardId = card.id;

            // Add first transaction
            manager.mockInput = {
                transactionAmount: '50',
                transactionDescription: 'Purchase 1'
            };
            manager.addTransaction(cardId);

            // Add second transaction
            manager.mockInput = {
                transactionAmount: '30',
                transactionDescription: 'Purchase 2'
            };
            manager.addTransaction(cardId);

            expect(card.transactions).toHaveLength(3); // initial + 2 purchases
            expect(card.transactions[0].type).toBe('initial');
            expect(card.transactions[1].description).toBe('Purchase 1');
            expect(card.transactions[2].description).toBe('Purchase 2');
            expect(card.currentBalance).toBe(120);
        });

        test('should prevent balance from going negative', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Negative Test',
                initialBalance: '50'
            };

            const card = manager.addCard();
            const cardId = card.id;

            manager.mockInput = {
                transactionAmount: '100',
                transactionDescription: 'Too much'
            };

            manager.addTransaction(cardId);

            expect(card.currentBalance).toBe(50); // Should remain unchanged
            expect(card.transactions).toHaveLength(1); // Only initial transaction
            expect(alert).toHaveBeenCalledWith('Transaction exceeds balance');
        });

        test('should not allow transactions on fidelity cards', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Fidelity Test',
                initialBalance: ''
            };

            const card = manager.addCard();
            const cardId = card.id;

            manager.mockInput = {
                transactionAmount: '10',
                transactionDescription: 'Should fail'
            };

            manager.addTransaction(cardId);

            expect(alert).toHaveBeenCalledWith('Fidelity cards do not support transactions');
            expect(card.transactions).toHaveLength(0);
        });
    });

    describe('exportData', () => {
        test('should export data with correct structure', () => {
            // Add some test cards
            manager.mockInput = {
                cardNumber: '1111111111',
                cardName: 'Card 1',
                initialBalance: '100'
            };
            manager.addCard();

            manager.mockInput = {
                cardNumber: '2222222222',
                cardName: 'Card 2',
                initialBalance: ''
            };
            manager.addCard();

            const exportData = manager.exportData();

            expect(exportData.version).toBe('1.0');
            expect(exportData.exportDate).toBeDefined();
            expect(new Date(exportData.exportDate)).toBeInstanceOf(Date);
            expect(exportData.cards).toHaveLength(2);
            expect(exportData.cards[0].number).toBe('1111111111');
            expect(exportData.cards[1].number).toBe('2222222222');
        });

        test('should export empty cards array when no cards exist', () => {
            const exportData = manager.exportData();

            expect(exportData.version).toBe('1.0');
            expect(exportData.cards).toHaveLength(0);
            expect(Array.isArray(exportData.cards)).toBe(true);
        });
    });

    describe('importData', () => {
        test('should import valid card data', () => {
            const importDataString = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: [
                    {
                        id: '123',
                        number: '1111111111',
                        name: 'Imported Card',
                        initialBalance: 50,
                        currentBalance: 50,
                        transactions: [
                            {
                                date: new Date().toISOString(),
                                amount: 50,
                                type: 'initial',
                                balanceAfter: 50,
                                description: 'Initial balance'
                            }
                        ],
                        createdAt: new Date().toISOString(),
                        archived: false
                    }
                ]
            });

            const result = manager.importData(importDataString);

            expect(result).toBe(true);
            expect(manager.cards).toHaveLength(1);
            expect(manager.cards[0].number).toBe('1111111111');
            expect(manager.cards[0].name).toBe('Imported Card');
            expect(manager.cards[0].currentBalance).toBe(50);
        });

        test('should import fidelity cards correctly', () => {
            const importDataString = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: [
                    {
                        id: '456',
                        number: '9999999999',
                        name: 'Imported Fidelity',
                        initialBalance: null,
                        currentBalance: null,
                        transactions: [],
                        createdAt: new Date().toISOString(),
                        archived: false
                    }
                ]
            });

            const result = manager.importData(importDataString);

            expect(result).toBe(true);
            expect(manager.cards).toHaveLength(1);
            expect(manager.isFidelityCard(manager.cards[0])).toBe(true);
        });

        test('should reject invalid JSON', () => {
            const invalidJson = 'not valid json';

            expect(() => {
                manager.importData(invalidJson);
            }).toThrow();
        });

        test('should reject data without cards array', () => {
            const invalidData = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString()
            });

            expect(() => {
                manager.importData(invalidData);
            }).toThrow('Invalid import data structure');
        });

        test('should reject cards with missing required fields', () => {
            const invalidData = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: [
                    {
                        id: '123',
                        // missing number field
                        name: 'Invalid Card',
                        initialBalance: 50,
                        currentBalance: 50,
                        transactions: []
                    }
                ]
            });

            expect(() => {
                manager.importData(invalidData);
            }).toThrow('Invalid card number');
        });

        test('should reject cards with invalid field types', () => {
            const invalidData = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: [
                    {
                        id: '123',
                        number: '1234567890',
                        name: 'Test Card',
                        initialBalance: 'not a number', // Should be number or null
                        currentBalance: 50,
                        transactions: []
                    }
                ]
            });

            expect(() => {
                manager.importData(invalidData);
            }).toThrow('Invalid initial balance');
        });

        test('should handle archived property for backward compatibility', () => {
            const importDataString = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: [
                    {
                        id: '123',
                        number: '1111111111',
                        name: 'Old Card Without Archived Property',
                        initialBalance: 50,
                        currentBalance: 50,
                        transactions: [],
                        createdAt: new Date().toISOString()
                        // Note: no archived property
                    }
                ]
            });

            const result = manager.importData(importDataString);

            expect(result).toBe(true);
            expect(manager.cards[0].archived).toBe(false);
        });

        test('should replace existing cards on import', () => {
            // Add initial cards
            manager.mockInput = {
                cardNumber: '1111111111',
                cardName: 'Existing Card',
                initialBalance: '100'
            };
            manager.addCard();

            expect(manager.cards).toHaveLength(1);

            // Import new data
            const importDataString = JSON.stringify({
                version: '1.0',
                exportDate: new Date().toISOString(),
                cards: [
                    {
                        id: '789',
                        number: '9999999999',
                        name: 'New Imported Card',
                        initialBalance: 200,
                        currentBalance: 200,
                        transactions: [],
                        createdAt: new Date().toISOString(),
                        archived: false
                    }
                ]
            });

            manager.importData(importDataString);

            expect(manager.cards).toHaveLength(1);
            expect(manager.cards[0].number).toBe('9999999999');
        });
    });

    describe('resetBalance', () => {
        test('should reset balance to initial amount', () => {
            // Add a gift card
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Reset Test Card',
                initialBalance: '100'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Add a transaction to reduce balance
            manager.mockInput = {
                transactionAmount: '30',
                transactionDescription: 'Purchase'
            };
            manager.addTransaction(cardId);

            expect(card.currentBalance).toBe(70);

            // Mock prompt to return initial balance
            global.prompt.mockReturnValue('100');

            // Reset balance
            const resetTransaction = manager.resetBalance(cardId);

            expect(resetTransaction).toBeDefined();
            expect(resetTransaction.type).toBe('reset');
            expect(resetTransaction.amount).toBe(30); // Difference to add back
            expect(resetTransaction.balanceAfter).toBe(100);
            expect(card.currentBalance).toBe(100);
            expect(card.transactions).toHaveLength(3); // initial + spend + reset
            expect(alert).toHaveBeenCalledWith('Balance reset to €100.00');
        });

        test('should reset balance to custom amount', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Custom Reset Test',
                initialBalance: '100'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Spend some money
            manager.mockInput = {
                transactionAmount: '40',
                transactionDescription: 'Purchase'
            };
            manager.addTransaction(cardId);

            expect(card.currentBalance).toBe(60);

            // Mock prompt to return custom amount (75)
            global.prompt.mockReturnValue('75');

            // Reset balance
            const resetTransaction = manager.resetBalance(cardId);

            expect(resetTransaction).toBeDefined();
            expect(resetTransaction.type).toBe('reset');
            expect(resetTransaction.amount).toBe(15); // 75 - 60
            expect(resetTransaction.balanceAfter).toBe(75);
            expect(card.currentBalance).toBe(75);
            expect(card.transactions).toHaveLength(3); // initial + spend + reset
            expect(alert).toHaveBeenCalledWith('Balance reset to €75.00');
        });

        test('should not reset balance when user cancels', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Cancel Reset Test',
                initialBalance: '100'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Add a transaction
            manager.mockInput = {
                transactionAmount: '30',
                transactionDescription: 'Purchase'
            };
            manager.addTransaction(cardId);

            // Mock prompt to return null (user cancelled)
            global.prompt.mockReturnValue(null);

            // Try to reset balance
            const result = manager.resetBalance(cardId);

            expect(result).toBeUndefined();
            expect(card.currentBalance).toBe(70); // Should remain unchanged
            expect(card.transactions).toHaveLength(2); // Only initial + spend
        });

        test('should reject invalid amounts', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Invalid Amount Test',
                initialBalance: '100'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Mock prompt to return invalid value
            global.prompt.mockReturnValue('invalid');

            manager.resetBalance(cardId);

            expect(alert).toHaveBeenCalledWith('Invalid amount. Please enter a valid positive number.');
            expect(card.currentBalance).toBe(100); // Should remain unchanged
            expect(card.transactions).toHaveLength(1); // Only initial
        });

        test('should reject negative amounts', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Negative Amount Test',
                initialBalance: '100'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Mock prompt to return negative value
            global.prompt.mockReturnValue('-50');

            manager.resetBalance(cardId);

            expect(alert).toHaveBeenCalledWith('Invalid amount. Please enter a valid positive number.');
            expect(card.currentBalance).toBe(100); // Should remain unchanged
            expect(card.transactions).toHaveLength(1); // Only initial
        });

        test('should not allow reset on fidelity cards', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Fidelity Test',
                initialBalance: ''
            };
            const card = manager.addCard();
            const cardId = card.id;

            manager.resetBalance(cardId);

            expect(alert).toHaveBeenCalledWith('Fidelity cards do not support transactions');
            expect(card.transactions).toHaveLength(0);
        });

        test('should handle reset when balance is already at initial', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Already Initial Test',
                initialBalance: '100'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Mock prompt to return initial balance
            global.prompt.mockReturnValue('100');

            // Reset balance when it's already at initial
            const resetTransaction = manager.resetBalance(cardId);

            expect(resetTransaction).toBeDefined();
            expect(resetTransaction.amount).toBe(0); // No difference
            expect(resetTransaction.balanceAfter).toBe(100);
            expect(card.currentBalance).toBe(100);
            expect(card.transactions).toHaveLength(2); // initial + reset
        });

        test('should create correct transaction history for reset', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Transaction History Test',
                initialBalance: '150'
            };
            const card = manager.addCard();
            const cardId = card.id;

            // Make several transactions
            manager.mockInput = {
                transactionAmount: '50',
                transactionDescription: 'Purchase 1'
            };
            manager.addTransaction(cardId);

            manager.mockInput = {
                transactionAmount: '25',
                transactionDescription: 'Purchase 2'
            };
            manager.addTransaction(cardId);

            expect(card.currentBalance).toBe(75);

            // Mock prompt to return initial balance
            global.prompt.mockReturnValue('150');

            // Reset balance
            manager.resetBalance(cardId);

            expect(card.currentBalance).toBe(150);
            expect(card.transactions).toHaveLength(4); // initial + 2 purchases + reset
            
            const resetTx = card.transactions[3];
            expect(resetTx.type).toBe('reset');
            expect(resetTx.description).toBe('Balance reset to €150.00');
            expect(resetTx.balanceAfter).toBe(150);
        });
    });

    describe('localStorage persistence', () => {
        test('should save cards to localStorage', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Persistence Test',
                initialBalance: '75'
            };

            manager.addCard();

            const stored = localStorage.getItem('giftCards');
            expect(stored).toBeDefined();
            
            const parsedCards = JSON.parse(stored);
            expect(parsedCards).toHaveLength(1);
            expect(parsedCards[0].name).toBe('Persistence Test');
        });

        test('should load cards from localStorage', () => {
            const testCards = [
                {
                    id: '123',
                    number: '1111111111',
                    name: 'Loaded Card',
                    initialBalance: 100,
                    currentBalance: 100,
                    transactions: [],
                    createdAt: new Date().toISOString(),
                    archived: false
                }
            ];

            localStorage.setItem('giftCards', JSON.stringify(testCards));

            const newManager = new GiftCardManager();
            
            expect(newManager.cards).toHaveLength(1);
            expect(newManager.cards[0].name).toBe('Loaded Card');
        });
    });

    describe('expiry date functionality', () => {
        test('should add a gift card with expiry date', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 60);
            const expiryDateString = futureDate.toISOString().split('T')[0];

            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Test Gift Card with Expiry',
                initialBalance: '100',
                expiryDate: expiryDateString
            };

            const card = manager.addCard();

            expect(card).toBeDefined();
            expect(card.expiryDate).toBe(expiryDateString);
            expect(manager.isCardExpired(card)).toBe(false);
        });

        test('should add a gift card without expiry date', () => {
            manager.mockInput = {
                cardNumber: '1234567890',
                cardName: 'Test Gift Card No Expiry',
                initialBalance: '50',
                expiryDate: ''
            };

            const card = manager.addCard();

            expect(card).toBeDefined();
            expect(card.expiryDate).toBeUndefined();
        });

        test('should not add expiry date to fidelity cards', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 60);
            const expiryDateString = futureDate.toISOString().split('T')[0];

            manager.mockInput = {
                cardNumber: '9876543210',
                cardName: 'Fidelity Card',
                initialBalance: '',
                expiryDate: expiryDateString
            };

            const card = manager.addCard();

            expect(card).toBeDefined();
            expect(manager.isFidelityCard(card)).toBe(true);
            expect(card.expiryDate).toBeUndefined();
        });

        test('should detect expired cards', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expiryDateString = pastDate.toISOString().split('T')[0];

            manager.mockInput = {
                cardNumber: '1111111111',
                cardName: 'Expired Card',
                initialBalance: '75',
                expiryDate: expiryDateString
            };

            const card = manager.addCard();

            expect(manager.isCardExpired(card)).toBe(true);
            expect(manager.isCardExpiringSoon(card)).toBe(false);
        });

        test('should detect cards expiring soon', () => {
            const soonDate = new Date();
            soonDate.setDate(soonDate.getDate() + 15); // 15 days in future
            const expiryDateString = soonDate.toISOString().split('T')[0];

            manager.mockInput = {
                cardNumber: '2222222222',
                cardName: 'Expiring Soon Card',
                initialBalance: '100',
                expiryDate: expiryDateString
            };

            const card = manager.addCard();

            expect(manager.isCardExpired(card)).toBe(false);
            expect(manager.isCardExpiringSoon(card)).toBe(true);
        });

        test('should not flag cards with distant expiry dates', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 100); // 100 days in future
            const expiryDateString = futureDate.toISOString().split('T')[0];

            manager.mockInput = {
                cardNumber: '3333333333',
                cardName: 'Future Expiry Card',
                initialBalance: '200',
                expiryDate: expiryDateString
            };

            const card = manager.addCard();

            expect(manager.isCardExpired(card)).toBe(false);
            expect(manager.isCardExpiringSoon(card)).toBe(false);
        });

        test('should handle cards without expiry date in expiry checks', () => {
            manager.mockInput = {
                cardNumber: '4444444444',
                cardName: 'No Expiry Card',
                initialBalance: '50',
                expiryDate: ''
            };

            const card = manager.addCard();

            expect(manager.isCardExpired(card)).toBe(false);
            expect(manager.isCardExpiringSoon(card)).toBe(false);
        });

        test('should handle fidelity cards in expiry checks', () => {
            manager.mockInput = {
                cardNumber: '5555555555',
                cardName: 'Fidelity Card Check',
                initialBalance: '',
                expiryDate: ''
            };

            const card = manager.addCard();

            expect(manager.isFidelityCard(card)).toBe(true);
            expect(manager.isCardExpired(card)).toBe(false);
            expect(manager.isCardExpiringSoon(card)).toBe(false);
        });
    });

    describe('extractTransactionsFromReceipt', () => {
        test('should extract transaction from Super U receipt format', () => {
            const receiptText = `
                MAGASINS U
                CARTE CADEAU U 15,93 €
                N°: 6363123456789012
                Date: 2024-01-15
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('6363123456789012');
            expect(transactions[0].amount).toBe(15.93);
            expect(transactions[0].description).toContain('U');
        });

        test('should extract transaction with decimal point format', () => {
            const receiptText = `
                Store Receipt
                CARTE CADEAU U 25.50 €
                N°: 1234567890123
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('1234567890123');
            expect(transactions[0].amount).toBe(25.50);
        });

        test('should extract multiple transactions from same receipt', () => {
            const receiptText = `
                Store Receipt
                CARTE CADEAU U 15,00 €
                N°: 1111111111111
                
                CARTE CADEAU U 30,50 €
                N°: 2222222222222
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(2);
            expect(transactions[0].cardNumber).toBe('1111111111111');
            expect(transactions[0].amount).toBe(15.00);
            expect(transactions[1].cardNumber).toBe('2222222222222');
            expect(transactions[1].amount).toBe(30.50);
        });

        test('should handle receipt with no gift card transactions', () => {
            const receiptText = `
                Store Receipt
                Regular Items
                Total: 25.00 €
                Thank you!
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(0);
        });

        test('should handle card number with Card: prefix', () => {
            const receiptText = `
                GIFT CARD 10.00 €
                Card: 9876543210987
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('9876543210987');
            expect(transactions[0].amount).toBe(10.00);
        });

        test('should handle card number with NO: prefix (letter O)', () => {
            const receiptText = `
                CARTE CADEAU U 12,50 €
                NO: 5555555555555
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('5555555555555');
            expect(transactions[0].amount).toBe(12.50);
        });

        test('should ignore transactions without card number', () => {
            const receiptText = `
                CARTE CADEAU U 15.00 €
                No card number here
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(0);
        });

        test('should ignore transactions without amount', () => {
            const receiptText = `
                CARTE CADEAU
                N°: 1234567890123
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(0);
        });

        test('should handle amounts with spaces in them', () => {
            const receiptText = `
                CARTE CADEAU U 1 5,93 €
                N°: 6363123456789012
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('6363123456789012');
            expect(transactions[0].amount).toBe(15.93);
        });

        test('should handle amount on a separate line after card number', () => {
            // Real Super U receipt format: amount appears on its own line after the card number
            const receiptText = `
CARTE CADEAU U
N°: 6363000011112222333

34,43 €
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('6363000011112222333');
            expect(transactions[0].amount).toBe(34.43);
        });

        test('should extract multiple transactions when amounts are grouped after all card entries', () => {
            // Super U receipt format with 2 cards: all card entries listed first, amounts follow in order
            const receiptText = `
CARTE CADEAU U
N°: 6363000011112222333
CARTE CADEAU U
N°: 6363000044445555666

6,17 €
19,20 €
            `;

            const transactions = manager.extractTransactionsFromReceipt(receiptText);

            expect(transactions).toHaveLength(2);
            expect(transactions[0].cardNumber).toBe('6363000011112222333');
            expect(transactions[0].amount).toBe(6.17);
            expect(transactions[1].cardNumber).toBe('6363000044445555666');
            expect(transactions[1].amount).toBe(19.20);
        });
    });

    describe('groupTextItemsIntoLines', () => {
        test('should group PDF.js text items into lines by vertical position', () => {
            // PDF.js text items carry no newline info; items on the same line
            // share the same y-coordinate (transform[5]), while items on
            // different lines have a different y-coordinate.
            const items = [
                { str: 'CARTE', transform: [1, 0, 0, 1, 25, 100] },
                { str: 'CADEAU', transform: [1, 0, 0, 1, 60, 100] },
                { str: 'U', transform: [1, 0, 0, 1, 100, 100] },
                { str: '11,26', transform: [1, 0, 0, 1, 120, 100] },
                { str: '€', transform: [1, 0, 0, 1, 160, 100] },
                { str: 'N°:', transform: [1, 0, 0, 1, 25, 85] },
                { str: '6363357051132315589', transform: [1, 0, 0, 1, 60, 85] },
            ];

            const manager = new GiftCardManager();
            const lines = manager.groupTextItemsIntoLines(items);

            expect(lines).toEqual([
                'CARTE CADEAU U 11,26 €',
                'N°: 6363357051132315589',
            ]);
        });

        test('should extract a transaction from PDF.js items reconstructed as separate lines', () => {
            // Regression test: previously all items on a page were joined with a
            // single space and no newline was inserted between visual lines,
            // collapsing the whole receipt into one line and breaking the
            // "search next lines for the card number" logic in
            // extractTransactionsFromReceipt.
            const items = [
                { str: 'PAIEMENT', transform: [1, 0, 0, 1, 25, 200] },
                { str: '€', transform: [1, 0, 0, 1, 80, 200] },
                { str: 'CARTE', transform: [1, 0, 0, 1, 100, 200] },
                { str: 'U', transform: [1, 0, 0, 1, 140, 200] },
                { str: '0,44', transform: [1, 0, 0, 1, 160, 200] },
                { str: '€', transform: [1, 0, 0, 1, 200, 200] },
                { str: 'CARTE', transform: [1, 0, 0, 1, 25, 185] },
                { str: 'CADEAU', transform: [1, 0, 0, 1, 65, 185] },
                { str: 'U', transform: [1, 0, 0, 1, 110, 185] },
                { str: '11,26', transform: [1, 0, 0, 1, 130, 185] },
                { str: '€', transform: [1, 0, 0, 1, 170, 185] },
                { str: 'N°:', transform: [1, 0, 0, 1, 25, 170] },
                { str: '6363357051132315589', transform: [1, 0, 0, 1, 60, 170] },
                { str: 'CB', transform: [1, 0, 0, 1, 25, 155] },
                { str: 'SANS', transform: [1, 0, 0, 1, 60, 155] },
                { str: 'CONTACT', transform: [1, 0, 0, 1, 100, 155] },
                { str: '17,92', transform: [1, 0, 0, 1, 160, 155] },
                { str: '€', transform: [1, 0, 0, 1, 200, 155] },
            ];

            const manager = new GiftCardManager();
            const text = manager.groupTextItemsIntoLines(items).join('\n');
            const transactions = manager.extractTransactionsFromReceipt(text);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].cardNumber).toBe('6363357051132315589');
            expect(transactions[0].amount).toBe(11.26);
        });
    });

    describe('extractReceiptDate', () => {
        test('should parse the receipt\'s DD/MM/YY HH:MM:SS print timestamp', () => {
            const receiptText = `
Date   Heure   Magasin   Tpv   Util   Tick
05/07/26   11:00:26   24162   005   115   57866
            `;

            const manager = new GiftCardManager();
            const date = manager.extractReceiptDate(receiptText);

            expect(date).not.toBeNull();
            expect(date.getFullYear()).toBe(2026);
            expect(date.getMonth()).toBe(6); // July (0-indexed)
            expect(date.getDate()).toBe(5);
            expect(date.getHours()).toBe(11);
            expect(date.getMinutes()).toBe(0);
            expect(date.getSeconds()).toBe(26);
        });

        test('should return null when no timestamp is found', () => {
            const manager = new GiftCardManager();
            expect(manager.extractReceiptDate('no date here')).toBeNull();
        });
    });

    describe('buildReceiptSummary', () => {
        test('should combine successes, missing cards and per-file issues into one message', () => {
            const manager = new GiftCardManager();
            const summary = manager.buildReceiptSummary([
                { fileName: 'ticket1.pdf', status: 'ok', addedCount: 1, notFoundCards: [] },
                { fileName: 'ticket2.pdf', status: 'ok', addedCount: 1, notFoundCards: ['6363000011112222333'] },
                { fileName: 'ticket3.pdf', status: 'no_transactions' },
                { fileName: 'notes.pdf', status: 'invalid_type' },
                { fileName: 'corrupt.pdf', status: 'error', error: 'Invalid PDF structure' },
            ]);

            expect(summary).toContain('Successfully added 2 transaction(s)');
            expect(summary).toContain('6363000011112222333');
            expect(summary).toContain('ticket3.pdf');
            expect(summary).toContain('notes.pdf');
            expect(summary).toContain('corrupt.pdf');
            expect(summary).toContain('Invalid PDF structure');
        });

        test('should fall back to the generic no-transactions message when nothing to report', () => {
            const manager = new GiftCardManager();
            const summary = manager.buildReceiptSummary([]);

            expect(summary).toBe('No gift card transactions found in the receipt');
        });
    });
});

const { GiftCardManager } = require('./app.js');

describe('GiftCardManager', () => {
  let manager;
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset all mocks
    jest.clearAllMocks();
    // Create a new instance
    manager = new GiftCardManager();
  });

  describe('Adding a new card', () => {
    test('should add a gift card with balance', () => {
      // Mock form inputs for a gift card
      document.getElementById = jest.fn((id) => {
        const values = {
          'cardNumber': { value: '1234567890' },
          'cardName': { value: 'Test Store' },
          'initialBalance': { value: '100.00' }
        };
        return values[id] || { value: '', reset: jest.fn() };
      });
      
      // Mock form reset
      const mockForm = { reset: jest.fn() };
      document.getElementById.mockReturnValueOnce({ value: '1234567890' })
        .mockReturnValueOnce({ value: 'Test Store' })
        .mockReturnValueOnce({ value: '100.00' })
        .mockReturnValueOnce(mockForm);
      
      manager.addCard();
      
      // Verify card was added
      expect(manager.cards.length).toBe(1);
      expect(manager.cards[0].number).toBe('1234567890');
      expect(manager.cards[0].name).toBe('Test Store');
      expect(manager.cards[0].initialBalance).toBe(100);
      expect(manager.cards[0].currentBalance).toBe(100);
      expect(manager.cards[0].archived).toBe(false);
    });

    test('should add a fidelity card without balance', () => {
      document.getElementById = jest.fn((id) => {
        const values = {
          'cardNumber': { value: '9876543210' },
          'cardName': { value: 'Loyalty Card' },
          'initialBalance': { value: '' }
        };
        return values[id] || { value: '', reset: jest.fn() };
      });
      
      const mockForm = { reset: jest.fn() };
      document.getElementById.mockReturnValueOnce({ value: '9876543210' })
        .mockReturnValueOnce({ value: 'Loyalty Card' })
        .mockReturnValueOnce({ value: '' })
        .mockReturnValueOnce(mockForm);
      
      manager.addCard();
      
      // Verify fidelity card was added
      expect(manager.cards.length).toBe(1);
      expect(manager.cards[0].number).toBe('9876543210');
      expect(manager.cards[0].name).toBe('Loyalty Card');
      expect(manager.cards[0].initialBalance).toBeNull();
      expect(manager.cards[0].currentBalance).toBeNull();
      expect(manager.cards[0].transactions).toEqual([]);
    });

    test('should not add duplicate card numbers', () => {
      // Add first card
      document.getElementById = jest.fn((id) => {
        const values = {
          'cardNumber': { value: '1234567890' },
          'cardName': { value: 'Test Store' },
          'initialBalance': { value: '50.00' }
        };
        return values[id] || { value: '', reset: jest.fn() };
      });
      
      const mockForm = { reset: jest.fn() };
      document.getElementById.mockReturnValueOnce({ value: '1234567890' })
        .mockReturnValueOnce({ value: 'Test Store' })
        .mockReturnValueOnce({ value: '50.00' })
        .mockReturnValueOnce(mockForm);
      
      manager.addCard();
      
      // Try to add duplicate
      document.getElementById.mockReturnValueOnce({ value: '1234567890' })
        .mockReturnValueOnce({ value: 'Another Store' })
        .mockReturnValueOnce({ value: '75.00' });
      
      manager.addCard();
      
      // Verify only one card was added
      expect(manager.cards.length).toBe(1);
      expect(alert).toHaveBeenCalledWith('Card already exists');
    });

    test('should add a card with initial transaction for gift cards', () => {
      document.getElementById = jest.fn((id) => {
        const values = {
          'cardNumber': { value: '1111222233' },
          'cardName': { value: 'Gift Card' },
          'initialBalance': { value: '200.00' }
        };
        return values[id] || { value: '', reset: jest.fn() };
      });
      
      const mockForm = { reset: jest.fn() };
      document.getElementById.mockReturnValueOnce({ value: '1111222233' })
        .mockReturnValueOnce({ value: 'Gift Card' })
        .mockReturnValueOnce({ value: '200.00' })
        .mockReturnValueOnce(mockForm);
      
      manager.addCard();
      
      const card = manager.cards[0];
      expect(card.transactions.length).toBe(1);
      expect(card.transactions[0].type).toBe('initial');
      expect(card.transactions[0].amount).toBe(200);
      expect(card.transactions[0].balanceAfter).toBe(200);
    });

    test('should save card to localStorage after adding', () => {
      document.getElementById = jest.fn((id) => {
        const values = {
          'cardNumber': { value: '5555666677' },
          'cardName': { value: 'Store Card' },
          'initialBalance': { value: '150.00' }
        };
        return values[id] || { value: '', reset: jest.fn() };
      });
      
      const mockForm = { reset: jest.fn() };
      document.getElementById.mockReturnValueOnce({ value: '5555666677' })
        .mockReturnValueOnce({ value: 'Store Card' })
        .mockReturnValueOnce({ value: '150.00' })
        .mockReturnValueOnce(mockForm);
      
      manager.addCard();
      
      const saved = JSON.parse(localStorage.getItem('giftCards'));
      expect(saved.length).toBe(1);
      expect(saved[0].number).toBe('5555666677');
    });
  });

  describe('Balance tracking', () => {
    beforeEach(() => {
      // Add a test card with balance
      manager.cards = [{
        id: '12345',
        number: '1234567890',
        name: 'Test Card',
        initialBalance: 100,
        currentBalance: 100,
        transactions: [{
          date: new Date().toISOString(),
          amount: 100,
          type: 'initial',
          balanceAfter: 100,
          description: 'Initial balance'
        }],
        archived: false
      }];
      
      // Mock getElementById to return proper elements
      const originalGetElementById = document.getElementById;
      document.getElementById = jest.fn((id) => {
        if (id === 'cardDetailModal' || id === 'barcodeFormat' || id === 'cardDetailContent' || 
            id === 'barcode' || id === 'transactionForm' || id === 'cardsContainer' || 
            id === 'archivedCardsContainer') {
          return {
            style: { display: 'block' },
            value: 'CODE128',
            innerHTML: '',
            addEventListener: jest.fn()
          };
        }
        return originalGetElementById.call(document, id);
      });
      
      // Mock renderCards to avoid DOM manipulation
      manager.renderCards = jest.fn();
    });

    test('should correctly track balance after transaction', () => {
      document.getElementById = jest.fn((id) => {
        const values = {
          'transactionAmount': { value: '25.50' },
          'transactionDescription': { value: 'Purchase' },
          'cardDetailModal': { style: { display: 'block' } },
          'barcodeFormat': { value: 'CODE128', addEventListener: jest.fn() },
          'cardDetailContent': { innerHTML: '' },
          'barcode': {},
          'transactionForm': { addEventListener: jest.fn() }
        };
        return values[id] || { value: '', style: {} };
      });
      
      manager.addTransaction('12345');
      
      const card = manager.cards[0];
      expect(card.currentBalance).toBe(74.50);
      expect(card.transactions.length).toBe(2);
      expect(card.transactions[1].amount).toBe(-25.50);
      expect(card.transactions[1].balanceAfter).toBe(74.50);
    });

    test('should not allow transaction exceeding balance', () => {
      document.getElementById = jest.fn((id) => {
        const values = {
          'transactionAmount': { value: '150.00' },
          'transactionDescription': { value: 'Large purchase' }
        };
        return values[id] || { value: '' };
      });
      
      manager.addTransaction('12345');
      
      // Balance should remain unchanged
      expect(manager.cards[0].currentBalance).toBe(100);
      expect(alert).toHaveBeenCalledWith('Transaction exceeds balance');
    });

    test('should handle multiple transactions correctly', () => {
      // Mock showCardDetail to avoid DOM issues
      manager.showCardDetail = jest.fn();
      
      // First transaction
      document.getElementById = jest.fn(() => ({ value: '30.00' }))
        .mockReturnValueOnce({ value: '30.00' })
        .mockReturnValueOnce({ value: 'Transaction 1' });
      
      manager.addTransaction('12345');
      expect(manager.cards[0].currentBalance).toBe(70);
      
      // Second transaction
      document.getElementById = jest.fn(() => ({ value: '20.00' }))
        .mockReturnValueOnce({ value: '20.00' })
        .mockReturnValueOnce({ value: 'Transaction 2' });
      
      manager.addTransaction('12345');
      expect(manager.cards[0].currentBalance).toBe(50);
      
      // Verify transaction history
      expect(manager.cards[0].transactions.length).toBe(3); // initial + 2 transactions
    });

    test('should not add transactions to fidelity cards', () => {
      manager.cards = [{
        id: '67890',
        number: '9876543210',
        name: 'Fidelity Card',
        initialBalance: null,
        currentBalance: null,
        transactions: [],
        archived: false
      }];
      
      document.getElementById = jest.fn(() => ({ value: '10.00' }))
        .mockReturnValueOnce({ value: '10.00' })
        .mockReturnValueOnce({ value: 'Should fail' });
      
      manager.addTransaction('67890');
      
      expect(manager.cards[0].transactions.length).toBe(0);
      expect(alert).toHaveBeenCalledWith('Fidelity cards do not support transactions');
    });

    test('should identify fidelity cards correctly', () => {
      const fidelityCard1 = { currentBalance: null };
      const fidelityCard2 = { currentBalance: undefined };
      const fidelityCard3 = { currentBalance: 0 };
      const giftCard = { currentBalance: 50 };
      
      expect(manager.isFidelityCard(fidelityCard1)).toBe(true);
      expect(manager.isFidelityCard(fidelityCard2)).toBe(true);
      expect(manager.isFidelityCard(fidelityCard3)).toBe(true);
      expect(manager.isFidelityCard(giftCard)).toBe(false);
    });
  });

  describe('Import and Export functionality', () => {
    beforeEach(() => {
      // Setup test cards
      manager.cards = [
        {
          id: '1',
          number: '1111111111',
          name: 'Card One',
          initialBalance: 100,
          currentBalance: 80,
          transactions: [
            {
              date: '2024-01-01T12:00:00.000Z',
              amount: 100,
              type: 'initial',
              balanceAfter: 100,
              description: 'Initial balance'
            },
            {
              date: '2024-01-02T12:00:00.000Z',
              amount: -20,
              type: 'spend',
              balanceAfter: 80,
              description: 'Purchase'
            }
          ],
          archived: false,
          barcodeFormat: 'CODE128'
        },
        {
          id: '2',
          number: '2222222222',
          name: 'Card Two',
          initialBalance: null,
          currentBalance: null,
          transactions: [],
          archived: false,
          barcodeFormat: 'CODE128'
        }
      ];
    });

    test('should export data with correct structure', () => {
      // Create a proper mock link element
      const mockLink = document.createElement('a');
      mockLink.click = jest.fn();
      
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement.call(document, tagName);
      });
      
      manager.exportData();
      
      // Verify link was clicked
      expect(mockLink.click).toHaveBeenCalled();
      
      // Verify success alert
      expect(alert).toHaveBeenCalled();
      const alertCall = alert.mock.calls.find(call => 
        call[0] && call[0].includes('Export successful')
      );
      expect(alertCall).toBeDefined();
    });

    test('should import valid data correctly', () => {
      const importData = {
        version: '1.0',
        exportDate: '2024-01-01T12:00:00.000Z',
        cards: [
          {
            id: '100',
            number: '9999999999',
            name: 'Imported Card',
            initialBalance: 50,
            currentBalance: 50,
            transactions: [{
              date: '2024-01-01T12:00:00.000Z',
              amount: 50,
              type: 'initial',
              balanceAfter: 50,
              description: 'Initial balance'
            }],
            archived: false
          }
        ]
      };
      
      const mockFile = {
        content: JSON.stringify(importData)
      };
      
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'test.json'
        }
      };
      
      // Mock confirm to return true
      global.confirm = jest.fn(() => true);
      
      manager.importData(mockEvent);
      
      // Wait for FileReader to process
      setTimeout(() => {
        expect(manager.cards.length).toBe(1);
        expect(manager.cards[0].number).toBe('9999999999');
        expect(manager.cards[0].name).toBe('Imported Card');
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('Import successful'));
      }, 10);
    });

    test('should reject import with invalid data structure', () => {
      const invalidData = {
        version: '1.0',
        // Missing cards array
      };
      
      const mockFile = {
        content: JSON.stringify(invalidData)
      };
      
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'test.json'
        }
      };
      
      manager.importData(mockEvent);
      
      setTimeout(() => {
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('Import failed'));
      }, 10);
    });

    test('should reject import with missing required card fields', () => {
      const invalidData = {
        version: '1.0',
        cards: [
          {
            id: '100',
            // Missing number and name
            initialBalance: 50,
            currentBalance: 50,
            transactions: []
          }
        ]
      };
      
      const mockFile = {
        content: JSON.stringify(invalidData)
      };
      
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'test.json'
        }
      };
      
      manager.importData(mockEvent);
      
      setTimeout(() => {
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('Import failed'));
      }, 10);
    });

    test('should handle backward compatibility with archived field', () => {
      const importData = {
        version: '1.0',
        cards: [
          {
            id: '200',
            number: '8888888888',
            name: 'Old Card Without Archived',
            initialBalance: 25,
            currentBalance: 25,
            transactions: []
            // archived field is missing (old data)
          }
        ]
      };
      
      const mockFile = {
        content: JSON.stringify(importData)
      };
      
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'test.json'
        }
      };
      
      global.confirm = jest.fn(() => true);
      
      manager.importData(mockEvent);
      
      setTimeout(() => {
        expect(manager.cards[0].archived).toBe(false); // Should default to false
      }, 10);
    });

    test('should ask for confirmation before importing', () => {
      const importData = {
        version: '1.0',
        cards: [
          {
            id: '300',
            number: '7777777777',
            name: 'Test Import',
            initialBalance: 30,
            currentBalance: 30,
            transactions: []
          }
        ]
      };
      
      const mockFile = {
        content: JSON.stringify(importData)
      };
      
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'test.json'
        }
      };
      
      // Mock confirm to return false (user cancels)
      global.confirm = jest.fn(() => false);
      
      const originalCards = [...manager.cards];
      manager.importData(mockEvent);
      
      setTimeout(() => {
        // Cards should not change if user cancels
        expect(manager.cards).toEqual(originalCards);
      }, 10);
    });
  });

  describe('LocalStorage integration', () => {
    test('should load cards from localStorage on initialization', () => {
      const testCards = [
        {
          id: '123',
          number: '1234567890',
          name: 'Stored Card',
          initialBalance: 100,
          currentBalance: 100,
          transactions: [],
          archived: false
        }
      ];
      
      localStorage.setItem('giftCards', JSON.stringify(testCards));
      
      const newManager = new GiftCardManager();
      expect(newManager.cards.length).toBe(1);
      expect(newManager.cards[0].name).toBe('Stored Card');
    });

    test('should save cards to localStorage when modified', () => {
      document.getElementById = jest.fn((id) => {
        const values = {
          'cardNumber': { value: '1111222233' },
          'cardName': { value: 'New Card' },
          'initialBalance': { value: '75.00' }
        };
        return values[id] || { value: '', reset: jest.fn() };
      });
      
      const mockForm = { reset: jest.fn() };
      document.getElementById.mockReturnValueOnce({ value: '1111222233' })
        .mockReturnValueOnce({ value: 'New Card' })
        .mockReturnValueOnce({ value: '75.00' })
        .mockReturnValueOnce(mockForm);
      
      manager.addCard();
      
      const saved = JSON.parse(localStorage.getItem('giftCards'));
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe('New Card');
    });

    test('should return empty array if localStorage is empty', () => {
      const newManager = new GiftCardManager();
      expect(newManager.cards).toEqual([]);
    });
  });

  describe('Card management', () => {
    beforeEach(() => {
      manager.cards = [
        {
          id: '1',
          number: '1111111111',
          name: 'Card One',
          initialBalance: 100,
          currentBalance: 100,
          transactions: [],
          archived: false
        }
      ];
      
      // Mock closeModal to avoid DOM issues
      manager.closeModal = jest.fn();
      manager.renderCards = jest.fn();
      manager.updateArchivedViewIfVisible = jest.fn();
    });

    test('should archive a card', () => {
      manager.archiveCard('1');
      expect(manager.cards[0].archived).toBe(true);
      expect(manager.closeModal).toHaveBeenCalled();
    });

    test('should unarchive a card', () => {
      manager.cards[0].archived = true;
      manager.unarchiveCard('1');
      expect(manager.cards[0].archived).toBe(false);
      expect(manager.closeModal).toHaveBeenCalled();
    });

    test('should delete a card when confirmed', () => {
      global.confirm = jest.fn(() => true);
      manager.deleteCard('1');
      expect(manager.cards.length).toBe(0);
      expect(manager.closeModal).toHaveBeenCalled();
    });

    test('should not delete a card when cancelled', () => {
      global.confirm = jest.fn(() => false);
      manager.deleteCard('1');
      expect(manager.cards.length).toBe(1);
    });
  });
});

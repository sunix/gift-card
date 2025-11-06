// Mock localStorage
const localStorageMock = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

global.localStorage = localStorageMock;

// Mock fetch for loading stores
global.fetch = jest.fn();

// Mock alert
global.alert = jest.fn();

// Mock confirm
global.confirm = jest.fn(() => true);

// Mock Blob and URL.createObjectURL for export functionality
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
};

if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
}

if (!global.URL.revokeObjectURL) {
  global.URL.revokeObjectURL = jest.fn();
}

// Mock FileReader for import functionality
global.FileReader = class FileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }
  
  readAsText(file) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: file.content } });
      }
    }, 0);
  }
};

// Mock renderBarcode function from barcode.js
global.renderBarcode = jest.fn();

// Mock i18n
global.i18n = {
  t: jest.fn((key, params) => {
    // Simple mock translation
    const translations = {
      'alert.card_exists': 'Card already exists',
      'alert.fidelity_added': 'Fidelity card added',
      'alert.gift_card_added': 'Gift card added',
      'alert.delete_confirm': 'Are you sure?',
      'alert.export_success': 'Export successful',
      'alert.export_failed': 'Export failed',
      'alert.import_invalid': 'Invalid import data',
      'alert.import_invalid_id': 'Invalid card ID',
      'alert.import_invalid_number': 'Invalid card number',
      'alert.import_invalid_name': 'Invalid card name',
      'alert.import_invalid_transactions': 'Invalid transactions',
      'alert.import_invalid_balance': 'Invalid balance',
      'alert.import_invalid_current': 'Invalid current balance',
      'alert.import_confirm': 'Import confirmation',
      'alert.import_success': 'Import successful',
      'alert.import_failed': 'Import failed',
      'alert.import_read_failed': 'Failed to read file',
      'alert.transaction_exceeds': 'Transaction exceeds balance',
      'alert.fidelity_no_transactions': 'Fidelity cards do not support transactions',
      'cards.empty': 'No cards',
      'cards.empty_link': 'Add one',
      'cards.view_archived': 'View archived cards',
      'card.fidelity_badge': 'Fidelity Card',
      'card.type': 'Type',
      'card.current_balance': 'Current Balance',
      'card.initial_balance': 'Initial Balance',
      'form.card_number': 'Card Number',
      'card.barcode_type': 'Barcode Type',
      'card.add_transaction': 'Add Transaction',
      'card.amount_spent': 'Amount Spent',
      'card.amount_placeholder': 'Enter amount',
      'card.description': 'Description',
      'card.description_placeholder': 'Optional',
      'card.record_button': 'Record Transaction',
      'card.transaction_history': 'Transaction History',
      'card.no_transactions': 'No transactions',
      'card.archive_button': 'Archive',
      'card.unarchive_button': 'Unarchive',
      'card.delete_button': 'Delete',
      'transaction.initial_balance': 'Initial balance',
      'transaction.spent': 'Spent',
      'transaction.balance_after': 'Balance after',
      'archived.empty': 'No archived cards'
    };
    
    let result = translations[key] || key;
    if (params) {
      Object.keys(params).forEach(param => {
        result = result.replace(`{${param}}`, params[param]);
      });
    }
    return result;
  }),
  getCurrentLanguage: jest.fn(() => 'en')
};

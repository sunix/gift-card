# Gift Card Manager - Unit Tests

This directory contains unit tests for the Gift Card Manager application.

## Running Tests

### Prerequisites
Make sure you have Node.js and npm installed on your system.

### Installation
Install the test dependencies:
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
Tests are automatically configured to collect coverage information. The coverage report will be displayed in the terminal after running tests.

To view detailed HTML coverage report:
```bash
npm test
# Then open coverage/lcov-report/index.html in your browser
```

## Test Coverage

The test suite covers the following functionality:

### 1. Import/Export Functionality (`exportData` and `importData`)
- ✅ Exports data with correct JSON structure and metadata
- ✅ Exports empty cards array when no cards exist
- ✅ Imports valid card data correctly
- ✅ Imports fidelity cards (cards without balance)
- ✅ Validates imported data structure
- ✅ Rejects invalid JSON
- ✅ Rejects data without cards array
- ✅ Rejects cards with missing required fields
- ✅ Rejects cards with invalid field types
- ✅ Handles backward compatibility for archived property
- ✅ Replaces existing cards on import

### 2. Adding a New Card (`addCard`)
- ✅ Adds gift card with balance
- ✅ Adds fidelity card without balance
- ✅ Prevents duplicate card numbers
- ✅ Treats 0 balance as fidelity card

### 3. Balance Tracking (`addTransaction`)
- ✅ Sets initial balance correctly
- ✅ Reduces balance when adding transaction
- ✅ Maintains transaction history
- ✅ Prevents balance from going negative
- ✅ Prevents transactions on fidelity cards

### 4. Data Persistence
- ✅ Saves cards to localStorage
- ✅ Loads cards from localStorage

## Test Files

- `app.test.js` - Main test suite for GiftCardManager class

## Test Framework

- **Jest** - JavaScript testing framework
- **jsdom** - DOM implementation for testing browser-based code
- **jest-environment-jsdom** - Jest environment for browser-like testing

## Coverage Thresholds

The test suite includes comprehensive coverage of core functionality:
- Import/Export operations
- Card management (add, validate, persist)
- Balance tracking and transactions
- Data validation and error handling

## Notes

- Tests use mocked localStorage to avoid browser dependencies
- Tests use mocked i18n (internationalization) for translation functions
- All tests are isolated and can run independently
- Coverage reports are generated in the `coverage/` directory (gitignored)

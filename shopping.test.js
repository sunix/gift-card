// shopping.test.js - Unit tests for ShoppingListManager

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key) => { delete store[key]; }
    };
})();

// Mock i18n
const i18nMock = {
    t: (key, params) => {
        const translations = {
            'shopping.status_draft': 'Draft',
            'shopping.status_inProgress': 'In Progress',
            'shopping.status_completed': 'Completed',
            'shopping.confirm_delete_list': 'Delete list {name}?',
            'shopping.confirm_remove_item': 'Remove item?',
            'shopping.payment_confirmed': 'Payment confirmed',
            'shopping.card_not_found': '(card not found)',
            'shopping.no_cards_associated': 'No cards associated.',
            'shopping.no_items': 'No items yet.',
            'shopping.no_active_lists': 'No active lists.',
            'shopping.items_summary': '{checked}/{total} items',
            'shopping.list_not_found': 'List not found.',
            'shopping.back_to_lists': 'Back to lists',
            'shopping.edit_info': 'Edit Info',
            'shopping.checkout_mode': 'Checkout',
            'shopping.items_done': 'Items done:',
            'shopping.estimated_total': 'Estimated total:',
            'shopping.gift_card_coverage': 'Gift card coverage:',
            'shopping.remaining_to_pay': 'Remaining to pay:',
            'shopping.items': 'Items',
            'shopping.add_item': 'Add Item',
            'shopping.mark_found': 'Mark as found',
            'shopping.mark_not_found': 'Mark as not found',
            'shopping.edit_item': 'Edit item',
            'shopping.remove_item': 'Remove item',
            'shopping.add_item_title': 'Add Item',
            'shopping.edit_item_title': 'Edit Item',
            'shopping.item_name': 'Product Name:',
            'shopping.item_note': 'Note:',
            'shopping.item_barcode': 'Barcode:',
            'shopping.pricing_mode': 'Pricing:',
            'shopping.pricing_unit': 'Unit price',
            'shopping.pricing_weight': 'Price by weight',
            'shopping.unit_price': 'Unit Price:',
            'shopping.quantity': 'Quantity:',
            'shopping.price_per_kg': 'Price per kg:',
            'shopping.weight_kg': 'Weight (kg):',
            'shopping.save_item': 'Save',
            'shopping.cancel': 'Cancel',
            'shopping.save': 'Save',
            'shopping.associated_cards': 'Associated Cards',
            'shopping.gift_cards': 'Gift Cards',
            'shopping.loyalty_cards': 'Loyalty Cards',
            'shopping.add_gift_card': '+ Gift Card',
            'shopping.add_loyalty_card': '+ Loyalty Card',
            'shopping.select_gift_card': 'Select Gift Card',
            'shopping.select_loyalty_card': 'Select Loyalty Card',
            'shopping.no_cards_available': 'No cards available.',
            'shopping.move_up': 'Move up',
            'shopping.move_down': 'Move down',
            'shopping.remove_card': 'Remove',
            'shopping.gift_card_allocation': 'Gift Card Allocation',
            'shopping.balance': 'Balance',
            'shopping.suggested_use': 'Suggested use',
            'shopping.remaining_balance': 'Remaining',
            'shopping.cards_for_checkout': 'Cards',
            'shopping.prev_card': 'Previous card',
            'shopping.next_card': 'Next card',
            'shopping.show_barcode': 'Show barcode for {name}',
            'shopping.show_barcode_btn': 'Show Barcode',
            'shopping.barcode_for': 'Barcode for {name}',
            'shopping.confirm_payment': 'Confirm Payment',
            'shopping.close': 'Close',
            'shopping.gift_card_label': 'Gift Card',
            'shopping.confirm_payment_title': 'Confirm Payment',
            'shopping.final_total': 'Final Total:',
            'shopping.payment_breakdown': 'Payment Breakdown',
            'shopping.confirm_and_update': 'Confirm & Update',
            'form.barcode_camera_unsupported': 'Camera not supported.',
            'form.barcode_camera_ready': 'Point camera at barcode.',
            'form.barcode_image_processing': 'Reading barcode...',
            'form.barcode_import_success': 'Barcode imported. Format: {format}.',
            'form.barcode_scan_cancel': 'Cancel Scan',
            'alert.barcode_camera_failed': 'Camera failed.',
            'alert.barcode_not_found': 'No barcode found.',
            'card.fidelity_badge': 'Fidelity Card',
            'card.current_balance': 'Current Balance:',
            'shopping.product_lookup_loading': 'Looking up product info...',
            'shopping.product_lookup_found': 'Product found: {name}',
            'shopping.product_lookup_not_found': 'Product not found.',
            'shopping.price_suggestion': 'Last known price at {store}: €{price} ({date})',
            'shopping.use_suggested_price': 'Use this price'
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
global.window = global.window || {};

// Import ShoppingListManager
const { ShoppingListManager } = require('./shopping.js');

// Mock card manager
function makeMockCardManager(cards) {
    return {
        cards: cards || [],
        isFidelityCard: (card) => {
            return (card.initialBalance === null || card.initialBalance === undefined || card.initialBalance === 0) &&
                   (card.currentBalance === null || card.currentBalance === undefined || card.currentBalance === 0);
        },
        saveCards: jest.fn()
    };
}

describe('ShoppingListManager', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        global.alert.mockClear();
        global.confirm.mockClear();
        manager = new ShoppingListManager(makeMockCardManager());
    });

    // =====================
    // Money utilities
    // =====================
    describe('money utilities', () => {
        test('eurToCents converts euros to cents correctly', () => {
            expect(manager.eurToCents(1.99)).toBe(199);
            expect(manager.eurToCents(0.01)).toBe(1);
            expect(manager.eurToCents(100)).toBe(10000);
            expect(manager.eurToCents(0)).toBe(0);
            expect(manager.eurToCents(null)).toBeNull();
            expect(manager.eurToCents('')).toBeNull();
            expect(manager.eurToCents(undefined)).toBeNull();
        });

        test('eurToCents handles floating-point edge cases', () => {
            // 0.1 + 0.2 = 0.30000000000000004 in JS, should round to 30 cents
            expect(manager.eurToCents(0.1 + 0.2)).toBe(30);
            expect(manager.eurToCents(2.99)).toBe(299);
            expect(manager.eurToCents(72.50)).toBe(7250);
        });

        test('centsToEur converts cents to euros', () => {
            expect(manager.centsToEur(199)).toBe(1.99);
            expect(manager.centsToEur(10000)).toBe(100);
            expect(manager.centsToEur(0)).toBe(0);
            expect(manager.centsToEur(null)).toBeNull();
        });

        test('formatCents formats cents as currency string', () => {
            expect(manager.formatCents(199)).toBe('€1.99');
            expect(manager.formatCents(7250)).toBe('€72.50');
            expect(manager.formatCents(0)).toBe('€0.00');
            expect(manager.formatCents(null)).toBe('—');
            expect(manager.formatCents(undefined)).toBe('—');
        });
    });

    // =====================
    // List CRUD
    // =====================
    describe('list CRUD', () => {
        test('createList creates a new list with correct defaults', () => {
            const list = manager.createList('Weekly groceries', 'Super U', '2026-07-25');

            expect(list).toBeDefined();
            expect(list.id).toBeTruthy();
            expect(list.name).toBe('Weekly groceries');
            expect(list.store).toBe('Super U');
            expect(list.plannedDate).toBe('2026-07-25');
            expect(list.status).toBe('draft');
            expect(list.items).toEqual([]);
            expect(list.giftCardIds).toEqual([]);
            expect(list.loyaltyCardIds).toEqual([]);
            expect(list.estimatedTotalCents).toBe(0);
            expect(list.finalTotalCents).toBeNull();
            expect(list.payments).toEqual([]);
            expect(list.createdAt).toBeTruthy();
            expect(list.updatedAt).toBeTruthy();
            expect(manager.shoppingLists).toHaveLength(1);
        });

        test('createList persists to localStorage', () => {
            manager.createList('My list', '', null);
            const stored = JSON.parse(localStorage.getItem('shoppingLists'));
            expect(stored).toHaveLength(1);
            expect(stored[0].name).toBe('My list');
        });

        test('getList returns list by id', () => {
            const list = manager.createList('Test', '', null);
            const found = manager.getList(list.id);
            expect(found).toBeDefined();
            expect(found.id).toBe(list.id);
        });

        test('getList returns null for unknown id', () => {
            expect(manager.getList('nonexistent')).toBeNull();
        });

        test('updateList updates list properties', () => {
            const list = manager.createList('Original', '', null);
            manager.updateList(list.id, { name: 'Updated', store: 'Carrefour', status: 'inProgress' });
            const updated = manager.getList(list.id);
            expect(updated.name).toBe('Updated');
            expect(updated.store).toBe('Carrefour');
            expect(updated.status).toBe('inProgress');
        });

        test('deleteList removes list', () => {
            const list = manager.createList('To delete', '', null);
            expect(manager.shoppingLists).toHaveLength(1);
            const result = manager.deleteList(list.id);
            expect(result).toBe(true);
            expect(manager.shoppingLists).toHaveLength(0);
        });

        test('deleteList returns false for nonexistent id', () => {
            expect(manager.deleteList('nonexistent')).toBe(false);
        });
    });

    // =====================
    // Item CRUD
    // =====================
    describe('item CRUD', () => {
        let list;

        beforeEach(() => {
            list = manager.createList('Test List', '', null);
        });

        test('addItem adds a new item with defaults', () => {
            const item = manager.addItem(list.id, 'Tomatoes', 'Red ones');

            expect(item).toBeDefined();
            expect(item.id).toBeTruthy();
            expect(item.name).toBe('Tomatoes');
            expect(item.note).toBe('Red ones');
            expect(item.checked).toBe(false);
            expect(item.barcode).toBeNull();
            expect(item.pricingMode).toBe('unit');
            expect(item.unitPriceCents).toBeNull();
            expect(item.quantity).toBe(1);
            expect(item.pricePerKgCents).toBeNull();
            expect(item.weightKg).toBeNull();
            expect(item.totalCents).toBe(0);
        });

        test('addItem increases list item count', () => {
            manager.addItem(list.id, 'Item 1', '');
            manager.addItem(list.id, 'Item 2', '');
            manager.addItem(list.id, 'Item 3', '');
            expect(manager.getList(list.id).items).toHaveLength(3);
        });

        test('addItem persists to localStorage', () => {
            manager.addItem(list.id, 'Milk', '');
            const stored = JSON.parse(localStorage.getItem('shoppingLists'));
            expect(stored[0].items).toHaveLength(1);
            expect(stored[0].items[0].name).toBe('Milk');
        });

        test('updateItem updates item properties', () => {
            const item = manager.addItem(list.id, 'Apples', '');
            manager.updateItem(list.id, item.id, { unitPriceCents: 199, quantity: 3 });
            const updated = manager.getList(list.id).items[0];
            expect(updated.unitPriceCents).toBe(199);
            expect(updated.quantity).toBe(3);
        });

        test('removeItem removes item from list', () => {
            const item = manager.addItem(list.id, 'Bread', '');
            manager.addItem(list.id, 'Butter', '');
            manager.removeItem(list.id, item.id);
            expect(manager.getList(list.id).items).toHaveLength(1);
            expect(manager.getList(list.id).items[0].name).toBe('Butter');
        });

        test('removeItem returns false for nonexistent item', () => {
            expect(manager.removeItem(list.id, 'nonexistent')).toBe(false);
        });

        test('checkItem marks item as found', () => {
            const item = manager.addItem(list.id, 'Cheese', '');
            manager.checkItem(list.id, item.id, true);
            expect(manager.getList(list.id).items[0].checked).toBe(true);
        });

        test('checkItem unmarks found item', () => {
            const item = manager.addItem(list.id, 'Cheese', '');
            manager.checkItem(list.id, item.id, true);
            manager.checkItem(list.id, item.id, false);
            expect(manager.getList(list.id).items[0].checked).toBe(false);
        });

        test('reorderItems moves items correctly', () => {
            manager.addItem(list.id, 'A', '');
            manager.addItem(list.id, 'B', '');
            manager.addItem(list.id, 'C', '');
            manager.reorderItems(list.id, 0, 2);
            const items = manager.getList(list.id).items;
            expect(items[0].name).toBe('B');
            expect(items[1].name).toBe('C');
            expect(items[2].name).toBe('A');
        });
    });

    // =====================
    // Calculations
    // =====================
    describe('item total calculations', () => {
        test('unit pricing: lineTotal = unitPriceCents * quantity', () => {
            const item = {
                pricingMode: 'unit',
                unitPriceCents: 299,
                quantity: 3,
                pricePerKgCents: null,
                weightKg: null
            };
            expect(manager.calculateItemTotalCents(item)).toBe(897);
        });

        test('unit pricing: quantity defaults to 1', () => {
            const item = {
                pricingMode: 'unit',
                unitPriceCents: 199,
                quantity: null,
                pricePerKgCents: null,
                weightKg: null
            };
            expect(manager.calculateItemTotalCents(item)).toBe(199);
        });

        test('unit pricing: returns 0 when no price set', () => {
            const item = {
                pricingMode: 'unit',
                unitPriceCents: null,
                quantity: 2,
                pricePerKgCents: null,
                weightKg: null
            };
            expect(manager.calculateItemTotalCents(item)).toBe(0);
        });

        test('weight pricing: lineTotal = pricePerKgCents * weightKg', () => {
            const item = {
                pricingMode: 'weight',
                unitPriceCents: null,
                quantity: null,
                pricePerKgCents: 299,
                weightKg: 0.65
            };
            expect(manager.calculateItemTotalCents(item)).toBe(194); // 299 * 0.65 = 194.35 → 194
        });

        test('weight pricing: returns 0 when values missing', () => {
            const item = {
                pricingMode: 'weight',
                unitPriceCents: null,
                quantity: null,
                pricePerKgCents: 299,
                weightKg: null
            };
            expect(manager.calculateItemTotalCents(item)).toBe(0);
        });

        test('weight pricing: avoids floating-point errors', () => {
            // 299 * 0.65 = 194.35 in float, should round to 194 cents
            const item = {
                pricingMode: 'weight',
                unitPriceCents: 299,
                quantity: null,
                pricePerKgCents: 299,
                weightKg: 0.65
            };
            const result = manager.calculateItemTotalCents(item);
            expect(Number.isInteger(result)).toBe(true);
        });
    });

    describe('list total calculation', () => {
        test('calculateListTotalCents sums item totals', () => {
            const list = manager.createList('Test', '', null);
            const item1 = manager.addItem(list.id, 'A', '');
            const item2 = manager.addItem(list.id, 'B', '');
            manager.updateItem(list.id, item1.id, { unitPriceCents: 100, quantity: 2 }); // 200
            manager.updateItem(list.id, item2.id, { unitPriceCents: 50, quantity: 3 });  // 150
            expect(manager.getList(list.id).estimatedTotalCents).toBe(350);
        });

        test('list total updates when item is removed', () => {
            const list = manager.createList('Test', '', null);
            const item1 = manager.addItem(list.id, 'A', '');
            const item2 = manager.addItem(list.id, 'B', '');
            manager.updateItem(list.id, item1.id, { unitPriceCents: 100, quantity: 1 });
            manager.updateItem(list.id, item2.id, { unitPriceCents: 50, quantity: 1 });
            expect(manager.getList(list.id).estimatedTotalCents).toBe(150);
            manager.removeItem(list.id, item1.id);
            expect(manager.getList(list.id).estimatedTotalCents).toBe(50);
        });

        test('list total is 0 for empty list', () => {
            const list = manager.createList('Empty', '', null);
            expect(list.estimatedTotalCents).toBe(0);
        });
    });

    // =====================
    // Card Associations
    // =====================
    describe('card associations', () => {
        let list;

        beforeEach(() => {
            list = manager.createList('Test', '', null);
        });

        test('addGiftCard adds card id to giftCardIds', () => {
            manager.addGiftCard(list.id, 'card-1');
            expect(manager.getList(list.id).giftCardIds).toContain('card-1');
        });

        test('addGiftCard prevents duplicates', () => {
            manager.addGiftCard(list.id, 'card-1');
            manager.addGiftCard(list.id, 'card-1');
            expect(manager.getList(list.id).giftCardIds).toHaveLength(1);
        });

        test('removeGiftCard removes card id', () => {
            manager.addGiftCard(list.id, 'card-1');
            manager.removeGiftCard(list.id, 'card-1');
            expect(manager.getList(list.id).giftCardIds).not.toContain('card-1');
        });

        test('addLoyaltyCard adds card id to loyaltyCardIds', () => {
            manager.addLoyaltyCard(list.id, 'loyalty-1');
            expect(manager.getList(list.id).loyaltyCardIds).toContain('loyalty-1');
        });

        test('removeLoyaltyCard removes loyalty card id', () => {
            manager.addLoyaltyCard(list.id, 'loyalty-1');
            manager.removeLoyaltyCard(list.id, 'loyalty-1');
            expect(manager.getList(list.id).loyaltyCardIds).not.toContain('loyalty-1');
        });

        test('reorderGiftCards reorders gift cards', () => {
            manager.addGiftCard(list.id, 'card-a');
            manager.addGiftCard(list.id, 'card-b');
            manager.addGiftCard(list.id, 'card-c');
            manager.reorderGiftCards(list.id, 0, 2);
            expect(manager.getList(list.id).giftCardIds[0]).toBe('card-b');
            expect(manager.getList(list.id).giftCardIds[2]).toBe('card-a');
        });

        test('reorderGiftCards ignores invalid indices', () => {
            manager.addGiftCard(list.id, 'card-a');
            manager.addGiftCard(list.id, 'card-b');
            const before = [...manager.getList(list.id).giftCardIds];
            manager.reorderGiftCards(list.id, -1, 1); // invalid
            manager.reorderGiftCards(list.id, 0, 5);  // invalid
            expect(manager.getList(list.id).giftCardIds).toEqual(before);
        });
    });

    // =====================
    // Checkout Calculations
    // =====================
    describe('checkout calculations', () => {
        test('getCardBalanceCents returns balance in cents', () => {
            const cardManager = makeMockCardManager([
                { id: 'gc1', name: 'Card A', initialBalance: 30, currentBalance: 30 }
            ]);
            const m = new ShoppingListManager(cardManager);
            expect(m.getCardBalanceCents('gc1')).toBe(3000);
        });

        test('getCardBalanceCents returns 0 for fidelity card', () => {
            const cardManager = makeMockCardManager([
                { id: 'lc1', name: 'Loyalty', initialBalance: null, currentBalance: null }
            ]);
            const m = new ShoppingListManager(cardManager);
            expect(m.getCardBalanceCents('lc1')).toBe(0);
        });

        test('getCardBalanceCents returns 0 for unknown card', () => {
            expect(manager.getCardBalanceCents('unknown')).toBe(0);
        });

        test('calculateGiftCardAllocation allocates correctly when total < balance', () => {
            // Shopping total: €72.50, Gift Card A: €30, Gift Card B: €50
            const cardManager = makeMockCardManager([
                { id: 'gc1', name: 'Card A', initialBalance: 30, currentBalance: 30 },
                { id: 'gc2', name: 'Card B', initialBalance: 50, currentBalance: 50 }
            ]);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);
            m.addGiftCard(list.id, 'gc1');
            m.addGiftCard(list.id, 'gc2');

            const allocation = m.calculateGiftCardAllocation(list.id, 7250); // €72.50

            expect(allocation).toHaveLength(2);
            expect(allocation[0].cardId).toBe('gc1');
            expect(allocation[0].suggestedUsageCents).toBe(3000); // €30.00 fully used
            expect(allocation[0].unusedBalanceCents).toBe(0);
            expect(allocation[1].cardId).toBe('gc2');
            expect(allocation[1].suggestedUsageCents).toBe(4250); // €42.50 used
            expect(allocation[1].unusedBalanceCents).toBe(750); // €7.50 remaining
        });

        test('calculateGiftCardAllocation allocates correctly when total > total balance', () => {
            const cardManager = makeMockCardManager([
                { id: 'gc1', name: 'Card A', initialBalance: 20, currentBalance: 20 }
            ]);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);
            m.addGiftCard(list.id, 'gc1');

            const allocation = m.calculateGiftCardAllocation(list.id, 5000); // €50 total

            expect(allocation[0].suggestedUsageCents).toBe(2000); // only €20 available
            expect(allocation[0].unusedBalanceCents).toBe(0);
        });

        test('calculateCheckoutSummary computes all fields', () => {
            const cardManager = makeMockCardManager([
                { id: 'gc1', name: 'Card A', initialBalance: 50, currentBalance: 50 }
            ]);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);
            m.addGiftCard(list.id, 'gc1');
            const item = m.addItem(list.id, 'Bread', '');
            m.updateItem(list.id, item.id, { unitPriceCents: 200, quantity: 1 }); // €2.00

            const summary = m.calculateCheckoutSummary(list.id);

            expect(summary.shoppingTotalCents).toBe(200);
            expect(summary.totalGiftCardBalanceCents).toBe(5000);
            expect(summary.giftCardCoverageCents).toBe(200); // min(200, 5000)
            expect(summary.remainingToPayCents).toBe(0);
            expect(summary.unusedGiftCardBalanceCents).toBe(4800);
            expect(summary.totalItems).toBe(1);
            expect(summary.checkedItems).toBe(0);
            expect(summary.remainingItems).toBe(1);
        });

        test('calculateCheckoutSummary: loyalty cards do not contribute to balance', () => {
            const cardManager = makeMockCardManager([
                { id: 'lc1', name: 'Loyalty', initialBalance: null, currentBalance: null }
            ]);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);
            m.addLoyaltyCard(list.id, 'lc1');
            const item = m.addItem(list.id, 'A', '');
            m.updateItem(list.id, item.id, { unitPriceCents: 1000, quantity: 1 });

            const summary = m.calculateCheckoutSummary(list.id);

            expect(summary.totalGiftCardBalanceCents).toBe(0); // loyalty card excluded
            expect(summary.remainingToPayCents).toBe(1000);
        });

        test('remainingToPay is never negative', () => {
            const cardManager = makeMockCardManager([
                { id: 'gc1', name: 'Card A', initialBalance: 100, currentBalance: 100 }
            ]);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);
            m.addGiftCard(list.id, 'gc1');
            const item = m.addItem(list.id, 'A', '');
            m.updateItem(list.id, item.id, { unitPriceCents: 500, quantity: 1 }); // €5, card has €100

            const summary = m.calculateCheckoutSummary(list.id);
            expect(summary.remainingToPayCents).toBe(0);
        });

        test('payment formulas: example from issue', () => {
            // Shopping total: €72.50, Card A: €30, Card B: €50
            const shoppingTotal = 7250;
            const cardA = 3000;
            const cardB = 5000;
            const totalGCBalance = cardA + cardB; // 8000

            const coverage = Math.min(shoppingTotal, totalGCBalance); // 7250
            const remaining = Math.max(0, shoppingTotal - totalGCBalance); // 0
            const unused = Math.max(0, totalGCBalance - shoppingTotal); // 750

            expect(coverage).toBe(7250);
            expect(remaining).toBe(0);
            expect(unused).toBe(750); // €7.50

            // Per-card allocation
            let rem = shoppingTotal;
            const useA = Math.min(rem, cardA); // 3000
            rem = Math.max(0, rem - cardA);    // 4250
            const useB = Math.min(rem, cardB); // 4250

            expect(useA).toBe(3000);
            expect(useB).toBe(4250);
        });
    });

    // =====================
    // Payment Confirmation
    // =====================
    describe('payment confirmation', () => {
        test('confirmPayment marks list as completed', () => {
            const list = manager.createList('Test', '', null);
            manager.confirmPayment(list.id, 5000, []);
            expect(manager.getList(list.id).status).toBe('completed');
            expect(manager.getList(list.id).finalTotalCents).toBe(5000);
        });

        test('confirmPayment creates transactions on gift cards', () => {
            const cards = [
                { id: 'gc1', name: 'Card A', initialBalance: 50, currentBalance: 50, transactions: [] }
            ];
            const cardManager = makeMockCardManager(cards);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Weekly groceries', 'Super U', null);
            const item = m.addItem(list.id, 'Bread', '');
            m.updateItem(list.id, item.id, { unitPriceCents: 200, quantity: 1 });

            const payments = [{ cardId: 'gc1', amountCents: 200 }];
            m.confirmPayment(list.id, 200, payments);

            expect(cards[0].transactions).toHaveLength(1);
            expect(cards[0].transactions[0].amount).toBe(-2); // €2 deducted
            expect(cards[0].transactions[0].type).toBe('spend');
            expect(cards[0].currentBalance).toBe(48); // 50 - 2
            expect(cardManager.saveCards).toHaveBeenCalled();
        });

        test('confirmPayment does not update balances until called', () => {
            const cards = [
                { id: 'gc1', name: 'Card A', initialBalance: 50, currentBalance: 50, transactions: [] }
            ];
            const cardManager = makeMockCardManager(cards);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);

            // Before confirmation - balance unchanged
            expect(cards[0].currentBalance).toBe(50);
            expect(cardManager.saveCards).not.toHaveBeenCalled();

            // After confirmation
            m.confirmPayment(list.id, 2000, [{ cardId: 'gc1', amountCents: 2000 }]);
            expect(cards[0].currentBalance).toBe(30);
        });

        test('confirmPayment balance cannot go negative', () => {
            const cards = [
                { id: 'gc1', name: 'Card A', initialBalance: 10, currentBalance: 10, transactions: [] }
            ];
            const cardManager = makeMockCardManager(cards);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);

            m.confirmPayment(list.id, 5000, [{ cardId: 'gc1', amountCents: 5000 }]);
            expect(cards[0].currentBalance).toBe(0); // floor at 0
        });

        test('confirmPayment stores payment breakdown', () => {
            const list = manager.createList('Test', '', null);
            const payments = [
                { cardId: 'gc1', amountCents: 3000 },
                { cardId: 'gc2', amountCents: 2000 }
            ];
            manager.confirmPayment(list.id, 5000, payments);
            expect(manager.getList(list.id).payments).toEqual(payments);
        });

        test('prepareDefaultPayments returns default allocation', () => {
            const cardManager = makeMockCardManager([
                { id: 'gc1', name: 'Card A', initialBalance: 30, currentBalance: 30 },
                { id: 'gc2', name: 'Card B', initialBalance: 50, currentBalance: 50 }
            ]);
            const m = new ShoppingListManager(cardManager);
            const list = m.createList('Test', '', null);
            m.addGiftCard(list.id, 'gc1');
            m.addGiftCard(list.id, 'gc2');
            const item = m.addItem(list.id, 'A', '');
            m.updateItem(list.id, item.id, { unitPriceCents: 7250, quantity: 1 });

            const payments = m.prepareDefaultPayments(list.id);
            expect(payments).toHaveLength(2);
            expect(payments[0].cardId).toBe('gc1');
            expect(payments[0].amountCents).toBe(3000);
            expect(payments[1].cardId).toBe('gc2');
            expect(payments[1].amountCents).toBe(4250);
        });
    });

    // =====================
    // Persistence
    // =====================
    describe('persistence', () => {
        test('saveShoppingLists and loadShoppingLists round-trip', () => {
            manager.createList('List A', 'Store', '2026-07-01');
            manager.createList('List B', '', null);

            const manager2 = new ShoppingListManager(makeMockCardManager());
            expect(manager2.shoppingLists).toHaveLength(2);
            expect(manager2.shoppingLists[0].name).toBe('List A');
            expect(manager2.shoppingLists[1].name).toBe('List B');
        });

        test('loads empty array when no data in localStorage', () => {
            localStorage.clear();
            const m = new ShoppingListManager(makeMockCardManager());
            expect(m.shoppingLists).toEqual([]);
        });

        test('handles corrupted localStorage gracefully', () => {
            localStorage.setItem('shoppingLists', 'invalid json');
            const m = new ShoppingListManager(makeMockCardManager());
            expect(m.shoppingLists).toEqual([]);
        });
    });

    // =====================
    // Export / Import
    // =====================
    describe('export and import', () => {
        test('getExportData returns current shopping lists', () => {
            manager.createList('List A', '', null);
            manager.createList('List B', '', null);
            const data = manager.getExportData();
            expect(data).toHaveLength(2);
            expect(data[0].name).toBe('List A');
        });

        test('importShoppingLists imports lists', () => {
            const data = [
                {
                    id: 'id1',
                    name: 'Imported List',
                    store: 'Aldi',
                    plannedDate: null,
                    status: 'inProgress',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    giftCardIds: ['gc1'],
                    loyaltyCardIds: [],
                    items: [
                        {
                            id: 'item1',
                            name: 'Tomatoes',
                            note: '',
                            checked: true,
                            barcode: '1234567890123',
                            pricingMode: 'weight',
                            unitPriceCents: null,
                            quantity: null,
                            pricePerKgCents: 299,
                            weightKg: 0.65,
                            totalCents: 194
                        }
                    ],
                    estimatedTotalCents: 194,
                    finalTotalCents: null,
                    payments: []
                }
            ];
            const result = manager.importShoppingLists(data);
            expect(result).toBe(true);
            expect(manager.shoppingLists).toHaveLength(1);
            expect(manager.shoppingLists[0].name).toBe('Imported List');
            expect(manager.shoppingLists[0].items[0].name).toBe('Tomatoes');
        });

        test('importShoppingLists handles missing optional arrays', () => {
            const data = [{ id: 'id1', name: 'List', status: 'draft' }];
            const result = manager.importShoppingLists(data);
            expect(result).toBe(true);
            expect(manager.shoppingLists[0].items).toEqual([]);
            expect(manager.shoppingLists[0].giftCardIds).toEqual([]);
            expect(manager.shoppingLists[0].loyaltyCardIds).toEqual([]);
            expect(manager.shoppingLists[0].payments).toEqual([]);
        });

        test('importShoppingLists returns false for non-array input', () => {
            expect(manager.importShoppingLists(null)).toBe(false);
            expect(manager.importShoppingLists('invalid')).toBe(false);
            expect(manager.importShoppingLists({})).toBe(false);
        });

        test('importShoppingLists replaces existing data', () => {
            manager.createList('Old list', '', null);
            expect(manager.shoppingLists).toHaveLength(1);

            manager.importShoppingLists([
                { id: 'new1', name: 'New list 1', status: 'draft' },
                { id: 'new2', name: 'New list 2', status: 'draft' }
            ]);
            expect(manager.shoppingLists).toHaveLength(2);
            expect(manager.shoppingLists[0].name).toBe('New list 1');
        });

        test('importShoppingLists with empty array clears lists', () => {
            manager.createList('Some list', '', null);
            manager.importShoppingLists([]);
            expect(manager.shoppingLists).toHaveLength(0);
        });
    });

    // =====================
    // Format utilities
    // =====================
    describe('escapeHtml', () => {
        test('escapes HTML special characters', () => {
            expect(manager.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
            expect(manager.escapeHtml('Hello & World')).toBe('Hello &amp; World');
            // Note: DOM textContent/innerHTML does not escape double quotes in content context
            expect(manager.escapeHtml('"quote"')).toBe('"quote"');
        });

        test('returns empty string for falsy input', () => {
            expect(manager.escapeHtml('')).toBe('');
            expect(manager.escapeHtml(null)).toBe('');
            expect(manager.escapeHtml(undefined)).toBe('');
        });
    });

    // =====================
    // Product Cache
    // =====================
    describe('product cache', () => {
        test('saveProductToCache and getProductFromCache round-trip', () => {
            manager.saveProductToCache('3017620422003', { name: 'Nutella', brand: 'Ferrero', quantity: '400 g' });
            const product = manager.getProductFromCache('3017620422003');
            expect(product.name).toBe('Nutella');
            expect(product.brand).toBe('Ferrero');
            expect(product.quantity).toBe('400 g');
        });

        test('getProductFromCache returns null for unknown barcode', () => {
            expect(manager.getProductFromCache('0000000000000')).toBeNull();
        });

        test('getProductFromCache returns null for empty/null barcode', () => {
            expect(manager.getProductFromCache(null)).toBeNull();
            expect(manager.getProductFromCache('')).toBeNull();
        });

        test('saveProductToCache merges with existing entry', () => {
            manager.saveProductToCache('abc123', { name: 'Test', brand: 'Brand' });
            manager.saveProductToCache('abc123', { quantity: '500 ml', source: 'openfoodfacts' });
            const product = manager.getProductFromCache('abc123');
            expect(product.name).toBe('Test');
            expect(product.brand).toBe('Brand');
            expect(product.quantity).toBe('500 ml');
        });

        test('product cache persists across instances', () => {
            manager.saveProductToCache('3017620422003', { name: 'Nutella' });
            const m2 = new ShoppingListManager(makeMockCardManager());
            expect(m2.getProductFromCache('3017620422003').name).toBe('Nutella');
        });

        test('loadProductCache handles corrupted data gracefully', () => {
            localStorage.setItem('productCache', 'invalid json');
            const m = new ShoppingListManager(makeMockCardManager());
            expect(m.productCache).toEqual({});
        });
    });

    // =====================
    // Price History
    // =====================
    describe('price history', () => {
        test('recordPriceForBarcode stores price for a store', () => {
            manager.recordPriceForBarcode('3017620422003', 'Super U', 349);
            const suggestion = manager.getSuggestedPriceForStore('3017620422003', 'Super U');
            expect(suggestion).not.toBeNull();
            expect(suggestion.unitPriceCents).toBe(349);
            expect(suggestion.store).toBe('Super U');
            expect(suggestion.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        test('getSuggestedPriceForStore returns null when no match', () => {
            manager.recordPriceForBarcode('3017620422003', 'Super U', 349);
            expect(manager.getSuggestedPriceForStore('3017620422003', 'Carrefour')).toBeNull();
        });

        test('getSuggestedPriceForStore returns null for unknown barcode', () => {
            expect(manager.getSuggestedPriceForStore('9999999999999', 'Super U')).toBeNull();
        });

        test('getSuggestedPriceForStore returns null for empty inputs', () => {
            expect(manager.getSuggestedPriceForStore(null, 'Super U')).toBeNull();
            expect(manager.getSuggestedPriceForStore('3017620422003', '')).toBeNull();
        });

        test('recordPriceForBarcode updates existing price for same store', () => {
            manager.recordPriceForBarcode('3017620422003', 'Super U', 349);
            manager.recordPriceForBarcode('3017620422003', 'Super U', 379);
            const suggestion = manager.getSuggestedPriceForStore('3017620422003', 'Super U');
            expect(suggestion.unitPriceCents).toBe(379);
            // Only one entry per store
            const prices = manager.productCache['3017620422003'].prices;
            expect(prices.filter(p => p.store === 'Super U')).toHaveLength(1);
        });

        test('recordPriceForBarcode stores separate entries for different stores', () => {
            manager.recordPriceForBarcode('3017620422003', 'Super U', 349);
            manager.recordPriceForBarcode('3017620422003', 'Carrefour', 389);
            expect(manager.getSuggestedPriceForStore('3017620422003', 'Super U').unitPriceCents).toBe(349);
            expect(manager.getSuggestedPriceForStore('3017620422003', 'Carrefour').unitPriceCents).toBe(389);
        });

        test('recordPriceForBarcode does nothing for null/empty inputs', () => {
            manager.recordPriceForBarcode(null, 'Super U', 349);
            manager.recordPriceForBarcode('3017620422003', '', 349);
            manager.recordPriceForBarcode('3017620422003', 'Super U', null);
            expect(manager.productCache['3017620422003']).toBeUndefined();
        });

        test('price history coexists with product info', () => {
            manager.saveProductToCache('3017620422003', { name: 'Nutella', brand: 'Ferrero' });
            manager.recordPriceForBarcode('3017620422003', 'Lidl', 299);
            const product = manager.getProductFromCache('3017620422003');
            expect(product.name).toBe('Nutella');
            expect(product.prices).toHaveLength(1);
            expect(product.prices[0].unitPriceCents).toBe(299);
        });
    });

    // =====================
    // buildProductNote
    // =====================
    describe('buildProductNote', () => {
        test('returns brand, quantity, category joined by comma (excludes name)', () => {
            const note = manager.buildProductNote({ name: 'Nutella', brand: 'Ferrero', quantity: '400 g', category: 'en:spreads' });
            expect(note).toBe('Ferrero, 400 g, en:spreads');
        });

        test('skips null and undefined fields', () => {
            const note = manager.buildProductNote({ name: 'Milk', brand: null, quantity: '1 L', category: undefined });
            expect(note).toBe('1 L');
        });

        test('returns empty string for null product', () => {
            expect(manager.buildProductNote(null)).toBe('');
        });

        test('returns empty string when all fields are null', () => {
            expect(manager.buildProductNote({ name: null, brand: null, quantity: null, category: null })).toBe('');
        });
    });

    // =====================
    // lookupProductInfo
    // =====================
    describe('lookupProductInfo', () => {
        beforeEach(() => {
            // Reset fetch mock for each test
            global.fetch = undefined;
        });

        test('returns cached product without fetching when cache has name', async () => {
            manager.saveProductToCache('3017620422003', { name: 'Nutella', brand: 'Ferrero' });
            const fetchSpy = jest.fn();
            global.fetch = fetchSpy;
            const result = await manager.lookupProductInfo('3017620422003');
            expect(result.name).toBe('Nutella');
            expect(result.fromCache).toBe(true);
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        test('returns null for null/empty barcode without fetching', async () => {
            const fetchSpy = jest.fn();
            global.fetch = fetchSpy;
            expect(await manager.lookupProductInfo(null)).toBeNull();
            expect(await manager.lookupProductInfo('')).toBeNull();
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        test('returns null gracefully when offline (fetch throws)', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            const result = await manager.lookupProductInfo('3017620422003');
            expect(result).toBeNull();
        });

        test('returns null when Open Food Facts returns status 0', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ status: 0, product: null })
            });
            const result = await manager.lookupProductInfo('0000000000000');
            expect(result).toBeNull();
        });

        test('saves product to cache when found via Open Food Facts', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    status: 1,
                    product: {
                        product_name: 'Nutella',
                        brands: 'Ferrero',
                        quantity: '400 g',
                        categories_tags: ['en:spreads'],
                        image_front_small_url: 'https://example.com/nutella.jpg'
                    }
                })
            });
            const result = await manager.lookupProductInfo('3017620422003');
            expect(result).not.toBeNull();
            expect(result.name).toBe('Nutella');
            expect(result.brand).toBe('Ferrero');
            expect(result.quantity).toBe('400 g');
            expect(result.source).toBe('openfoodfacts');
            // Should be saved to cache
            const cached = manager.getProductFromCache('3017620422003');
            expect(cached.name).toBe('Nutella');
        });

        test('tries Open Products Facts when Open Food Facts returns nothing', async () => {
            let callCount = 0;
            global.fetch = jest.fn().mockImplementation((url) => {
                callCount++;
                if (url.includes('openfoodfacts')) {
                    return Promise.resolve({ ok: true, json: async () => ({ status: 0 }) });
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        status: 1,
                        product: { product_name: 'Shampoo', brands: 'Brand X', quantity: '250 ml' }
                    })
                });
            });
            const result = await manager.lookupProductInfo('1234567890123');
            expect(callCount).toBe(2);
            expect(result.name).toBe('Shampoo');
            expect(result.source).toBe('openproductsfacts');
        });
    });

    // =====================
    // applyBarcodeToItem (business logic)
    // =====================
    describe('applyBarcodeToItem', () => {
        beforeEach(() => {
            global.fetch = undefined;
            // Stub DOM methods used by applyBarcodeToItem
            manager.renderListDetail = jest.fn();
            manager.updateScanStatus = jest.fn();
            manager.showAddItemModal = jest.fn();
        });

        test('sets barcode on existing item', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
            const list = manager.createList('List', 'Lidl', null);
            const item = manager.addItem(list.id, 'Unnamed', '');
            await manager.applyBarcodeToItem(list.id, item.id, '3017620422003', 'EAN13');
            const updated = manager.getList(list.id).items[0];
            expect(updated.barcode).toBe('3017620422003');
            expect(updated.barcodeFormat).toBe('EAN13');
        });

        test('prefills item name and note from product lookup', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    status: 1,
                    product: { product_name: 'Nutella', brands: 'Ferrero', quantity: '400 g' }
                })
            });
            const list = manager.createList('List', 'Super U', null);
            const item = manager.addItem(list.id, '', '');
            await manager.applyBarcodeToItem(list.id, item.id, '3017620422003', 'EAN13');
            const updated = manager.getList(list.id).items[0];
            expect(updated.name).toBe('Nutella');
            expect(updated.note).toBe('Ferrero, 400 g');
        });

        test('appends product name and note to existing item values', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    status: 1,
                    product: { product_name: 'Nutella', brands: 'Ferrero', quantity: '400 g' }
                })
            });
            const list = manager.createList('List', '', null);
            const item = manager.addItem(list.id, 'My Custom Name', 'My note');
            await manager.applyBarcodeToItem(list.id, item.id, '3017620422003', 'EAN13');
            const updated = manager.getList(list.id).items[0];
            expect(updated.name).toBe('My Custom Name | Nutella');
            expect(updated.note).toBe('My note; Ferrero, 400 g');
        });

        test('stores pending product info and opens add modal for __new__ item', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    status: 1,
                    product: { product_name: 'Milk', brands: 'Lactel', quantity: '1 L' }
                })
            });
            const list = manager.createList('List', '', null);
            await manager.applyBarcodeToItem(list.id, '__new__', '1234567890', 'EAN13');
            expect(manager.showAddItemModal).toHaveBeenCalledWith(list.id);
            // pendingProductInfo is set before showAddItemModal is called
            // (in the real flow showAddItemModal consumes and clears it; mock leaves it intact)
            expect(manager.pendingProductInfo).toMatchObject({
                barcode: '1234567890',
                barcodeFormat: 'EAN13',
                name: 'Milk',
                brand: 'Lactel'
            });
        });

        test('handles offline gracefully for existing item', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
            const list = manager.createList('List', '', null);
            const item = manager.addItem(list.id, 'Existing', '');
            await expect(
                manager.applyBarcodeToItem(list.id, item.id, '999', 'EAN13')
            ).resolves.not.toThrow();
            const updated = manager.getList(list.id).items[0];
            expect(updated.barcode).toBe('999');
        });
    });

    // =====================
    // handleItemFormSubmit – price cache integration
    // =====================
    describe('handleItemFormSubmit price cache', () => {
        function setupItemFormDOM({ name = 'Nutella', note = '', barcode = '3017620422003',
            pricingMode = 'unit', unitPrice = '3.49', quantity = '1' } = {}) {
            document.body.innerHTML = `
                <input id="itemName" value="${name}">
                <input id="itemNote" value="${note}">
                <input id="itemBarcode" value="${barcode}">
                <input type="radio" name="pricingMode" value="unit" ${pricingMode === 'unit' ? 'checked' : ''}>
                <input type="radio" name="pricingMode" value="weight" ${pricingMode === 'weight' ? 'checked' : ''}>
                <input id="itemUnitPrice" value="${unitPrice}">
                <input id="itemQuantity" value="${quantity}">
                <input id="itemPricePerKg" value="">
                <input id="itemWeight" value="">
                <div id="shoppingItemModal"></div>
            `;
            manager.renderListDetail = jest.fn();
        }

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('saves unit price and store to product cache on submit', () => {
            const list = manager.createList('Week', 'Super U', null);
            setupItemFormDOM({ barcode: '3017620422003', unitPrice: '3.49' });
            manager.handleItemFormSubmit(list.id, null);
            const suggestion = manager.getSuggestedPriceForStore('3017620422003', 'Super U');
            expect(suggestion).not.toBeNull();
            expect(suggestion.unitPriceCents).toBe(349);
        });

        test('does not save price when store is empty', () => {
            const list = manager.createList('Week', '', null);
            setupItemFormDOM({ barcode: '3017620422003', unitPrice: '3.49' });
            manager.handleItemFormSubmit(list.id, null);
            expect(manager.getSuggestedPriceForStore('3017620422003', '')).toBeNull();
        });

        test('saves product name to cache when not already cached', () => {
            const list = manager.createList('Week', '', null);
            setupItemFormDOM({ name: 'Nutella', barcode: '3017620422003', unitPrice: '' });
            manager.handleItemFormSubmit(list.id, null);
            const cached = manager.getProductFromCache('3017620422003');
            expect(cached).not.toBeNull();
            expect(cached.name).toBe('Nutella');
        });

        test('does not overwrite existing cached product name with user-entered name', () => {
            manager.saveProductToCache('3017620422003', { name: 'Nutella', brand: 'Ferrero' });
            const list = manager.createList('Week', '', null);
            setupItemFormDOM({ name: 'My custom name', barcode: '3017620422003', unitPrice: '' });
            manager.handleItemFormSubmit(list.id, null);
            expect(manager.getProductFromCache('3017620422003').name).toBe('Nutella');
        });
    });
});

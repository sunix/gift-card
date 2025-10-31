# 🎁 Gift Card Manager

A simple, static web application to manage your gift cards locally in your browser.

💬 **Have feedback?** [Report issues or request features](https://github.com/sunix/gift-card/issues) on our issue tracker!

## Features

- ✨ **Add Gift Cards & Fidelity Cards**: Create gift cards with balances or fidelity/loyalty cards without balances
- 🏪 **Smart Store Recognition**: Automatically detects and brands cards from popular stores (Decathlon, Super U, Leroy Merlin, Fnac, and more) with custom logos and colors
- 💰 **Track Balances**: Monitor current balance for each card with transaction history
- 📊 **Transaction History**: Keep detailed history of all spending with dates and remaining balances
- 🗂️ **Archive Cards**: Archive unused cards to keep your active list organized, with easy access to view archived cards
- 🔄 **Drag & Drop Reordering**: Easily reorder your cards by dragging and dropping them
- 📱 **Mobile Friendly**: Responsive design that works on all devices
- 📷 **Barcode Generation**: Automatically generate barcodes from card numbers in multiple formats (CODE128, CODE39, EAN-13, UPC, etc.)
- 🌐 **Multi-language Support**: Available in English and French with easy language switching
- 💾 **Local Storage**: All data stored securely in your browser's local storage
- 📥 **Import/Export**: Backup and restore your data with JSON export/import functionality
- 🚀 **No Backend Required**: Pure static website, perfect for GitHub Pages
- 📲 **Progressive Web App (PWA)**: Install on your device and use offline like a native app

## Screenshots

### Main Interface
![Main Page](https://github.com/user-attachments/assets/ff0c86d5-5a0b-4ff4-8bcb-625535bf1c6f)
*The clean and intuitive main interface with smart store recognition and support for both gift cards and fidelity cards*

### Gift Card List with Store Branding
![Card List](https://github.com/user-attachments/assets/c8d0ae43-3024-4a02-959d-a18e237662bf)
*View all your cards with automatic store logos, colors, and distinction between gift cards (with balance) and fidelity cards*

### Card Details & Barcode
![Card Detail](https://github.com/user-attachments/assets/0c310659-25e3-43b0-adf1-13d020d06024)
*Detailed view with store branding, barcode generation in multiple formats, and transaction management*

## Usage

### Live Demo
Visit the live application at: [https://sunix.github.io/gift-card/](https://sunix.github.io/gift-card/)

### Running Locally
1. Clone this repository
2. Open `index.html` in your web browser
3. Start managing your gift cards!

### Installing as a PWA
On **Android**:
1. Visit the live application URL in Chrome or Firefox
2. Tap the menu (three dots) and select "Add to Home screen" or "Install app"
3. The app will be installed on your device like a native app
4. Launch it from your home screen anytime, even offline!

On **iOS** (Safari):
1. Visit the live application URL in Safari
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to install the app

On **Desktop** (Chrome, Edge, etc.):
1. Visit the live application URL
2. Look for the install icon in the address bar (or menu)
3. Click "Install" to add the app to your system

## How to Use the App

### Step 1: Adding a Gift Card or Fidelity Card
1. **Fill in the card details** in the "Add New Gift Card" form:
   - **Card Number**: Enter your gift card or fidelity card number (e.g., 1234567890123)
   - **Card Name**: Give it a friendly name (e.g., "Amazon Gift Card", "Decathlon Fidelity")
   - **Initial Balance**: Enter the current balance in euros (leave empty or 0 for fidelity cards)
2. **Click "Add Card"** to save the card
3. Your card will appear in the "My Gift Cards" section with:
   - **Automatic store recognition**: Cards from recognized stores (Decathlon, Super U, Leroy Merlin, Fnac, etc.) will display with custom branding and colors
   - **Card type badge**: Fidelity cards (without balance) show a purple "Fidelity Card" badge, while gift cards show their balance

### Step 2: Viewing and Organizing Your Cards
- All your cards are displayed in the "My Gift Cards" section
- **Store branding**: Recognized stores show their logo and custom colors automatically
- **Drag & Drop**: Click and drag cards to reorder them according to your preference
- **Card types**: 
  - Gift cards display their current balance in euros
  - Fidelity cards show a "Fidelity Card" badge instead of a balance
- Click on any card to view its details

### Step 3: Recording Transactions (Gift Cards Only)
1. **Click on a gift card** to open the detail modal
2. **View the barcode** and **select barcode type** from the dropdown (CODE128, CODE39, EAN-13, etc.)
3. In the "Add Transaction" section:
   - Enter the **amount spent** (e.g., 25.50)
   - Optionally add a **description** (e.g., "Coffee and lunch")
4. **Click "Record Transaction"** to save
5. The card's balance updates automatically
6. View the **transaction history** below with dates, amounts, and remaining balances

**Note**: Fidelity cards don't have balance tracking, so transaction features are not available for them.

### Step 4: Managing Barcodes
Each card detail page displays a barcode generated from the card number:
- **Choose barcode format** from the dropdown menu
- Supported formats: CODE 128, CODE 39, EAN-13, EAN-8, UPC, ITF-14, MSI, Codabar
- The barcode updates immediately when you change the format
- The selected format is saved for each card

**Note:** The barcode is generated using the bwip-js library and implements standard barcode formats. You can use these barcodes for scanning at stores.

### Step 5: Archiving Cards
Keep your active card list organized by archiving cards you no longer use regularly:
1. Open the card detail modal
2. Click the **"Archive Card"** button
3. The card moves to the archived section
4. Access archived cards anytime by clicking the "View Archived Cards" link
5. Unarchive a card by opening it and clicking **"Unarchive Card"**

### Step 6: Changing Language
1. Click the **"🌐 Language"** button in the top navigation
2. Select your preferred language (English or Français)
3. The interface updates immediately

### Step 7: Deleting a Card
1. Open the card detail modal
2. Scroll to the bottom
3. Click "Delete Card" button
4. Confirm the deletion
5. The card and all its transaction history will be permanently removed

## Technology Stack

- **HTML5**: Structure and semantics
- **CSS3**: Responsive styling with mobile-first approach and custom store branding
- **Vanilla JavaScript**: Application logic with ES6+ features (no frameworks needed)
- **bwip-js**: Barcode generation library for creating scannable barcodes in multiple formats
- **LocalStorage API**: Data persistence for cards, transactions, and preferences
- **Service Worker**: Offline functionality and caching for PWA features
- **Web App Manifest**: PWA installation support for mobile and desktop
- **i18n System**: Multi-language support with dynamic translation loading

## Supported Stores

The app automatically recognizes and brands cards from the following stores:

- 🏪 **Magasins U** (Super U, Hyper U, U Express)
- 🏃 **Decathlon** - Sports equipment and apparel
- 🔨 **Leroy Merlin** - Home improvement
- 🍕 **Picard** - Frozen foods
- 🛒 **Franprix** - Supermarket
- 📚 **Fnac** - Books, electronics, and entertainment
- 🍔 **McDonald's** - Fast food
- 🌱 **Truffaut** - Garden center
- 🛍️ **E. Leclerc** - Supermarket

Each recognized store displays with its custom logo and brand colors. You can add more stores by editing the `stores.json` file.

### Adding Custom Stores

To add a new store to the recognition system:

1. Edit the `stores.json` file and add a new entry:
```json
{
  "name": "Store Name",
  "matchStrings": ["store", "store name", "store-keyword"],
  "iconUrl": "https://example.com/logo.svg",
  "icon": "store-logos/store-name.svg",
  "color": "#FF0000",
  "background": "linear-gradient(135deg, #FF0000, #FF6B6B)"
}
```

2. Create a corresponding SVG logo file in the `store-logos/` directory

**Field descriptions:**
- `name`: Display name of the store
- `matchStrings`: Array of keywords to match in card names (case-insensitive)
- `iconUrl`: URL to the official logo (optional, for reference)
- `icon`: Path to the local SVG logo file
- `color`: Primary brand color (hex format)
- `background`: CSS gradient for the card header background

See `STORE_LOGOS.md` for more details about the logo system and CORS considerations.

## Browser Compatibility

Works on all modern browsers that support:
- ES6 JavaScript
- LocalStorage API
- CSS3 Flexbox
- Service Workers (for PWA features)
- Web App Manifest (for PWA installation)

Tested on:
- Chrome/Edge (Android, iOS, Desktop)
- Firefox (Android, Desktop)
- Safari (iOS, macOS)

## Data Privacy

All your gift card data is stored locally in your browser. No data is sent to any server or third party.

## GitHub Pages Deployment

This repository is ready for GitHub Pages:
1. Go to repository Settings
2. Navigate to Pages section
3. Select the branch and root folder
4. Your site will be published at `https://[username].github.io/gift-card/`

## License

MIT License - Feel free to use and modify as needed.

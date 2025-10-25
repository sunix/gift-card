# 🎁 Gift Card Manager

A simple, static web application to manage your gift cards locally in your browser.

## Features

- ✨ **Add Gift Cards**: Create gift cards with custom names, numbers, and initial balances
- 💰 **Track Balances**: Monitor current balance for each card
- 📊 **Transaction History**: Keep detailed history of all spending with dates and remaining balances
- 📱 **Mobile Friendly**: Responsive design that works on all devices
- 📷 **Barcode Generation**: Automatically generate barcodes from card numbers for easy scanning
- 💾 **Local Storage**: All data stored securely in your browser's local storage
- 🚀 **No Backend Required**: Pure static website, perfect for GitHub Pages
- 📲 **Progressive Web App (PWA)**: Install on your device and use offline like a native app

## Usage

### Live Demo
Visit the live application at: `https://[your-username].github.io/gift-card/`

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

### Adding a Gift Card
1. Fill in the card number (e.g., 1234567890)
2. Enter a friendly name (e.g., "Amazon Gift Card")
3. Set the initial balance in euros
4. Click "Add Card"

### Recording Transactions
1. Click on any gift card to open its details
2. Enter the amount spent
3. Optionally add a description
4. Click "Record Transaction"
5. View the updated balance and transaction history

### Viewing Barcodes
Each card detail page displays a barcode-style visual representation generated from the card number.

**Note:** The barcode visual is decorative and based on the card number. For production use with actual barcode scanning, consider integrating a proper barcode library like JsBarcode or QuaggaJS that implements standard barcode formats (CODE128, EAN-13, etc.).

## Technology Stack

- **HTML5**: Structure and semantics
- **CSS3**: Responsive styling with mobile-first approach
- **Vanilla JavaScript**: Application logic (no frameworks needed)
- **Canvas API**: Barcode-style visual generation
- **LocalStorage API**: Data persistence
- **Service Worker**: Offline functionality and caching
- **Web App Manifest**: PWA installation support

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
# Google Drive Backend Setup Guide

This guide explains how to set up the Google Drive backend feature for the Gift Card Manager application.

## Overview

The Google Drive backend allows you to:
- Store your gift cards in Google Drive instead of just local browser storage
- Share cards with others by sharing the Google Drive file
- Access your cards from multiple devices
- Work offline with automatic sync when connectivity is restored
- Track who made each transaction (owner tracking)

## Prerequisites

To use the Google Drive backend, you need:
1. A Google account
2. API credentials (API Key and Client ID) from Google Cloud Console

## Setting Up Google API Credentials

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "Gift Card Manager")
4. Click "Create"

### Step 2: Enable Google Drive API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and click "Enable"
4. Also enable "Google Picker API" for file selection

### Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API key"
3. Copy the API key
4. (Optional) Click "Restrict Key" to add restrictions:
   - Application restrictions: HTTP referrers
   - Add your website URL (e.g., `https://yourusername.github.io/*`)
   - API restrictions: Select "Google Drive API" and "Google Picker API"

### Step 4: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in app name: "Gift Card Manager"
   - Add your email as support email
   - Add scopes: 
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Add test users if needed
4. For Application type, select "Web application"
5. Add Authorized JavaScript origins:
   - For local testing: `http://localhost:8000` (or your port)
   - For GitHub Pages: `https://yourusername.github.io`
6. **Important:** For OAuth 2.0 Client ID used with Google Identity Services, you do NOT need to add redirect URIs
7. Click "Create" and copy the Client ID

**Note:** This application uses Google Identity Services (GIS), the modern authentication library recommended by Google. The deprecated `gapi.auth2` library is no longer supported for new applications.

### Step 5: Configure Your Credentials in the Application

**Important:** Do NOT commit your credentials to the repository. The application stores them securely in your browser's localStorage.

1. Open the Gift Card Manager application
2. Navigate to the "Storage" section (☁️ Storage in the navigation menu)
3. In the "Google API Configuration" section:
   - Paste your **API Key** (from Step 3)
   - Paste your **Client ID** (from Step 4)
4. Click **"Save Credentials"**
5. Your credentials are now stored locally in your browser only

**Security Note:** Your credentials are:
- Stored in your browser's localStorage only
- Never sent to any server (except Google's API servers)
- Safe to use in a client-side application (this is Google's intended use case)
- NOT stored in the code or repository

## Using the Google Drive Backend

### Connecting to Google Drive

1. Open the Gift Card Manager application
2. Navigate to the "Storage" section (☁️ Storage in the navigation menu)
3. Configure your API credentials (see Step 5 above) if not already done
4. Click "Connect to Google Drive"
5. Sign in with your Google account when prompted
6. Grant permissions for the app to access Drive files it creates
7. Choose to either:
   - Select an existing file (if you've used the feature before)
   - Create a new file (recommended for first-time use)

### Working Offline

The Google Drive backend automatically handles offline scenarios:

- **When you go offline**: Changes are queued locally
- **When you come back online**: Changes are automatically synced to Google Drive
- **Status indicators**:
  - 💾 = Local storage
  - ☁️ = Google Drive connected and online
  - 📴 = Google Drive but currently offline
  - 🔄 = Syncing changes

### Managing Files

Once connected, you can:

- **Select Drive File**: Choose a different file in your Drive
- **Create New File**: Create a fresh file for your cards
- **Switch to Local Storage**: Temporarily use local storage without disconnecting
- **Disconnect**: Sign out from Google and switch back to local storage

### Owner Tracking

When using Google Drive backend:
- Each transaction automatically records who made it
- The owner's email is stored with the transaction
- View transaction owners in the transaction history

## Troubleshooting

### "Failed to connect to Google Drive"

- Check that you've enabled the required APIs in Google Cloud Console
- Check your API credentials are configured correctly in the Storage settings
- Verify your API key and Client ID in Google Cloud Console
- Make sure your domain is authorized in the OAuth 2.0 client settings

### "API credentials not configured"

- Go to the Storage section in the app
- Enter your API Key and Client ID from Google Cloud Console
- Click "Save Credentials"

### "File selection cancelled"

- This is normal if you clicked "Cancel" in the file picker
- Click "Connect to Google Drive" again to try selecting a file

### Offline sync not working

- The app needs to have been online at least once after connecting
- Check browser console for any errors
- Ensure you're using a modern browser that supports Service Workers

### Data not syncing

- Check your internet connection
- Look for the sync status icon (🔄 means syncing is in progress)
- Try disconnecting and reconnecting to Google Drive

## Security Considerations

- **Your API credentials are stored locally in your browser only** - they are never sent anywhere except to Google's API servers
- The app only accesses files it creates (using `drive.file` scope)
- Your Google Drive credentials are stored securely in your browser
- No data is sent to any third-party servers besides Google Drive
- You can revoke app access anytime from your Google Account settings
- **Safe for public repositories:** Since credentials are configured via UI and stored in localStorage, there's no risk of exposing them in source code

## Privacy

- Cards stored in Google Drive are subject to Google's privacy policy
- Cards can be shared with others by sharing the Google Drive file
- Transaction owners are tracked by email address when using Google Drive

## Alternative: Local Storage Only

If you prefer not to use Google Drive:
- Simply don't connect to Google Drive
- Your cards will be stored locally in your browser
- No account or setup required
- Export/import features still available for backups

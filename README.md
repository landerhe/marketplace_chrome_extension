# Facebook Marketplace Auto-Fill Chrome Extension

A Chrome extension that automatically fills Facebook Marketplace listing forms using data from `data.json`.

## Features

- Loads items from `data.json`
- Displays items in a popup interface
- Automatically fills form fields on Facebook Marketplace create page:
  - Title
  - Price
  - Category (if available)
  - Condition
  - Description (built from item details)
  - Images (uploads local images)

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `marketplace_chrome_extension` folder
5. The extension should now appear in your extensions list

## Usage

1. Navigate to Facebook Marketplace create page: `https://www.facebook.com/marketplace/create/listing`
2. Click the extension icon in your Chrome toolbar
3. Select an item from the list
4. Click "Fill Form"
5. The form will be automatically filled with the selected item's data

## File Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic
- `content.js` - Content script that fills the form
- `data.json` - Item data (your listings)
- `images/` - Local image files

## Notes

- The extension works on Facebook Marketplace create pages
- Images must be in the `images/` folder with paths matching those in `data.json`
- Condition values are mapped: "Worn" → "Used - Fair", "Rarely Worn" → "Used - Like New", "New" → "New"
- The extension handles up to 10 images per listing (Facebook's limit)

## Troubleshooting

- If form fields aren't found, make sure you're on the correct Facebook Marketplace create page
- If images don't upload, check that image paths in `data.json` match actual files in the `images/` folder
- Check the browser console (F12) for any error messages


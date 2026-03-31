# Facebook Marketplace Auto-Fill Chrome Extension

A Chrome extension that automatically fills Facebook Marketplace listing forms from CSV files and images. Upload your product data as CSV, match images with a simple naming convention, and let the extension fill forms automatically.

## Features

- **CSV Upload**: Upload your product data as CSV files with flexible column mapping
- **Image Matching**: Automatically match images to products using naming convention
- **Flexible Field Mapping**: Auto-detect or manually map CSV columns to Facebook fields
- **Drag & Drop**: Easily upload CSV files and images via drag-and-drop
- **No Value Transformation**: Uses your exact values - no automatic conversions
- **Smart Field Filling**: Automatically fills Facebook Marketplace forms with your data

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `marketplace_chrome_extension` folder
6. The extension should now appear in your extensions list

## Quick Start

1. **Prepare your CSV file** with product data (see [CSV Format Guide](HELP.md#csv-format-guide))
2. **Name your images** using the format: `Row{number}_{identifier}_{number}.{ext}` (see [Image Naming Guide](HELP.md#image-naming))
3. Navigate to Facebook Marketplace create page: `https://www.facebook.com/marketplace/create/listing`
4. Click the extension icon in your Chrome toolbar
5. Upload your CSV file in the "CSV" tab
6. Upload your images in the "Images" tab
7. Select an item and click "Fill Form"

## CSV Format

Your CSV file should contain columns for:
- Title (required)
- Price (required)
- Category (optional, must match Facebook's exact category names)
- Condition (optional, must match Facebook's exact condition names)
- Description (optional)
- Size (optional)
- Materials (optional)

See [HELP.md](HELP.md) for detailed CSV format instructions and examples.

## Image Naming Convention

Images should be named: `Row{rowNumber}_{identifier}_{imageNumber}.{ext}`

Example: `Row11_Andrea Martin furry jacket Printed on the back_1.jpg`

See [HELP.md](HELP.md#image-naming) for detailed image naming instructions.

## File Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic and file handling
- `content.js` - Content script that fills the Facebook form
- `csvParser.js` - CSV parsing and delimiter detection
- `fieldMapper.js` - CSV column to Facebook field mapping
- `imageMatcher.js` - Image filename parsing and matching
- `storageManager.js` - IndexedDB and chrome.storage management
- `utils.js` - Utility functions

## Important Notes

- **Field Values**: The extension does NOT transform values. Use Facebook's exact field names for Category and Condition.
- **Image Storage**: Images are stored in your browser's IndexedDB. Clear browser data will remove them.
- **CSV Size**: Maximum CSV file size is 10MB
- **Image Size**: Maximum 10MB per image
- **Image Formats**: Supported formats: JPG, PNG, WEBP, HEIC, HEIF

## Troubleshooting

See [HELP.md](HELP.md#troubleshooting) for detailed troubleshooting guide.

Common issues:
- Form fields not found: Make sure you're on the Facebook Marketplace create page
- Images not matching: Check your image naming format matches the convention
- CSV not processing: Verify CSV format and that headers are on the first row
- Field values not filling: Ensure values exactly match Facebook's field options

## Support

For detailed help and examples, see [HELP.md](HELP.md).

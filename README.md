# AutoList for Facebook Marketplace 🛒

> **A fast, privacy-first Chrome Extension (Manifest V3) that automates Facebook Marketplace listing forms from CSV files and local images.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest: V3](https://img.shields.io/badge/Manifest-V3-orange.svg)]()
[![Privacy: 100% Client--Side](https://img.shields.io/badge/Privacy-100%25%20Local-success.svg)]()

---

## 🌟 Overview

Listing dozens or hundreds of items on Facebook Marketplace manually is tedious and repetitive. 

**AutoList** streamlines this workflow:
- **Bulk CSV Upload**: Drag and drop your inventory CSV with flexible column auto-detection.
- **Smart Image Matching**: Pair photos with product listings automatically using simple filename rules.
- **Form Auto-Fill**: Fill titles, prices, categories, conditions, descriptions, tags, and images in one click.
- **100% Client-Side Privacy**: All processing runs locally inside your browser. No external tracking, no backend servers, no analytics.

---

## 🚀 Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/landerhe/marketplace_chrome_extension.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `marketplace_chrome_extension` folder.
6. The extension icon will appear in your Chrome toolbar.

---

## ⚡ Quick Start

1. **Prepare your CSV file**: Check out [`samples_for_dev/sample_products.csv`](samples_for_dev/sample_products.csv) or read [HELP.md](HELP.md#csv-format-guide).
2. **Name your images**: Use the convention: `Row{number}_{identifier}_{number}.{ext}` (e.g. `Row1_Oak_Table_1.jpg`).
3. Open Facebook Marketplace listing creation page:  
   `https://www.facebook.com/marketplace/create/listing`
4. Click the AutoList extension icon in Chrome toolbar.
5. Upload your CSV and drag your product images.
6. Select an item from the list and click **Fill Form**.

---

## 📁 Repository Structure

```
marketplace_chrome_extension/
├── manifest.json            # Manifest V3 extension configuration
├── popup.html / popup.js    # Extension popup interface & file handlers
├── workshop.html / .js      # Full-page bulk inspection & mapper workshop
├── content.js               # Injected DOM filler for Facebook Marketplace
├── csvParser.js             # High-resilience CSV delimiter & quote parser
├── fieldMapper.js           # Smart column-to-marketplace attribute mapping
├── imageMatcher.js          # Filename regex matcher & IndexedDB image binder
├── storageManager.js        # Local IndexedDB & chrome.storage management
├── samples_for_dev/         # Sanitized sample CSV & reference HTML fixtures
└── HELP.md                  # Comprehensive troubleshooting and format guide
```

---

## 🔒 Privacy & Data Guarantee

- **Zero Remote Tracking**: This extension does not connect to any third-party analytics or external database.
- **Local Storage**: All product CSVs and image blobs reside exclusively in your browser's local `IndexedDB` and `chrome.storage.local`.
- **Open Source**: Full transparency under the permissive MIT license.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

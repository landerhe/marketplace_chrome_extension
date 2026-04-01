// Storage Manager for IndexedDB (images) and chrome.storage.local (metadata)

const DB_NAME = 'MarketplaceExtensionDB';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';
const STORE_METADATA = 'metadata';

let db = null;

// Initialize IndexedDB
async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for images
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        const imageStore = db.createObjectStore(STORE_IMAGES, { keyPath: 'key' });
        imageStore.createIndex('itemId', 'itemId', { unique: false });
      }
      
      // Create object store for metadata
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
      }
    };
  });
}

// Store image file in IndexedDB as ArrayBuffer with metadata
async function storeImage(key, file, itemId = null) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    // Convert File/Blob to ArrayBuffer
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      
      const transaction = db.transaction([STORE_IMAGES], 'readwrite');
      const store = transaction.objectStore(STORE_IMAGES);
      
      // Detect MIME type
      let mimeType = file.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const filename = file.name || key;
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'heic': 'image/heic', 'heif': 'image/heif'
        };
        mimeType = mimeTypes[ext] || 'image/jpeg';
      }
      
      const data = {
        key: key,
        arrayBuffer: arrayBuffer,
        filename: file.name || 'image.jpg',
        mimeType: mimeType,
        itemId: itemId,
        timestamp: Date.now()
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Get image file from IndexedDB - returns File object
async function getImage(key) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readonly');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.get(key);
    
    request.onsuccess = () => {
      if (request.result) {
        const data = request.result;
        // Convert ArrayBuffer back to Blob, then to File
        const blob = new Blob([data.arrayBuffer], { type: data.mimeType || 'image/jpeg' });
        const file = new File([blob], data.filename, { 
          type: data.mimeType || 'image/jpeg',
          lastModified: data.timestamp || Date.now()
        });
        resolve(file);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.target.error);
  });
}

// Get all images for an item
async function getItemImages(itemId) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readonly');
    const store = transaction.objectStore(STORE_IMAGES);
    const index = store.index('itemId');
    const request = index.getAll(itemId);
    
    request.onsuccess = () => {
      resolve(request.result.map(r => ({
        key: r.key,
        blob: r.blob
      })));
    };
    request.onerror = () => reject(request.error);
  });
}

// Delete image from IndexedDB
async function deleteImage(key) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.delete(key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Clear all images
async function clearAllImages() {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Remove all items, listed-item flags, and images (full reset of inventory in the extension)
async function clearStoredItemsAndImages() {
  await clearAllImages();
  return chrome.storage.local.set({
    items: [],
    listedItems: []
  });
}

// Store items data in chrome.storage.local
async function storeItems(items) {
  return chrome.storage.local.set({ items: items });
}

// Get items from chrome.storage.local
async function getItems() {
  const result = await chrome.storage.local.get('items');
  return result.items || [];
}

// Store field mapping preferences
async function storeFieldMapping(mapping) {
  return chrome.storage.local.set({ fieldMapping: mapping });
}

// Get field mapping preferences
async function getFieldMapping() {
  const result = await chrome.storage.local.get('fieldMapping');
  return result.fieldMapping || null;
}

// Store CSV settings (identifier column, etc.)
async function storeCSVSettings(settings) {
  return chrome.storage.local.set({ csvSettings: settings });
}

// Get CSV settings
async function getCSVSettings() {
  const result = await chrome.storage.local.get('csvSettings');
  return result.csvSettings || { identifierColumn: 0 }; // Default to Title column (index 0)
}

// Store extension settings (custom description, etc.)
async function storeExtensionSettings(settings) {
  return chrome.storage.local.set({ extensionSettings: settings });
}

// Get extension settings
async function getExtensionSettings() {
  const result = await chrome.storage.local.get('extensionSettings');
  return result.extensionSettings || { customDescription: '' }; // Default to blank
}

// Export functions to window for use in other scripts
if (typeof window !== 'undefined') {
  window.StorageManager = {
    storeImage,
    getImage,
    getItemImages,
    deleteImage,
    clearAllImages,
    clearStoredItemsAndImages,
    storeItems,
    getItems,
    storeFieldMapping,
    getFieldMapping,
    storeCSVSettings,
    getCSVSettings,
    storeExtensionSettings,
    getExtensionSettings
  };
}


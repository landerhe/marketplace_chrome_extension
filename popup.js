// Popup script - handles CSV upload, image upload, and item selection

let items = [];
let selectedItem = null;
let hideFromFriends = true;
let listedItems = new Set();
let fillOperationInProgress = false;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Check if required modules are loaded
function checkModules() {
  if (!window.StorageManager) {
    console.error('StorageManager module not loaded!');
  }
}

async function initialize() {
  console.log('Initializing popup...');
  
  // Wait a bit for scripts to load
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check modules
  checkModules();
  
  // Load listed items from storage
  try {
    const result = await chrome.storage.local.get('listedItems');
    if (result.listedItems) {
      listedItems = new Set(result.listedItems);
    }
  } catch (error) {
    console.warn('Error loading storage:', error);
  }

  setupWorkshopOpenButton();
  setupFillButton();
  setupFillNextButton();
  setupClearAllItems();
  setupHideFriendsToggle();

  await loadItems();
}

function setupWorkshopOpenButton() {
  const btn = document.getElementById('open-workshop-button');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const url = chrome.runtime.getURL('workshop.html');
    chrome.tabs.create({ url });
  });
}

async function loadItems() {
  try {
    items = await window.StorageManager.getItems();
    renderItems();
  } catch (error) {
    console.warn('Error loading items:', error);
  }
}

/** Unlisted items in display order (same ordering as the list: unlisted group first). */
function getUnlistedIndicesInQueueOrder() {
  if (!items.length) return [];
  const sortedItems = [...items].sort((a, b) => {
    const aListed = listedItems.has(a.id);
    const bListed = listedItems.has(b.id);
    if (aListed !== bListed) return aListed ? 1 : -1;
    return 0;
  });
  return sortedItems
    .filter((item) => !listedItems.has(item.id))
    .map((item) => items.findIndex((o) => o.id === item.id))
    .filter((idx) => idx >= 0);
}

function ensureDefaultItemSelection() {
  const queue = getUnlistedIndicesInQueueOrder();
  if (queue.length === 0) {
    if (selectedItem && listedItems.has(selectedItem.id)) {
      selectedItem = null;
    }
    return;
  }
  if (!selectedItem || listedItems.has(selectedItem.id)) {
    selectItem(queue[0]);
  }
}

function updateFillControlsState() {
  const fill = document.getElementById('fill-button');
  const fillNext = document.getElementById('fill-next-button');
  if (!fill || !fillNext) return;
  if (fillOperationInProgress) {
    fill.disabled = true;
    fillNext.disabled = true;
    return;
  }
  const queue = getUnlistedIndicesInQueueOrder();
  fillNext.disabled = queue.length === 0;
  fill.disabled = !selectedItem || listedItems.has(selectedItem.id);
}

async function ensureMarketplaceContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['descriptionAssembly.js', 'content.js']
      });
      await new Promise((r) => setTimeout(r, 300));
    } catch (injectErr) {
      throw new Error(
        'Could not load on this page. Open Facebook Marketplace “Create new listing” and try again.'
      );
    }
  }
}

async function buildFillPayloadForItem(item) {
  const itemWithImages = { ...item };
  if (itemWithImages.images && itemWithImages.images.length > 0) {
    itemWithImages.images = await Promise.all(
      itemWithImages.images.map(async (img) => window.StorageManager.getImage(img.key))
    );
    itemWithImages.images = itemWithImages.images.filter((f) => f !== null);
  }
  const imagesData = await Promise.all(
    (itemWithImages.images || []).map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return {
        arrayBuffer: Array.from(new Uint8Array(arrayBuffer)),
        filename: file.name,
        type: file.type,
        lastModified: file.lastModified
      };
    })
  );
  return { ...itemWithImages, images: imagesData };
}

function sendFillFormMessage(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: 'fillForm',
        item: payload,
        hideFromFriends: hideFromFriends
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      }
    );
  });
}

async function onFillSuccess(filledItem) {
  if (filledItem && filledItem.id) {
    listedItems.add(filledItem.id);
    await chrome.storage.local.set({ listedItems: Array.from(listedItems) });
  }
  renderItems();
  const queue = getUnlistedIndicesInQueueOrder();
  if (queue.length > 0) {
    showStatus(
      'Form filled. Next item is selected — use Fill form again or Fill next in queue.',
      'success'
    );
  } else {
    showStatus('Form filled. No more items in the queue.', 'success');
  }
  updateFillControlsState();
}

/**
 * Fills the given item on the active tab’s Marketplace create page.
 * @returns {Promise<boolean>} true if fill succeeded
 */
async function runFillPipelineForItem(item) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url || !tab.url.includes('facebook.com/marketplace/create')) {
    showStatus('Please navigate to Facebook Marketplace create page first', 'error');
    return false;
  }

  fillOperationInProgress = true;
  updateFillControlsState();
  showStatus('Filling form…', 'info');

  try {
    await ensureMarketplaceContentScript(tab.id);
    const payload = await buildFillPayloadForItem(item);
    const response = await sendFillFormMessage(tab.id, payload);
    if (response && response.success) {
      await onFillSuccess(item);
      return true;
    }
    showStatus(response?.error || 'Failed to fill form', 'error');
    return false;
  } catch (error) {
    console.error('Error filling form:', error);
    showStatus('Error: ' + error.message, 'error');
    return false;
  } finally {
    fillOperationInProgress = false;
    updateFillControlsState();
  }
}

function renderItems() {
  const itemList = document.getElementById('item-list');
  const clearAllBtn = document.getElementById('clear-all-items-button');
  if (clearAllBtn) {
    clearAllBtn.disabled = items.length === 0;
  }

  if (items.length === 0) {
    itemList.innerHTML =
      '<div class="empty">No listings yet. Use <strong>Upload CSV &amp; images</strong> above to add your spreadsheet (and optional photos).</div>';
    selectedItem = null;
    updateFillControlsState();
    return;
  }
  
  // Sort items: unlisted first, then listed
  const sortedItems = [...items].sort((a, b) => {
    const aListed = listedItems.has(a.id);
    const bListed = listedItems.has(b.id);
    if (aListed === bListed) return 0;
    return aListed ? 1 : -1;
  });
  
  const sortedToOriginal = sortedItems.map(item => 
    items.findIndex(original => original.id === item.id)
  );
  
  itemList.innerHTML = '';
  
  sortedItems.forEach((item, sortedIndex) => {
    const originalIndex = sortedToOriginal[sortedIndex];
    const isListed = listedItems.has(item.id);
    
    const itemDiv = document.createElement('div');
    itemDiv.className = isListed ? 'item listed' : 'item';
    itemDiv.dataset.index = originalIndex;
    
    const imageCount = item.images ? item.images.length : 0;
    const imageText = imageCount > 0 ? ` (${imageCount} image${imageCount > 1 ? 's' : ''})` : ' (no images)';
    
    itemDiv.innerHTML = `
      <div class="item-title">${escapeHtml(item.title || 'Untitled')}</div>
      <div class="item-details">
        <span class="item-price">$${item.price || 0}</span>
        <span>${escapeHtml(item.condition || 'N/A')}</span>
        ${item.size ? `<span>Size: ${escapeHtml(item.size)}</span>` : ''}
      </div>
      <div class="item-images">${imageText}</div>
    `;
    
    if (!isListed) {
      itemDiv.addEventListener('click', () => selectItem(originalIndex));
    }
    
    itemList.appendChild(itemDiv);
  });

  ensureDefaultItemSelection();
  updateFillControlsState();
}

function selectItem(index) {
  const item = items[index];

  if (listedItems.has(item.id)) {
    showStatus('This item has already been listed', 'error');
    return;
  }

  selectedItem = item;

  document.querySelectorAll('.item').forEach((itemEl) => {
    const itemIndex = parseInt(itemEl.dataset.index, 10);
    if (itemIndex === index) {
      itemEl.classList.add('selected');
    } else {
      itemEl.classList.remove('selected');
    }
  });

  updateFillControlsState();
}

function setupClearAllItems() {
  const btn = document.getElementById('clear-all-items-button');
  if (!btn || !window.StorageManager?.clearStoredItemsAndImages) return;

  btn.addEventListener('click', async () => {
    if (items.length === 0) return;
    const ok = confirm(
      'Remove all items and their stored images from this extension? This cannot be undone. Workshop settings (mapping, titles, description layout) are kept.'
    );
    if (!ok) return;

    try {
      await window.StorageManager.clearStoredItemsAndImages();
      items = [];
      selectedItem = null;
      listedItems = new Set();
      renderItems();
      updateFillControlsState();
      showStatus('All items cleared.', 'success');
    } catch (e) {
      showStatus('Could not clear items: ' + (e.message || String(e)), 'error');
      console.error(e);
    }
  });
}

function setupFillButton() {
  document.getElementById('fill-button').addEventListener('click', async () => {
    if (!selectedItem) {
      showStatus('Please select an item first', 'error');
      return;
    }
    if (listedItems.has(selectedItem.id)) {
      showStatus('This item is already marked as listed.', 'error');
      return;
    }

    await runFillPipelineForItem(selectedItem);
  });
}

function setupFillNextButton() {
  const btn = document.getElementById('fill-next-button');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const queue = getUnlistedIndicesInQueueOrder();
    if (queue.length === 0) {
      showStatus('No unlisted items left in the queue.', 'info');
      return;
    }

    const nextIndex = queue[0];
    const item = items[nextIndex];
    selectItem(nextIndex);
    await runFillPipelineForItem(item);
  });
}

function setupHideFriendsToggle() {
  const toggle = document.getElementById('hide-friends-toggle');
  if (!toggle) return;
  
  toggle.addEventListener('click', () => {
    hideFromFriends = !hideFromFriends;
    if (hideFromFriends) {
      toggle.classList.add('active');
      toggle.setAttribute('aria-checked', 'true');
    } else {
      toggle.classList.remove('active');
      toggle.setAttribute('aria-checked', 'false');
    }
  });
  
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle.click();
    }
  });
}

function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Use utility functions from utils.js
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

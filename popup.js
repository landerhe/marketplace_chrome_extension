let items = [];
let selectedItem = null;
let hideFromFriends = true; // Default to true
let listedItems = new Set();

// Load data.json and listed items when popup opens
async function loadData() {
  const itemList = document.getElementById('item-list');
  
  try {
    // Load listed items from storage
    try {
      const result = await chrome.storage.local.get('listedItems');
      if (result.listedItems) {
        listedItems = new Set(result.listedItems);
      }
    } catch (storageError) {
      console.warn('Error loading storage:', storageError);
    }
    
    // Try to load data.json
    const dataUrl = chrome.runtime.getURL('data.json');
    console.log('Loading data.json from:', dataUrl);
    
    // Add timeout to fetch
    const fetchPromise = fetch(dataUrl);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout after 5 seconds')), 5000)
    );
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data.json: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('Received data.json, length:', text.length);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Invalid JSON in data.json: ${parseError.message}`);
    }
    
    console.log('Loaded data.json, items count:', data.items?.length || 0);
    
    items = data.items || [];
    
    if (items.length === 0) {
      showStatus('No items found in data.json', 'error');
      itemList.innerHTML = '<div class="empty">No items available</div>';
      return;
    }
    
    renderItems();
  } catch (error) {
    console.error('Error loading data.json:', error);
    const errorMsg = error.message || 'Unknown error';
    showStatus('Error loading data.json: ' + errorMsg, 'error');
    itemList.innerHTML = `
      <div class="empty">
        <div>Error loading items</div>
        <div style="font-size: 0.75rem; margin-top: 0.5rem; color: #999;">${escapeHtml(errorMsg)}</div>
        <div style="font-size: 0.75rem; margin-top: 0.5rem; color: #999;">Check console for details (F12)</div>
        <div style="font-size: 0.75rem; margin-top: 0.5rem; color: #999;">Make sure data.json exists in the extension folder</div>
      </div>
    `;
  }
}

// Initialize hide from friends toggle to active (default true)
function initializeToggle() {
  const toggle = document.getElementById('hide-friends-toggle');
  if (toggle) {
    toggle.classList.add('active');
    toggle.setAttribute('aria-checked', 'true');
  }
}

// Try both DOMContentLoaded and immediate execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeToggle();
    loadData();
  });
} else {
  // DOM already loaded
  initializeToggle();
  loadData();
}

function renderItems() {
  const itemList = document.getElementById('item-list');
  itemList.innerHTML = '';
  
  // Sort items: unlisted first, then listed
  const sortedItems = [...items].sort((a, b) => {
    const aListed = listedItems.has(a.id);
    const bListed = listedItems.has(b.id);
    if (aListed === bListed) return 0;
    return aListed ? 1 : -1; // Listed items go to end
  });
  
  // Create a map of sorted index to original index
  const sortedToOriginal = sortedItems.map(item => 
    items.findIndex(original => original.id === item.id)
  );
  
  sortedItems.forEach((item, sortedIndex) => {
    const originalIndex = sortedToOriginal[sortedIndex];
    const isListed = listedItems.has(item.id);
    
    const itemDiv = document.createElement('div');
    itemDiv.className = isListed ? 'item listed' : 'item';
    itemDiv.dataset.index = originalIndex;
    itemDiv.dataset.sortedIndex = sortedIndex;
    
    itemDiv.innerHTML = `
      <div class="item-title">${escapeHtml(item.title || 'Untitled')}</div>
      <div class="item-details">
        <span class="item-price">$${item.price || 0}</span>
        <span>${item.condition || 'N/A'}</span>
        ${item.size ? `<span>Size: ${item.size}</span>` : ''}
      </div>
    `;
    
    if (!isListed) {
      itemDiv.addEventListener('click', () => selectItem(originalIndex));
    }
    
    itemList.appendChild(itemDiv);
  });
}

function selectItem(index) {
  const item = items[index];
  
  // Don't allow selection of listed items
  if (listedItems.has(item.id)) {
    showStatus('This item has already been listed', 'error');
    return;
  }
  
  selectedItem = item;
  
  // Update UI - need to find by original index
  document.querySelectorAll('.item').forEach((itemEl) => {
    const itemIndex = parseInt(itemEl.dataset.index);
    if (itemIndex === index) {
      itemEl.classList.add('selected');
    } else {
      itemEl.classList.remove('selected');
    }
  });
  
  document.getElementById('fill-button').disabled = false;
}

// Handle hide from friends toggle
document.getElementById('hide-friends-toggle').addEventListener('click', () => {
  hideFromFriends = !hideFromFriends;
  const toggle = document.getElementById('hide-friends-toggle');
  if (hideFromFriends) {
    toggle.classList.add('active');
    toggle.setAttribute('aria-checked', 'true');
  } else {
    toggle.classList.remove('active');
    toggle.setAttribute('aria-checked', 'false');
  }
});

// Allow keyboard activation
document.getElementById('hide-friends-toggle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    document.getElementById('hide-friends-toggle').click();
  }
});

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle fill button click
document.getElementById('fill-button').addEventListener('click', async () => {
  if (!selectedItem) {
    showStatus('Please select an item first', 'error');
    return;
  }
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on Facebook Marketplace create page
    if (!tab.url || !tab.url.includes('facebook.com')) {
      showStatus('Please navigate to Facebook Marketplace create page first', 'error');
      return;
    }
    
    // Check if we're on the create page specifically
    if (!tab.url.includes('marketplace/create')) {
      showStatus('Please navigate to the Marketplace create listing page', 'error');
      return;
    }
    
    // Send message to content script
    showStatus('Filling form...', 'info');
    document.getElementById('fill-button').disabled = true;
    
    // Try to inject content script if it's not already there
    // First, try to ping the content script to see if it's loaded
    let scriptLoaded = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      scriptLoaded = true;
    } catch (e) {
      // Script not loaded, try to inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 300));
        scriptLoaded = true;
      } catch (injectError) {
        console.error('Failed to inject script:', injectError);
        showStatus('Failed to load content script. Please refresh the page and try again.', 'error');
        document.getElementById('fill-button').disabled = false;
        return;
      }
    }
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      item: selectedItem,
      hideFromFriends: hideFromFriends
    }, async (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        if (errorMsg.includes('Receiving end does not exist')) {
          showStatus('Content script not loaded. Please refresh the page and try again.', 'error');
        } else {
          showStatus('Error: ' + errorMsg, 'error');
        }
        document.getElementById('fill-button').disabled = false;
        return;
      }
      
      if (response && response.success) {
        showStatus('Form filled successfully!', 'success');
        
        // Mark item as listed
        if (selectedItem && selectedItem.id) {
          listedItems.add(selectedItem.id);
          await chrome.storage.local.set({ listedItems: Array.from(listedItems) });
          
          // Re-render items to update UI
          renderItems();
          
          // Clear selection
          selectedItem = null;
          document.getElementById('fill-button').disabled = true;
        }
      } else {
        showStatus(response?.error || 'Failed to fill form', 'error');
      }
      
      document.getElementById('fill-button').disabled = false;
    });
  } catch (error) {
    console.error('Error filling form:', error);
    showStatus('Error: ' + error.message, 'error');
    document.getElementById('fill-button').disabled = false;
  }
});


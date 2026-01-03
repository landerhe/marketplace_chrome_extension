// Content script to fill Facebook Marketplace form

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    // Respond to ping to confirm script is loaded
    sendResponse({ loaded: true });
    return false;
  }
  
  if (request.action === 'fillForm') {
    fillForm(request.item, request.hideFromFriends)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  return false;
});

async function fillForm(item, hideFromFriends = false) {
  try {
    // Wait for form to be ready
    await waitForForm();
    
    // Fill fields in sequence
    await fillTitle(item.title);
    await fillPrice(item.price);
    await fillCategory(item.category);
    await fillCondition(item.condition);
    await fillDescription(item);
    await uploadImages(item.images);
    await setHideFromFriends(hideFromFriends);
    
    return { success: true };
  } catch (error) {
    console.error('Error filling form:', error);
    return { success: false, error: error.message };
  }
}

function waitForForm(maxAttempts = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkForm = () => {
      attempts++;
      const titleField = findTitleField();
      if (titleField) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('Form fields not found. Please make sure you are on the Marketplace create page.'));
      } else {
        setTimeout(checkForm, delay);
      }
    };
    checkForm();
  });
}

function findTitleField() {
  // Look for span with "Title" text, then find input in same container
  const titleSpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'title';
  });
  
  for (const span of titleSpans) {
    // Look for input in the same parent container
    const container = span.closest('label') || span.closest('div');
    if (container) {
      const input = container.querySelector('input[type="text"]');
      if (input) return input;
    }
  }
  
  // Fallback: try other selectors
  const selectors = [
    'input[type="text"][id*="title" i]',
    'input[type="text"][aria-label*="Title" i]'
  ];
  
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input) return input;
  }
  
  return null;
}

function findPriceField() {
  // Look for span with "Price" text, then find input in same container
  const priceSpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'price';
  });
  
  for (const span of priceSpans) {
    const container = span.closest('label') || span.closest('div');
    if (container) {
      const input = container.querySelector('input[type="text"]');
      if (input) return input;
    }
  }
  
  // Fallback
  const selectors = [
    'input[type="text"][id*="price" i]',
    'input[type="text"][aria-label*="Price" i]'
  ];
  
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input) return input;
  }
  
  return null;
}

function findCategoryField() {
  // Look for span with "Category" text, then find combobox in same container
  const categorySpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'category';
  });
  
  for (const span of categorySpans) {
    const container = span.closest('label') || span.closest('div');
    if (container) {
      const combobox = container.querySelector('[role="combobox"]');
      if (combobox) return combobox;
    }
  }
  
  // Fallback
  const selectors = [
    '[role="combobox"][aria-label*="Category" i]',
    '[role="combobox"][aria-labelledby*="category" i]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  
  return null;
}

function findConditionField() {
  // Look for span with "Condition" text, then find combobox in same container
  const conditionSpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'condition';
  });
  
  for (const span of conditionSpans) {
    const container = span.closest('label') || span.closest('div');
    if (container) {
      const combobox = container.querySelector('[role="combobox"]');
      if (combobox) return combobox;
    }
  }
  
  // Fallback
  const selectors = [
    '[role="combobox"][aria-label*="Condition" i]',
    '[role="combobox"][aria-labelledby*="condition" i]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  
  return null;
}

function findDescriptionField() {
  // Look for span with "Description" text, then find textarea in same container
  const descSpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'description';
  });
  
  for (const span of descSpans) {
    const container = span.closest('label') || span.closest('div');
    if (container) {
      const textarea = container.querySelector('textarea');
      if (textarea) return textarea;
    }
  }
  
  // Fallback
  const selectors = [
    'textarea[id*="description" i]',
    'textarea[aria-label*="Description" i]'
  ];
  
  for (const selector of selectors) {
    const textarea = document.querySelector(selector);
    if (textarea) return textarea;
  }
  
  return null;
}

function findImageInput() {
  const selectors = [
    'input[type="file"][accept*="image"]',
    'input[type="file"]'
  ];
  
  for (const selector of selectors) {
    const inputs = document.querySelectorAll(selector);
    for (const input of inputs) {
      const accept = input.getAttribute('accept') || '';
      if (accept.includes('image') || accept === '') {
        return input;
      }
    }
  }
  
  return null;
}

async function fillTitle(title) {
  if (!title) return;
  
  const field = findTitleField();
  if (!field) {
    console.warn('Title field not found');
    return;
  }
  
  field.value = title;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  
  await delay(200);
}

async function fillPrice(price) {
  if (!price && price !== 0) return;
  
  const field = findPriceField();
  if (!field) {
    console.warn('Price field not found');
    return;
  }
  
  field.value = price.toString();
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  
  await delay(200);
}

async function fillCategory(category) {
  const field = findCategoryField();
  if (!field) {
    console.warn('Category field not found');
    return;
  }
  
  // Use default category if not provided
  const categoryToUse = category || "Men's clothing & shoes";
  
  // Check if already selected
  const currentValue = field.textContent?.trim() || '';
  if (currentValue.toLowerCase().includes(categoryToUse.toLowerCase())) {
    console.log('Category already set to:', currentValue);
    return;
  }
  
  // Click to open dropdown
  field.click();
  await delay(600);
  
  // Wait for dropdown to appear
  await delay(300);
  
  // Try to find and click the category option
  const options = document.querySelectorAll('[role="option"], [role="listbox"] [role="option"], div[role="option"]');
  let found = false;
  
  for (const option of options) {
    const text = option.textContent?.trim().toLowerCase() || '';
    const searchText = categoryToUse.toLowerCase();
    
    // Try exact match or partial match
    if (text === searchText || text.includes(searchText) || searchText.includes(text)) {
      option.click();
      await delay(400);
      found = true;
      break;
    }
  }
  
  // If not found, try searching for common categories
  if (!found) {
    const commonCategories = [
      "men's clothing",
      "women's clothing",
      "clothing",
      "shoes",
      "accessories"
    ];
    
    for (const commonCat of commonCategories) {
      for (const option of options) {
        const text = option.textContent?.trim().toLowerCase() || '';
        if (text.includes(commonCat)) {
          option.click();
          await delay(400);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  
  // If still not found, close dropdown
  if (!found) {
    document.body.click();
    await delay(200);
    console.warn('Category option not found:', categoryToUse);
  }
}

async function fillCondition(condition) {
  const field = findConditionField();
  if (!field) {
    console.warn('Condition field not found');
    return;
  }
  
  // Map condition values to Facebook's condition options
  const conditionMap = {
    'worn': ['used – fair', 'used - fair', 'fair', 'used', 'good'],
    'rarely worn': ['used – like new', 'used - like new', 'like new', 'excellent', 'very good'],
    'new': ['new', 'new with tags', 'new without tags']
  };
  
  const conditionLower = (condition || 'worn').toLowerCase().trim();
  const searchTerms = conditionMap[conditionLower] || [conditionLower];
  
  // Check if already selected
  const currentValue = field.textContent?.trim() || '';
  for (const term of searchTerms) {
    if (currentValue.toLowerCase().includes(term)) {
      console.log('Condition already set to:', currentValue);
      return;
    }
  }
  
  // Click to open dropdown
  field.click();
  await delay(600);
  
  // Wait for dropdown to appear
  await delay(300);
  
  // Try to find and click the condition option
  const options = document.querySelectorAll('[role="option"], [role="listbox"] [role="option"], div[role="option"]');
  let found = false;
  
  for (const option of options) {
    const text = option.textContent?.trim().toLowerCase() || '';
    for (const term of searchTerms) {
      if (text === term || text.includes(term) || term.includes(text)) {
        option.click();
        await delay(400);
        found = true;
        break;
      }
    }
    if (found) break;
  }
  
  // If not found, try to select first available option as fallback
  if (!found && options.length > 0) {
    console.warn('Exact condition match not found, selecting first option');
    options[0].click();
    await delay(400);
    found = true;
  }
  
  // If still not found, close dropdown
  if (!found) {
    document.body.click();
    await delay(200);
    console.warn('Condition option not found for:', condition);
  }
}

async function fillDescription(item) {
  const parts = [];
  
  if (item.title) parts.push(item.title);
  if (item.size) parts.push(`Size: ${item.size}`);
  if (item.materials) parts.push(`Materials: ${item.materials}`);
  if (item.condition) parts.push(`Condition: ${item.condition}`);
  
  // Add the standard message about QR code
  parts.push('There are many items that I am selling in the QR provided');
  
  const description = parts.join('\n\n');
  if (!description) return;
  
  const field = findDescriptionField();
  if (!field) {
    console.warn('Description field not found');
    return;
  }
  
  field.value = description;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  
  await delay(200);
}

async function uploadImages(images) {
  const input = findImageInput();
  if (!input) {
    console.warn('Image input not found');
    return;
  }
  
  // Always include frame.png as the last image
  const allFiles = [];
  
  // Add item images first (limit to 9 to leave room for frame.png)
  if (images && images.length > 0) {
    const itemImages = images.slice(0, 9);
    
    try {
      const itemFiles = await Promise.all(
        itemImages.map(async (image) => {
          try {
            const imagePath = image.local || image.primary || image.fallback;
            if (!imagePath) return null;
            
            // Normalize path: remove leading ./ and ensure it starts with images/
            let normalizedPath = imagePath.replace(/^\.\//, '').replace(/^\//, '');
            if (!normalizedPath.startsWith('images/')) {
              normalizedPath = 'images/' + normalizedPath.replace(/^images\//, '');
            }
            
            // Convert relative path to extension URL
            const extensionUrl = chrome.runtime.getURL(normalizedPath);
            
            // Fetch image as blob
            const response = await fetch(extensionUrl);
            if (!response.ok) {
              console.warn(`Failed to fetch image: ${normalizedPath}`, response.status);
              return null;
            }
            
            const blob = await response.blob();
            
            // Get filename from path
            const filename = normalizedPath.split('/').pop() || 'image.jpg';
            
            // Create File object
            return new File([blob], filename, { type: blob.type || 'image/jpeg' });
          } catch (error) {
            console.error('Error processing image:', image, error);
            return null;
          }
        })
      );
      
      // Filter out nulls and add to allFiles
      const validItemFiles = itemFiles.filter(f => f !== null);
      allFiles.push(...validItemFiles);
    } catch (error) {
      console.error('Error processing item images:', error);
    }
  }
  
  // Add frame.png at the end
  try {
    const frameUrl = chrome.runtime.getURL('frame.png');
    const frameResponse = await fetch(frameUrl);
    if (frameResponse.ok) {
      const frameBlob = await frameResponse.blob();
      const frameFile = new File([frameBlob], 'frame.png', { type: frameBlob.type || 'image/png' });
      allFiles.push(frameFile);
    } else {
      console.warn('frame.png not found, skipping');
    }
  } catch (error) {
    console.warn('Error loading frame.png:', error);
  }
  
  if (allFiles.length === 0) {
    console.warn('No valid image files found');
    return;
  }
  
  // Create FileList
  const dataTransfer = new DataTransfer();
  allFiles.forEach(file => dataTransfer.items.add(file));
  
  // Assign to input
  input.files = dataTransfer.files;
  
  // Trigger change event
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  await delay(500);
}

function findHideFromFriendsCheckbox() {
  // Look for span with "Hide from friends" text, then find checkbox in same container
  const hideSpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'hide from friends';
  });
  
  for (const span of hideSpans) {
    // Look for checkbox in the same parent container
    const container = span.closest('div');
    if (container) {
      // Look for checkbox with role="switch" in the container or nearby
      const checkbox = container.querySelector('input[type="checkbox"][role="switch"]') ||
                       container.closest('div')?.querySelector('input[type="checkbox"][role="switch"]');
      if (checkbox) return checkbox;
      
      // Also try finding by traversing up and looking for checkbox
      let parent = container.parentElement;
      while (parent && parent !== document.body) {
        const checkbox = parent.querySelector('input[type="checkbox"][role="switch"]');
        if (checkbox) return checkbox;
        parent = parent.parentElement;
      }
    }
  }
  
  // Fallback: look for checkbox with aria-label containing "Hide" or "friends"
  const checkboxes = document.querySelectorAll('input[type="checkbox"][role="switch"]');
  for (const checkbox of checkboxes) {
    const ariaLabel = checkbox.getAttribute('aria-label')?.toLowerCase() || '';
    if (ariaLabel.includes('hide') || ariaLabel.includes('friend')) {
      return checkbox;
    }
  }
  
  return null;
}

async function setHideFromFriends(hideFromFriends) {
  if (hideFromFriends === undefined || hideFromFriends === null) return;
  
  const checkbox = findHideFromFriendsCheckbox();
  if (!checkbox) {
    console.warn('Hide from friends checkbox not found');
    return;
  }
  
  // Check if checkbox needs to be toggled
  const isChecked = checkbox.checked || checkbox.getAttribute('aria-checked') === 'true';
  
  if (hideFromFriends && !isChecked) {
    // Need to check it
    checkbox.click();
    await delay(300);
  } else if (!hideFromFriends && isChecked) {
    // Need to uncheck it
    checkbox.click();
    await delay(300);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


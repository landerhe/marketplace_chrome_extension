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
    
    // Reconstruct File objects from ArrayBuffers if needed
    let images = item.images || [];
    if (images.length > 0 && !(images[0] instanceof File)) {
      images = images.map(imgData => {
        if (imgData.arrayBuffer) {
          // Reconstruct File from ArrayBuffer
          const uint8Array = new Uint8Array(imgData.arrayBuffer);
          const blob = new Blob([uint8Array], { type: imgData.type || 'image/jpeg' });
          return new File([blob], imgData.filename, {
            type: imgData.type || 'image/jpeg',
            lastModified: imgData.lastModified || Date.now()
          });
        }
        return imgData;
      }).filter(f => f instanceof File);
    }
    
    // Fill fields in sequence
    await fillTitle(item.title);
    await fillPrice(item.price);
    await fillCategory(item.category);
    await fillCondition(item.condition);
    await fillDescription(item);
    await uploadImages(images);
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
  // Strategy 1: Find by aria-labelledby pointing to a span with "Category" text
  const categorySpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'category';
  });
  
  for (const span of categorySpans) {
    const spanId = span.id;
    if (spanId) {
      // Find label/combobox that references this span
      const field = document.querySelector(`label[aria-labelledby="${spanId}"][role="combobox"], 
                                            [role="combobox"][aria-labelledby="${spanId}"]`);
      if (field) return field;
    }
  }
  
  // Strategy 2: Find label with role="combobox" that contains "Category" span
  for (const span of categorySpans) {
    // Walk up the DOM to find the combobox
    let parent = span.parentElement;
    let depth = 0;
    while (parent && depth < 10) {
      if (parent.getAttribute('role') === 'combobox' || 
          (parent.tagName === 'LABEL' && parent.getAttribute('role') === 'combobox')) {
        return parent;
      }
      parent = parent.parentElement;
      depth++;
    }
  }
  
  // Strategy 3: Find all comboboxes and check their labels
  const allComboboxes = document.querySelectorAll('[role="combobox"]');
  for (const combobox of allComboboxes) {
    const labelledBy = combobox.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl && labelEl.textContent?.trim().toLowerCase() === 'category') {
        return combobox;
      }
    }
    const ariaLabel = combobox.getAttribute('aria-label')?.toLowerCase() || '';
    if (ariaLabel.includes('category')) {
      return combobox;
    }
    // Check if it contains a span with "Category"
    if (combobox.querySelector('span')?.textContent?.trim().toLowerCase() === 'category') {
      return combobox;
    }
  }
  
  return null;
}

function findConditionField() {
  // Strategy 1: Find by aria-labelledby pointing to a span with "Condition" text
  const conditionSpans = Array.from(document.querySelectorAll('span')).filter(el => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'condition';
  });
  
  for (const span of conditionSpans) {
    const spanId = span.id;
    if (spanId) {
      // Find label/combobox that references this span
      const field = document.querySelector(`label[aria-labelledby="${spanId}"][role="combobox"], 
                                            [role="combobox"][aria-labelledby="${spanId}"]`);
      if (field) return field;
    }
  }
  
  // Strategy 2: Find label with role="combobox" that contains "Condition" span
  for (const span of conditionSpans) {
    // Walk up the DOM to find the combobox
    let parent = span.parentElement;
    let depth = 0;
    while (parent && depth < 10) {
      if (parent.getAttribute('role') === 'combobox' || 
          (parent.tagName === 'LABEL' && parent.getAttribute('role') === 'combobox')) {
        return parent;
      }
      parent = parent.parentElement;
      depth++;
    }
  }
  
  // Strategy 3: Find all comboboxes and check their labels
  const allComboboxes = document.querySelectorAll('[role="combobox"]');
  for (const combobox of allComboboxes) {
    const labelledBy = combobox.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl && labelEl.textContent?.trim().toLowerCase() === 'condition') {
        return combobox;
      }
    }
    const ariaLabel = combobox.getAttribute('aria-label')?.toLowerCase() || '';
    if (ariaLabel.includes('condition')) {
      return combobox;
    }
    // Check if it contains a span with "Condition"
    if (combobox.querySelector('span')?.textContent?.trim().toLowerCase() === 'condition') {
      return combobox;
    }
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

// Helper function to normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  // Decode HTML entities
  const temp = document.createElement('div');
  temp.innerHTML = text;
  let decoded = temp.textContent || temp.innerText || '';
  // Normalize: lowercase, trim, collapse whitespace
  return decoded.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Simplified function to select dropdown option
async function selectDropdownOption(fieldName, valueToSelect) {
  if (!valueToSelect || !valueToSelect.trim()) {
    return false;
  }
  
  // Find the field
  const field = fieldName === 'category' ? findCategoryField() : findConditionField();
  if (!field) {
    console.warn(`${fieldName} field not found`);
    return false;
  }
  
  const searchValue = normalizeText(valueToSelect.trim());
  
  // Check if already selected by looking at the displayed value
  const displayedSpan = field.querySelector('span.x6ikm8r, span[class*="x6ikm8r"]');
  if (displayedSpan) {
    const currentText = displayedSpan.textContent?.trim();
    if (currentText && currentText !== '&nbsp;') {
      if (normalizeText(currentText) === searchValue) {
        console.log(`${fieldName} already set to:`, currentText);
        return true;
      }
    }
  }
  
  // Open the dropdown by clicking
  field.click();
  await delay(1000); // Give time for dropdown to render
  
  // Wait for dropdown menu to appear - check for both dialog and listbox patterns
  let dropdownMenu = null;
  for (let i = 0; i < 10; i++) {
    // Check for dialog pattern (used by category)
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of dialogs) {
      const ariaLabel = (dialog.getAttribute('aria-label') || '').toLowerCase();
      const rect = dialog.getBoundingClientRect();
      if ((ariaLabel.includes('drop-down menu') || ariaLabel.includes('dropdown')) &&
          rect.width > 0 && rect.height > 0) {
        dropdownMenu = dialog;
        break;
      }
    }
    
    // Check for listbox pattern (used by condition)
    if (!dropdownMenu) {
      const listboxes = document.querySelectorAll('[role="listbox"]');
      for (const listbox of listboxes) {
        const rect = listbox.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          dropdownMenu = listbox;
          break;
        }
      }
    }
    
    // Also check for any visible dropdown container near the field
    if (!dropdownMenu) {
      const fieldRect = field.getBoundingClientRect();
      const allDropdowns = document.querySelectorAll('[role="dialog"], [role="listbox"]');
      for (const dropdown of allDropdowns) {
        const rect = dropdown.getBoundingClientRect();
        // Check if dropdown is visible and positioned near the field
        if (rect.width > 0 && rect.height > 0 && 
            Math.abs(rect.top - fieldRect.bottom) < 500) {
          dropdownMenu = dropdown;
          break;
        }
      }
    }
    
    if (dropdownMenu) break;
    await delay(200);
  }
  
  if (!dropdownMenu) {
    console.warn(`${fieldName} dropdown did not open`);
    console.log('Field found:', field);
    console.log('Field aria-haspopup:', field.getAttribute('aria-haspopup'));
    return false;
  }
  
  console.log(`${fieldName} dropdown opened, type:`, dropdownMenu.getAttribute('role'));
  
  // Find all clickable options - try multiple patterns
  let options = [];
  
  // Pattern 1: role="button" inside dialog (category pattern)
  const allButtons = dropdownMenu.querySelectorAll('[role="button"]:not([aria-disabled="true"])');
  options = Array.from(allButtons).filter(btn => {
    // Skip headers
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const text = (btn.textContent || '').toLowerCase();
    return !ariaLabel.includes('header') && !text.includes('header');
  });
  
  // Pattern 2: role="option" inside listbox (condition pattern)
  if (options.length === 0) {
    const allOptions = dropdownMenu.querySelectorAll('[role="option"]:not([aria-disabled="true"])');
    options = Array.from(allOptions);
  }
  
  // Pattern 3: Any clickable div with tabindex
  if (options.length === 0) {
    const clickableDivs = dropdownMenu.querySelectorAll('div[tabindex="0"], div[tabindex="0"]');
    options = Array.from(clickableDivs).filter(div => {
      const text = (div.textContent || '').toLowerCase();
      return !text.includes('header') && text.trim().length > 0;
    });
  }
  
  console.log(`Found ${options.length} ${fieldName} options`);
  
  if (options.length === 0) {
    console.warn(`No ${fieldName} options found in dropdown`);
    console.log('Dropdown HTML:', dropdownMenu.outerHTML.substring(0, 500));
    // Close dropdown
    document.body.click();
    return false;
  }
  
  // Find matching option
  let selected = false;
  for (const option of options) {
    // Extract the main text from the option - try multiple methods
    let optionText = '';
    
    // Method 1: Look for span with dir="auto" (most common pattern)
    const textSpans = option.querySelectorAll('span[dir="auto"]');
    for (const span of textSpans) {
      const text = span.textContent?.trim();
      if (text && 
          !text.toLowerCase().includes('header') &&
          !text.toLowerCase().includes('delivery available') &&
          text.length > 0) {
        optionText = text;
        break;
      }
    }
    
    // Method 2: Look for span with specific classes that contain text
    if (!optionText) {
      const allSpans = option.querySelectorAll('span');
      for (const span of allSpans) {
        const text = span.textContent?.trim();
        // Skip if it's just whitespace, header, or metadata
        if (text && 
            text.length > 0 &&
            !text.match(/^[\s\u00A0]*$/) &&
            !text.toLowerCase().includes('header') &&
            !text.toLowerCase().includes('delivery available')) {
          // Prefer spans that look like main text (not too short, not just punctuation)
          if (text.length > 2 && !text.match(/^[^\w]*$/)) {
            optionText = text;
            break;
          }
        }
      }
    }
    
    // Method 3: Use all text but clean it (last resort)
    if (!optionText) {
      optionText = option.textContent?.trim() || '';
      // Remove common metadata
      optionText = optionText
        .replace(/delivery available/gi, '')
        .replace(/header/gi, '')
        .trim();
    }
    
    if (!optionText || optionText.length === 0) continue;
    
    // Compare normalized texts
    const normalizedOption = normalizeText(optionText);
    console.log(`Comparing "${normalizedOption}" with "${searchValue}"`);
    
    if (normalizedOption === searchValue ||
        normalizedOption.includes(searchValue) ||
        searchValue.includes(normalizedOption)) {
      console.log(`Match found! Clicking option: "${optionText}"`);
      // Click the option
      option.click();
      await delay(600);
      
      // Dispatch change event on the field to ensure Facebook detects it
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      field.dispatchEvent(changeEvent);
      
      // Also try input event
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      field.dispatchEvent(inputEvent);
      
      selected = true;
      break;
    }
  }
  
  if (!selected) {
    console.warn(`${fieldName} option not found for:`, valueToSelect);
    console.log(`Searching for normalized value: "${searchValue}"`);
    
    // Log available options for debugging
    const availableOptions = [];
    for (const opt of options) {
      // Try to extract text the same way we do for matching
      let text = '';
      const textSpans = opt.querySelectorAll('span[dir="auto"]');
      for (const span of textSpans) {
        const spanText = span.textContent?.trim();
        if (spanText && 
            !spanText.toLowerCase().includes('header') &&
            !spanText.toLowerCase().includes('delivery available') &&
            spanText.length > 0) {
          text = spanText;
          break;
        }
      }
      if (!text) {
        text = opt.textContent?.trim() || '';
        text = text.replace(/delivery available/gi, '').replace(/header/gi, '').trim();
      }
      if (text) {
        availableOptions.push({
          text: text,
          normalized: normalizeText(text),
          element: opt
        });
      }
    }
    
    console.log(`Available ${fieldName} options (${availableOptions.length}):`);
    availableOptions.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. "${opt.text}" (normalized: "${opt.normalized}")`);
    });
    
    // Close dropdown
    document.body.click();
  }
  
  return selected;
}

async function fillCategory(category) {
  await selectDropdownOption('category', category);
}

async function fillCondition(condition) {
  await selectDropdownOption('condition', condition);
}

const DEFAULT_DESCRIPTION_PART_ORDER = [
  'title',
  'size',
  'materials',
  'condition',
  'csvDescription',
  'custom'
];

async function fillDescription(item) {
  let order;
  let customDescription = '';
  try {
    const settings = await chrome.storage.local.get('extensionSettings');
    const ext = settings.extensionSettings || {};
    customDescription = ext.customDescription || '';
    order = Array.isArray(ext.descriptionPartOrder) ? ext.descriptionPartOrder : null;
  } catch (error) {
    console.warn('Error loading description settings:', error);
    order = null;
  }
  if (order === null || order === undefined) {
    order = DEFAULT_DESCRIPTION_PART_ORDER;
  }

  const DA = window.DescriptionAssembly;
  const description = DA
    ? DA.buildMarketplaceDescription(order, item, customDescription)
    : '';
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

// Convert image to JPEG using Canvas (for unsupported formats)
async function convertToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // White background for transparency
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Conversion failed'));
          return;
        }
        const jpegFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        resolve(jpegFile);
      }, 'image/jpeg', 0.95);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

// Ensure file is in Facebook-supported format
async function ensureSupportedFormat(file) {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  // If not supported, convert to JPEG
  if (!supportedTypes.includes(file.type)) {
    console.log(`Converting ${file.name} (${file.type}) to JPEG`);
    return await convertToJpeg(file);
  }
  
  // Ensure proper MIME type
  let mimeType = file.type;
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'gif') mimeType = 'image/gif';
    else mimeType = 'image/jpeg';
  }
  
  // If type changed, create new File object
  if (file.type !== mimeType) {
    return new File([file], file.name, {
      type: mimeType,
      lastModified: file.lastModified || Date.now()
    });
  }
  
  return file;
}

async function uploadImages(images) {
  const input = findImageInput();
  if (!input) {
    console.warn('Image input not found');
    return;
  }
  
  const allFiles = [];
  
  // Add item images (Facebook allows up to 10 images)
  if (images && images.length > 0) {
    const itemImages = images.slice(0, 10);
    
    try {
      for (const image of itemImages) {
        try {
          // Image should be a File object passed from popup
          let file = null;
          
          if (image instanceof File) {
            // Direct File object
            file = image;
          } else if (image.blob instanceof Blob) {
            // Has blob property - convert to File
            const filename = image.filename || 'image.jpg';
            file = new File([image.blob], filename, {
              type: image.blob.type || 'image/jpeg',
              lastModified: Date.now()
            });
          } else {
            console.warn('Invalid image format:', image);
            continue;
          }
          
          // Ensure supported format
          file = await ensureSupportedFormat(file);
          
          // Validate
          if (file.size === 0 || file.size > 10 * 1024 * 1024) {
            console.warn(`Skipping invalid file: ${file.name}, size: ${file.size}`);
            continue;
          }
          
          console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${(file.size/1024).toFixed(2)}KB`);
          allFiles.push(file);
        } catch (error) {
          console.error('Error processing image:', error);
        }
      }
    } catch (error) {
      console.error('Error processing item images:', error);
    }
  }
  
  if (allFiles.length === 0) {
    console.warn('No valid image files found');
    return;
  }
  
  if (allFiles.length === 0) {
    console.warn('No files to upload');
    return;
  }
  
  // Validate files
  const validFiles = allFiles.filter(file => {
    if (!(file instanceof File)) {
      console.warn('Not a File object:', file);
      return false;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      console.warn(`Invalid size for ${file.name}: ${file.size}`);
      return false;
    }
    return true;
  });
  
  if (validFiles.length === 0) {
    console.error('No valid files');
    return;
  }
  
  console.log(`Uploading ${validFiles.length} files`);
  validFiles.forEach((f, i) => {
    console.log(`  ${i+1}. ${f.name} (${f.type}, ${(f.size/1024).toFixed(2)}KB)`);
  });
  
  // Use DataTransfer to set files
  const dataTransfer = new DataTransfer();
  validFiles.forEach(file => {
    dataTransfer.items.add(file);
  });
  
  // Set files on input
  input.files = dataTransfer.files;
  
  // Trigger events
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  
  await delay(800);
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


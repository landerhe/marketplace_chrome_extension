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
    await delay(300);
    await fillCategory(item.category);
    await delay(200);
    await fillCondition(item.condition);
    await fillDescription(item);
    await uploadImages(images);

    const lm = parseListingManagementFlags(item.listingManagement);
    let effectiveHide = hideFromFriends;
    if (lm.hideFromFriends === true) {
      effectiveHide = true;
    }

    await fillMoreDetailsSection(item);

    await setHideFromFriends(effectiveHide);
    if (lm.turnOffCommenting) {
      await setTurnOffCommenting(true);
    }

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

/**
 * Facebook often uses aria-labelledby="id1 id2" (multiple IDs). getElementById(labelledBy) fails for that.
 */
function comboboxLabelMatches(combobox, labelLower) {
  const labelledBy = combobox.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref && ref.textContent?.trim().toLowerCase() === labelLower) {
        return true;
      }
    }
  }
  const ariaLabel = combobox.getAttribute('aria-label')?.trim().toLowerCase() || '';
  if (ariaLabel === labelLower || ariaLabel.startsWith(labelLower + ' ')) {
    return true;
  }
  return false;
}

function findComboboxByLabelText(labelLower) {
  const labelSpans = Array.from(document.querySelectorAll('span')).filter((el) => {
    return el.textContent?.trim().toLowerCase() === labelLower;
  });
  for (const span of labelSpans) {
    const box = span.closest('[role="combobox"]');
    if (box) return box;
    let parent = span.parentElement;
    for (let d = 0; d < 14 && parent; d++) {
      if (parent.getAttribute('role') === 'combobox') {
        return parent;
      }
      parent = parent.parentElement;
    }
  }

  for (const combobox of document.querySelectorAll('[role="combobox"]')) {
    if (comboboxLabelMatches(combobox, labelLower)) {
      return combobox;
    }
  }
  return null;
}

function findCategoryField() {
  return findComboboxByLabelText('category');
}

function findConditionField() {
  return findComboboxByLabelText('condition');
}

function findAvailabilityField() {
  return findComboboxByLabelText('availability');
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

function normalizeForDropdownMatch(text) {
  let n = normalizeText(text).replace(/[\u2013\u2014\u2212\-]/g, '-');
  n = n.replace(/[\u2018\u2019\u201a\u201b`]/g, "'");
  return n;
}

function getComboboxDisplayedValueText(field, labelLower) {
  const spans = field.querySelectorAll('span[dir="auto"], span.x6ikm8r, span[class*="x6ikm8r"]');
  let best = '';
  for (const sp of spans) {
    const t = sp.textContent?.trim();
    if (!t || t === '\u00a0' || t === '&nbsp;') continue;
    const tl = t.toLowerCase();
    if (tl === labelLower) continue;
    if (t.length > best.length) best = t;
  }
  return best;
}

function distanceBelowFieldCenter(field, rect) {
  const fr = field.getBoundingClientRect();
  const ax = fr.left + fr.width / 2;
  const ay = fr.bottom;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top;
  return Math.hypot(cx - ax, cy - ay);
}

function findOpenDropdownPortal(field, fieldName) {
  if (fieldName === 'category') {
    let best = null;
    let bestScore = 1e9;
    for (const dialog of document.querySelectorAll('[role="dialog"]')) {
      const r = dialog.getBoundingClientRect();
      if (r.width < 80 || r.height < 80) continue;
      const buttons = dialog.querySelectorAll('[role="button"]');
      if (buttons.length < 2) continue;
      const al = (dialog.getAttribute('aria-label') || '').toLowerCase();
      const dist = distanceBelowFieldCenter(field, r);
      const labelBonus =
        al.includes('drop') || al.includes('menu') || al.includes('list') ? 0 : 250;
      const score = dist + labelBonus;
      if (score < bestScore) {
        bestScore = score;
        best = dialog;
      }
    }
    return best;
  }

  let bestLb = null;
  let bestD = 1e9;
  for (const lb of document.querySelectorAll('[role="listbox"]')) {
    const r = lb.getBoundingClientRect();
    if (r.width < 40 || r.height < 30) continue;
    if (lb.querySelectorAll('[role="option"]').length === 0) continue;
    const d = distanceBelowFieldCenter(field, r);
    if (d < bestD) {
      bestD = d;
      bestLb = lb;
    }
  }
  return bestLb;
}

async function clickToOpenCombobox(field) {
  field.scrollIntoView({ block: 'center', behavior: 'instant' });
  await delay(100);
  const inner =
    field.querySelector('[tabindex="0"]') ||
    field.querySelector('[role="button"]') ||
    field.querySelector('[tabindex="-1"]') ||
    field;
  if (inner.focus) {
    try {
      inner.focus({ preventScroll: true });
    } catch (e) {
      inner.focus();
    }
  }
  inner.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })
  );
  inner.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })
  );
  inner.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
  );
}

// Simplified function to select dropdown option
async function selectDropdownOption(fieldName, valueToSelect) {
  if (!valueToSelect || !valueToSelect.trim()) {
    return false;
  }
  
  // Find the field
  let field = null;
  if (fieldName === 'category') field = findCategoryField();
  else if (fieldName === 'condition') field = findConditionField();
  else if (fieldName === 'availability') field = findAvailabilityField();
  if (!field) {
    console.warn(`${fieldName} field not found`);
    return false;
  }
  
  const searchValue = normalizeForDropdownMatch(valueToSelect.trim());
  const labelLower = fieldName;

  const currentDisplayed = getComboboxDisplayedValueText(field, labelLower);
  if (currentDisplayed) {
    if (normalizeForDropdownMatch(currentDisplayed) === searchValue) {
      console.log(`${fieldName} already set to:`, currentDisplayed);
      return true;
    }
  }
  
  await clickToOpenCombobox(field);
  await delay(600);
  
  // Wait for dropdown menu — prefer portal closest to this combobox (avoids wrong listbox/dialog)
  let dropdownMenu = null;
  for (let i = 0; i < 12; i++) {
    dropdownMenu = findOpenDropdownPortal(field, fieldName);
    if (dropdownMenu) break;

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
    
    if (!dropdownMenu) {
      const fieldRect = field.getBoundingClientRect();
      const allDropdowns = document.querySelectorAll('[role="dialog"], [role="listbox"]');
      for (const dropdown of allDropdowns) {
        const rect = dropdown.getBoundingClientRect();
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
    field.click();
    await delay(400);
    dropdownMenu = findOpenDropdownPortal(field, fieldName);
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
  options = Array.from(allButtons).filter((btn) => {
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const text = (btn.textContent || '').toLowerCase();
    if (ariaLabel.includes('header') || text.includes('header')) return false;
    if (fieldName === 'category' && btn.querySelector('[aria-label*="Header"]')) return false;
    return true;
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
    const normalizedOption = normalizeForDropdownMatch(optionText);
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
          normalized: normalizeForDropdownMatch(text),
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

function findMoreDetailsToggle() {
  for (const btn of document.querySelectorAll('[role="button"]')) {
    const t = btn.textContent || '';
    if (t.includes('Attract more interest by including more details')) {
      return btn;
    }
  }
  for (const btn of document.querySelectorAll('[role="button"]')) {
    const t = (btn.textContent || '').trim();
    if (/^more details$/i.test(t) || (t.startsWith('More details') && t.length < 100)) {
      return btn;
    }
  }
  return null;
}

async function ensureMoreDetailsExpanded() {
  const btn = findMoreDetailsToggle();
  if (!btn) {
    console.warn('More details toggle not found');
    return false;
  }
  if (btn.getAttribute('aria-expanded') === 'true') {
    return true;
  }
  btn.click();
  await delay(700);
  return true;
}

function findProductTagsTextarea() {
  const spans = Array.from(document.querySelectorAll('span')).filter((el) => {
    const text = el.textContent?.trim().toLowerCase();
    return text === 'product tags';
  });
  for (const span of spans) {
    const label = span.closest('label');
    if (label) {
      const ta = label.querySelector('textarea');
      if (ta) return ta;
    }
    let parent = span.parentElement;
    for (let d = 0; d < 8 && parent; d++) {
      const ta = parent.querySelector('textarea');
      if (ta) return ta;
      parent = parent.parentElement;
    }
  }
  return null;
}

async function fillProductTagsField(tags) {
  const ta = findProductTagsTextarea();
  if (!ta) {
    console.warn('Product tags field not found');
    return;
  }
  ta.value = String(tags).trim();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));
  await delay(200);
}

function parseMeetupCsv(csv) {
  const s = String(csv).toLowerCase();
  return {
    publicMeetup: /\bpublic\s+meetup\b/.test(s) || s.includes('public meetup'),
    doorPickup:
      /\bdoor\s+pick/.test(s) ||
      (s.includes('pick-up') && !/\bdoor\s+drop\b/.test(s) && !s.includes('drop-off')),
    doorDropoff: /\bdoor\s+drop\b/.test(s) || s.includes('drop-off') || s.includes('drop off')
  };
}

function findMeetupCheckboxByLabel(needle) {
  const lower = needle.toLowerCase();
  for (const el of document.querySelectorAll('[role="checkbox"]')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const t = (el.textContent || '').toLowerCase();
    if (t.includes(lower)) return el;
  }
  return null;
}

async function setRoleCheckboxWantedState(el, want) {
  if (!el) return;
  const checked = el.getAttribute('aria-checked') === 'true';
  if (checked === want) return;
  el.click();
  await delay(250);
}

async function setMeetupCheckboxesFromCsv(csv) {
  const flags = parseMeetupCsv(csv);
  await setRoleCheckboxWantedState(findMeetupCheckboxByLabel('public meetup'), flags.publicMeetup);
  await setRoleCheckboxWantedState(findMeetupCheckboxByLabel('door pick-up'), flags.doorPickup);
  await setRoleCheckboxWantedState(findMeetupCheckboxByLabel('door drop-off'), flags.doorDropoff);
}

function parseListingManagementFlags(raw) {
  if (!raw || !String(raw).trim()) {
    return { hideFromFriends: null, turnOffCommenting: false };
  }
  const s = String(raw).toLowerCase();
  const hideFromFriends = s.includes('hide from friends') ? true : null;
  const turnOffCommenting = /turn off commenting/.test(s);
  return { hideFromFriends, turnOffCommenting };
}

function findTurnOffCommentingControl() {
  const spans = Array.from(document.querySelectorAll('span')).filter(
    (el) => el.textContent?.trim().toLowerCase() === 'turn off commenting'
  );
  for (const span of spans) {
    let parent = span.parentElement;
    for (let d = 0; d < 14 && parent; d++) {
      const sw =
        parent.querySelector('input[type="checkbox"][role="switch"]') ||
        parent.querySelector('[role="switch"]');
      if (sw) return sw;
      parent = parent.parentElement;
    }
  }
  return null;
}

async function setTurnOffCommenting(wantOn) {
  if (!wantOn) return;
  const c = findTurnOffCommentingControl();
  if (!c) {
    console.warn('Turn off commenting control not found');
    return;
  }
  const checked = c.checked || c.getAttribute('aria-checked') === 'true';
  if (!checked) {
    c.click();
    await delay(300);
  }
}

async function fillMoreDetailsTextInputByLabel(labelVariants, value) {
  if (!value || !String(value).trim()) return;
  const want = new Set(labelVariants.map((v) => v.toLowerCase()));
  for (const lab of document.querySelectorAll('label')) {
    if (lab.getAttribute('role') === 'combobox') continue;
    const spans = lab.querySelectorAll('span');
    let matched = false;
    for (const sp of spans) {
      const t = sp.textContent?.trim().toLowerCase();
      if (t && want.has(t)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;
    const input = lab.querySelector('input[type="text"]');
    if (!input || input.getAttribute('role') === 'combobox') continue;
    const aria = (input.getAttribute('aria-label') || '').toLowerCase();
    if (aria === 'location' || aria.includes('location')) continue;
    input.value = String(value).trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await delay(120);
    return;
  }
}

/**
 * Category-specific More details: Size, Colour, Brand, SKU as plain text inputs.
 * Never touches Material combobox — CSV "materials" stays for description assembly only.
 */
async function fillMoreDetailsCategoryTextFields(item) {
  if (item.size && String(item.size).trim()) {
    await fillMoreDetailsTextInputByLabel(['size'], item.size);
  }
  if (item.colour && String(item.colour).trim()) {
    await fillMoreDetailsTextInputByLabel(['colour', 'color'], item.colour);
  }
  if (item.listingBrand && String(item.listingBrand).trim()) {
    await fillMoreDetailsTextInputByLabel(['brand'], item.listingBrand);
  }
  if (item.sku && String(item.sku).trim()) {
    await fillMoreDetailsTextInputByLabel(['sku'], item.sku);
  }
}

async function fillMoreDetailsSection(item) {
  const hasCategoryTexts =
    (item.size && String(item.size).trim()) ||
    (item.colour && String(item.colour).trim()) ||
    (item.listingBrand && String(item.listingBrand).trim()) ||
    (item.sku && String(item.sku).trim());
  const hasExtra =
    hasCategoryTexts ||
    (item.availability && String(item.availability).trim()) ||
    (item.productTags && String(item.productTags).trim()) ||
    (item.localTransactionOptions && String(item.localTransactionOptions).trim());
  if (!hasExtra) return;

  await ensureMoreDetailsExpanded();
  await delay(550);

  await fillMoreDetailsCategoryTextFields(item);
  await delay(200);

  if (item.availability && String(item.availability).trim()) {
    await selectDropdownOption('availability', item.availability);
    await delay(300);
  }
  if (item.productTags && String(item.productTags).trim()) {
    await fillProductTagsField(item.productTags);
  }
  if (item.localTransactionOptions && String(item.localTransactionOptions).trim()) {
    await setMeetupCheckboxesFromCsv(item.localTransactionOptions);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


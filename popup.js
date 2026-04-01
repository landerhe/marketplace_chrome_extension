// Popup script - handles CSV upload, image upload, and item selection

let items = [];
let selectedItem = null;
let hideFromFriends = true;
let listedItems = new Set();
let csvData = null;
let uploadedImages = [];
let currentTab = 'csv';
let fillOperationInProgress = false;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Check if required modules are loaded
function checkModules() {
  console.log('Checking modules...');
  console.log('window.CSVParser:', typeof window.CSVParser);
  console.log('window.StorageManager:', typeof window.StorageManager);
  console.log('window.FieldMapper:', typeof window.FieldMapper);
  console.log('window.ImageMatcher:', typeof window.ImageMatcher);
  console.log('window.ImageUrlImporter:', typeof window.ImageUrlImporter);

  if (!window.ImageMatcher) {
    console.error('ImageMatcher module not loaded!');
  }
  if (!window.ImageUrlImporter) {
    console.error('ImageUrlImporter module not loaded!');
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

  setupTabs();
  setupCSVUpload();
  setupImageUpload();
  setupFillButton();
  setupFillNextButton();
  setupClearAllItems();
  setupHideFriendsToggle();
  setupSettings();

  document.getElementById('field-mapping-list').addEventListener('change', updateProcessCsvButtonHint);

  // Try to load existing items
  await loadItems();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    if (t.dataset.tab === tabName) {
      t.classList.add('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
    if (content.id === `tab-${tabName}`) {
      content.classList.add('active');
    }
  });
  
  // Load items if switching to items tab
  if (tabName === 'items') {
    renderItems();
  }
}

function setupCSVUpload() {
  const csvInput = document.getElementById('csv-file-input');
  const csvSection = document.getElementById('csv-upload-section');
  const processButton = document.getElementById('process-csv-button');
  
  csvInput.addEventListener('change', handleCSVFileSelect);
  processButton.addEventListener('click', processCSV);
  
  // Drag and drop
  csvSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvSection.classList.add('drag-over');
  });
  
  csvSection.addEventListener('dragleave', () => {
    csvSection.classList.remove('drag-over');
  });
  
  csvSection.addEventListener('drop', (e) => {
    e.preventDefault();
    csvSection.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.includes('csv') || files[0].name.endsWith('.csv')) {
      csvInput.files = files;
      handleCSVFileSelect({ target: csvInput });
    }
  });
}

async function handleCSVFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
    showStatus('Please select a valid CSV file (.csv or .txt)', 'error');
    return;
  }
  
  // Check file size (limit to 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showStatus('CSV file is too large. Maximum size is 10MB.', 'error');
    return;
  }
  
  const fileList = document.getElementById('csv-file-list');
  fileList.innerHTML = `<div class="file-item">📄 ${escapeHtml(file.name)} (${formatFileSize(file.size)})</div>`;
  fileList.style.display = 'block';
  
  document.getElementById('csv-upload-section').classList.add('has-files');
  
  try {
    showStatus('Reading CSV file...', 'info');
    const text = await window.CSVParser.fileToText(file);
    
    if (!text || text.trim().length === 0) {
      throw new Error('CSV file is empty');
    }
    
    csvData = window.CSVParser.parseCSV(text);
    
    // Validate CSV structure
    if (!csvData.headers || csvData.headers.length === 0) {
      throw new Error('CSV file has no headers. Please check the file format.');
    }
    
    if (csvData.rows.length === 0) {
      throw new Error('CSV file has no data rows. Please check the file format.');
    }
    
    // Show field mapping
    showFieldMapping(csvData.headers);
    document.getElementById('process-csv-button').style.display = 'block';
    updateProcessCsvButtonHint();
    showStatus(
      `CSV loaded: ${csvData.rows.length} rows. Scroll down in this popup: check field mapping (set Image URLs to your pics column if needed), then click Process CSV.`,
      'success'
    );
  } catch (error) {
    showStatus('Error parsing CSV: ' + error.message, 'error');
    console.error('CSV parse error:', error);
    csvData = null;
    document.getElementById('process-csv-button').style.display = 'none';
    const ph = document.getElementById('process-csv-hint');
    if (ph) ph.style.display = 'none';
  }
}

function updateProcessCsvButtonHint() {
  const btn = document.getElementById('process-csv-button');
  const hint = document.getElementById('process-csv-hint');
  const sel = document.querySelector('select[data-field="imageUrls"]');
  if (!btn || btn.style.display === 'none') {
    if (hint) hint.style.display = 'none';
    return;
  }
  if (!sel) {
    btn.textContent = 'Process CSV';
    if (hint) hint.style.display = 'none';
    return;
  }
  if (sel.value === '') {
    btn.textContent = 'Process CSV';
    if (hint) {
      hint.style.display = 'block';
      hint.textContent =
        'Match columns above, then click Process CSV. For link-based images, choose the Image URLs column first—the button label will change when URLs will be fetched.';
    }
  } else {
    btn.textContent = 'Process CSV & fetch images';
    if (hint) {
      hint.style.display = 'block';
      hint.textContent =
        'Comma-separated http(s) or Google Drive links in that column are downloaded into this extension when you click the button (no separate download step).';
    }
  }
}

function showFieldMapping(headers) {
  const mappingSection = document.getElementById('field-mapping-section');
  const mappingList = document.getElementById('field-mapping-list');
  
  const { mapping, unmappedColumns, suggestedImageUrlsColumn } = window.FieldMapper.mapCSVHeaders(headers);
  
  mappingList.innerHTML = '';

  const intro = document.createElement('div');
  intro.className = 'field-mapping-intro';
  intro.innerHTML =
    '<strong>Next step:</strong> confirm each dropdown, then click <strong>Process CSV</strong> at the bottom. ' +
    'There is no separate &quot;download images&quot; button—image links are fetched during that step if <strong>Image URLs</strong> is set.';
  mappingList.appendChild(intro);
  
  // Show mapped fields
  const facebookFields = ['title', 'price', 'category', 'condition', 'description', 'size', 'materials'];
  facebookFields.forEach(field => {
    const row = document.createElement('div');
    row.className = 'field-mapping-row';
    
    const label = document.createElement('div');
    label.className = 'field-mapping-label';
    label.textContent = window.FieldMapper.getFieldDisplayName(field) + ':';
    
    const select = document.createElement('select');
    select.className = 'field-mapping-select';
    select.dataset.field = field;
    
    // Add empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '(None)';
    select.appendChild(emptyOption);
    
    // Add CSV columns
    headers.forEach((header, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = header;
      if (mapping[field] === index) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    row.appendChild(label);
    row.appendChild(select);
    mappingList.appendChild(row);
  });

  const imageUrlsField = 'imageUrls';
  const imgRow = document.createElement('div');
  imgRow.className = 'field-mapping-row field-mapping-row-image-urls';
  const imgLabel = document.createElement('div');
  imgLabel.className = 'field-mapping-label';
  imgLabel.textContent = window.FieldMapper.getFieldDisplayName(imageUrlsField) + ':';
  const imgSelect = document.createElement('select');
  imgSelect.className = 'field-mapping-select';
  imgSelect.dataset.field = imageUrlsField;
  const imgEmpty = document.createElement('option');
  imgEmpty.value = '';
  imgEmpty.textContent = '(None)';
  imgEmpty.selected = suggestedImageUrlsColumn === null;
  imgSelect.appendChild(imgEmpty);
  headers.forEach((header, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = header;
    option.selected = suggestedImageUrlsColumn === index;
    imgSelect.appendChild(option);
  });
  const imgHint = document.createElement('div');
  imgHint.className = 'field-mapping-image-urls-hint';
  imgHint.textContent =
    'HTTPS links only: Google Drive or Docs share URLs, or direct *.googleusercontent.com image URLs. “Anyone with the link”. Downloads run when you process the CSV.';
  imgRow.appendChild(imgLabel);
  imgRow.appendChild(imgSelect);
  imgRow.appendChild(imgHint);
  mappingList.appendChild(imgRow);
  
  mappingSection.style.display = 'block';
  updateProcessCsvButtonHint();
}

/**
 * Fetches images from CSV URL column into IndexedDB; mutates items[].images.
 * @returns {{ imported: number, errors: Array<{row:number,url:string,message:string}> }}
 */
async function importCsvUrlImages(processedItems, csvRows, fieldMapping, progressFill, startPercent, endPercent) {
  const Imp = window.ImageUrlImporter;
  if (!Imp) {
    return { imported: 0, errors: [] };
  }
  const col = fieldMapping.imageUrls;
  if (col === undefined || col === null) {
    return { imported: 0, errors: [] };
  }
  const csvIndex = typeof col === 'number' ? col : parseInt(col, 10);
  if (Number.isNaN(csvIndex)) {
    return { imported: 0, errors: [] };
  }

  let totalFetches = 0;
  for (const item of processedItems) {
    const row = csvRows[item._rowIndex - 1];
    if (!row) continue;
    const urls = Imp.parseUrlsFromCell(row[csvIndex]).slice(0, Imp.MAX_IMAGES_PER_ITEM);
    totalFetches += urls.length;
  }

  const errors = [];
  let imported = 0;
  let done = 0;

  for (const item of processedItems) {
    const row = csvRows[item._rowIndex - 1];
    if (!row) continue;
    const urls = Imp.parseUrlsFromCell(row[csvIndex]).slice(0, Imp.MAX_IMAGES_PER_ITEM);
    if (urls.length === 0) continue;

    item.images = [];
    const titleDisplay = (item.title || `Row ${item._rowIndex}`).toString();
    for (let i = 0; i < urls.length; i++) {
      try {
        showStatus(
          `Downloading images for "${titleDisplay}" — image ${i + 1} of ${urls.length} (${done + 1} of ${totalFetches} total)`,
          'info'
        );
        const base = (item.title || `row${item._rowIndex}`).toString();
        const file = await Imp.fetchUrlToFile(urls[i], base, i);
        const imageKey = `${item.id}_url_${i}`;
        await window.StorageManager.storeImage(imageKey, file, item.id);
        item.images.push({ key: imageKey, filename: file.name, local: imageKey });
        imported++;
      } catch (e) {
        errors.push({
          row: item._rowIndex,
          url: urls[i],
          message: e.message || String(e)
        });
      }
      done++;
      if (totalFetches > 0 && progressFill) {
        const p = startPercent + (done / totalFetches) * (endPercent - startPercent);
        progressFill.style.width = `${Math.min(p, endPercent)}%`;
      }
    }
  }

  return { imported, errors };
}

async function processCSV() {
  if (!csvData) {
    showStatus('Please upload a CSV file first', 'error');
    return;
  }
  
  const progress = document.getElementById('csv-progress');
  const progressFill = document.getElementById('csv-progress-fill');
  progress.style.display = 'block';
  progressFill.style.width = '10%';
  
  try {
    // Get field mapping from UI
    const fieldMapping = {};
    document.querySelectorAll('.field-mapping-select').forEach(select => {
      const field = select.dataset.field;
      const csvIndex = parseInt(select.value);
      if (!isNaN(csvIndex)) {
        fieldMapping[field] = csvIndex;
      }
    });
    
    // Warn if no title field mapped (required for Facebook)
    if (fieldMapping.title === undefined || fieldMapping.title === null) {
      const confirmed = confirm('No title field is mapped. Facebook requires a title. Continue anyway?');
      if (!confirmed) {
        progress.style.display = 'none';
        return;
      }
    }
    
    progressFill.style.width = '30%';
    
    // Process rows
    const processedItems = [];
    const csvSettings = await window.StorageManager.getCSVSettings();
    const identifierColumn = csvSettings.identifierColumn || 0; // 0-indexed, default to Title column (index 0)
    
    // Validate identifier column
    if (identifierColumn >= csvData.headers.length) {
      throw new Error(`Identifier column index ${identifierColumn + 1} is out of range. CSV has ${csvData.headers.length} columns.`);
    }
    
    csvData.rows.forEach((row, index) => {
      try {
        const item = window.FieldMapper.applyMapping(row, fieldMapping);

        const imgCol = fieldMapping.imageUrls;
        const hasImageUrls =
          window.ImageUrlImporter &&
          imgCol !== undefined &&
          imgCol !== null &&
          !Number.isNaN(Number(imgCol)) &&
          window.ImageUrlImporter.parseUrlsFromCell(row[imgCol]).length > 0;

        if (Object.keys(item).length === 0 && !hasImageUrls) {
          return;
        }
        if (Object.keys(item).length === 0 && hasImageUrls) {
          item.title = `Listing (row ${index + 1})`;
        }

        // Generate ID if not provided
        if (!item.id) {
          item.id = generateId();
        }

        // Store original row index for image matching (1-indexed)
        item._rowIndex = index + 1;
        item._identifier = row[identifierColumn] ? row[identifierColumn].toString().trim() : '';

        // Initialize images array
        if (!item.images) {
          item.images = [];
        }

        processedItems.push(item);
      } catch (error) {
        console.warn(`Error processing row ${index + 1}:`, error);
        // Continue processing other rows
      }
    });
    
    if (processedItems.length === 0) {
      throw new Error('No valid items found in CSV. Please check your data and field mapping.');
    }
    
    progressFill.style.width = '70%';

    const imageUrlsCol = fieldMapping.imageUrls;
    if (
      imageUrlsCol !== undefined &&
      imageUrlsCol !== null &&
      !Number.isNaN(parseInt(imageUrlsCol, 10))
    ) {
      showStatus('Fetching images from your Image URLs column…', 'info');
    }

    const urlResult = await importCsvUrlImages(
      processedItems,
      csvData.rows,
      fieldMapping,
      progressFill,
      70,
      96
    );

    items = processedItems;
    await window.StorageManager.storeItems(items);
    await window.StorageManager.storeFieldMapping(fieldMapping);

    progressFill.style.width = '100%';

    let statusMsg = `Successfully processed ${items.length} items from CSV`;
    if (urlResult.imported > 0) {
      statusMsg += `. Downloaded ${urlResult.imported} image(s) from URLs`;
    }
    if (urlResult.errors.length > 0) {
      statusMsg +=
        '. Download failed for these items—check that you set the folder access to anyone with the link.';
      console.warn('CSV image URL import errors:', urlResult.errors);
      showStatus(statusMsg, 'info');
    } else {
      showStatus(statusMsg, 'success');
    }
    
    // Switch to items tab
    setTimeout(() => {
      switchTab('items');
      renderItems();
    }, 500);
    
  } catch (error) {
    showStatus('Error processing CSV: ' + error.message, 'error');
    console.error('Process CSV error:', error);
  } finally {
    setTimeout(() => {
      progress.style.display = 'none';
      progressFill.style.width = '0%';
    }, 1000);
  }
}

function setupImageUpload() {
  const imageInput = document.getElementById('image-file-input');
  const imageSection = document.getElementById('image-upload-section');
  const processButton = document.getElementById('process-images-button');
  
  if (!imageInput || !processButton) {
    console.error('Image upload elements not found!');
    return;
  }
  
  imageInput.addEventListener('change', handleImageFileSelect);
  processButton.addEventListener('click', () => {
    console.log('Process images button clicked!');
    processImages();
  });
  
  console.log('Image upload setup complete');
  
  // Drag and drop
  imageSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageSection.classList.add('drag-over');
  });
  
  imageSection.addEventListener('dragleave', () => {
    imageSection.classList.remove('drag-over');
  });
  
  imageSection.addEventListener('drop', (e) => {
    e.preventDefault();
    imageSection.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      imageInput.files = dt.files;
      handleImageFileSelect({ target: imageInput });
    }
  });
}

function handleImageFileSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;
  
  // Validate image files
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const maxSize = 10 * 1024 * 1024; // 10MB per image
  const invalidFiles = [];
  const oversizedFiles = [];
  
  files.forEach(file => {
    if (!validImageTypes.includes(file.type.toLowerCase()) && 
        !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      invalidFiles.push(file.name);
    }
    if (file.size > maxSize) {
      oversizedFiles.push(file.name);
    }
  });
  
  if (invalidFiles.length > 0) {
    showStatus(`Invalid image files: ${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}. Only JPG, PNG, WEBP, HEIC formats are supported.`, 'error');
    return;
  }
  
  if (oversizedFiles.length > 0) {
    showStatus(`Images too large (max 10MB each): ${oversizedFiles.slice(0, 3).join(', ')}${oversizedFiles.length > 3 ? '...' : ''}`, 'error');
    return;
  }
  
  uploadedImages = files;
  
  const fileList = document.getElementById('image-file-list');
  fileList.innerHTML = files.map(file => 
    `<div class="file-item">🖼️ ${escapeHtml(file.name)} (${formatFileSize(file.size)})</div>`
  ).join('');
  
  document.getElementById('image-upload-section').classList.add('has-files');
  document.getElementById('process-images-button').style.display = 'block';
  showStatus(`${files.length} image${files.length > 1 ? 's' : ''} selected`, 'success');
}

async function processImages() {
  console.log('processImages called');
  console.log('uploadedImages:', uploadedImages);
  console.log('items:', items);
  console.log('csvData:', csvData);
  console.log('window.ImageMatcher:', window.ImageMatcher);
  
  if (uploadedImages.length === 0) {
    console.log('No images uploaded');
    showStatus('Please upload images first', 'error');
    return;
  }
  
  if (items.length === 0) {
    console.log('No items loaded');
    showStatus('Please process CSV file first', 'error');
    return;
  }
  
  if (!csvData) {
    console.log('No CSV data');
    showStatus('CSV data not found. Please re-upload CSV file.', 'error');
    return;
  }
  
  if (!window.ImageMatcher || !window.ImageMatcher.matchImagesToRows) {
    console.error('ImageMatcher not available!');
    showStatus('Image matching module not loaded. Please refresh the extension.', 'error');
    return;
  }
  
  const progress = document.getElementById('image-progress');
  const progressFill = document.getElementById('image-progress-fill');
  progress.style.display = 'block';
  progressFill.style.width = '5%';
  
  try {
    const csvSettings = await window.StorageManager.getCSVSettings();
    const identifierColumn = csvSettings.identifierColumn || 0; // 0-indexed, default to Title column (index 0)
    
    // Validate identifier column
    if (identifierColumn >= csvData.headers.length) {
      throw new Error(`Identifier column index ${identifierColumn + 1} is out of range. Please check CSV settings.`);
    }
    
    progressFill.style.width = '10%';
    
    // Convert CSV rows for matching
    const csvRows = csvData.rows;
    
    console.log('About to match images...');
    console.log('Images to match:', uploadedImages.length);
    console.log('CSV rows:', csvRows.length);
    console.log('First 3 image filenames:', uploadedImages.slice(0, 3).map(img => img.name));
    console.log('First 3 CSV row titles:', csvRows.slice(0, 3).map(row => row[0]));
    
    // Match images to items
    const matchedImages = window.ImageMatcher.matchImagesToRows(
      uploadedImages,
      csvRows,
      identifierColumn
    );
    
    console.log('Matching complete. Results:', matchedImages);
    
    const matchedCount = Object.keys(matchedImages).length;
    const unmatchedCount = uploadedImages.length - Object.values(matchedImages).flat().length;
    
    if (matchedCount === 0) {
      showStatus('No images matched to CSV rows. Please check image naming format (Row{number}_{identifier}_{number}.{ext})', 'error');
      progress.style.display = 'none';
      return;
    }
    
    if (unmatchedCount > 0) {
      showStatus(`Warning: ${unmatchedCount} image(s) could not be matched to any CSV row.`, 'info');
    }
    
    progressFill.style.width = '30%';
    
    // Store images and update items
    let storedCount = 0;
    const totalImages = Object.values(matchedImages).flat().length;
    
    for (const [itemIndex, imageFiles] of Object.entries(matchedImages)) {
      const itemIndexNum = parseInt(itemIndex);
      const item = items[itemIndexNum];
      if (!item) {
        console.warn(`Item at index ${itemIndexNum} not found`);
        continue;
      }
      
      item.images = [];
      
      for (const imageFile of imageFiles) {
        try {
          // Get the filename - try multiple sources
          const filename = imageFile.name || imageFile.filename || (imageFile instanceof File ? imageFile.name : '') || 'image.jpg';
          
          console.log('Storing image:', filename, 'Type:', typeof imageFile, 'Is File:', imageFile instanceof File);
          
          // Create storage key
          const imageKey = `${item.id}_${imageFile.parsed?.imageNumber || storedCount}`;
          
          // Get blob - File objects ARE blobs, so use directly
          // The imageFile should be the original File object
          let blob = null;
          if (imageFile instanceof File || imageFile instanceof Blob) {
            blob = imageFile;
          } else if (imageFile.blob && (imageFile.blob instanceof Blob || imageFile.blob instanceof File)) {
            blob = imageFile.blob;
          } else {
            // Try to reconstruct - shouldn't happen but just in case
            console.warn('ImageFile type:', typeof imageFile, 'instanceof File:', imageFile instanceof File, 'instanceof Blob:', imageFile instanceof Blob);
            console.warn('Cannot extract blob from image:', filename, imageFile);
            continue;
          }
          
          if (!blob) {
            console.warn('No blob found for image:', filename);
            continue;
          }
          
          // Store in IndexedDB - ensure we preserve the blob with correct type
          // If the blob type is missing, try to detect from filename
          if (!blob.type || blob.type === 'application/octet-stream') {
            const ext = filename.split('.').pop().toLowerCase();
            const mimeTypes = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp',
              'heic': 'image/heic',
              'heif': 'image/heif'
            };
            const detectedType = mimeTypes[ext] || 'image/jpeg';
            // Create a new blob with correct type
            blob = new Blob([blob], { type: detectedType });
          }
          
          // Store in IndexedDB
          await window.StorageManager.storeImage(imageKey, blob, item.id);
          
          // Add to item images
          item.images.push({
            key: imageKey,
            filename: filename,
            local: imageKey
          });
          
          storedCount++;
          const progressPercent = 30 + (storedCount / totalImages) * 65;
          progressFill.style.width = `${Math.min(progressPercent, 95)}%`;
        } catch (error) {
          console.error('Error storing image:', imageFile.name || imageFile.filename || 'unknown', error);
          // Continue with other images
        }
      }
    }
    
    progressFill.style.width = '100%';
    
    // Update stored items
    await window.StorageManager.storeItems(items);
    
    const successMsg = `Matched and stored ${storedCount} image(s) for ${matchedCount} item(s)`;
    if (unmatchedCount > 0) {
      showStatus(`${successMsg}. ${unmatchedCount} image(s) could not be matched.`, 'info');
    } else {
      showStatus(successMsg, 'success');
    }
    
    // Switch to items tab
    setTimeout(() => {
      switchTab('items');
      renderItems();
    }, 500);
    
  } catch (error) {
    showStatus('Error processing images: ' + error.message, 'error');
    console.error('Process images error:', error);
  } finally {
    setTimeout(() => {
      progress.style.display = 'none';
      progressFill.style.width = '0%';
    }, 1000);
  }
}

async function loadItems() {
  try {
    items = await window.StorageManager.getItems();
    if (items.length > 0) {
      renderItems();
    }
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
        files: ['content.js']
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
    itemList.innerHTML = '<div class="empty">No items loaded. Please upload a CSV file first.</div>';
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
      'Remove all items and their stored images from this extension? This cannot be undone. Field mapping and settings are kept.'
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

async function setupSettings() {
  const textarea = document.getElementById('custom-description-textarea');
  const saveButton = document.getElementById('save-settings-button');
  
  if (!textarea || !saveButton) return;
  
  // Load existing settings
  try {
    const settings = await window.StorageManager.getExtensionSettings();
    if (settings.customDescription) {
      textarea.value = settings.customDescription;
    }
  } catch (error) {
    console.warn('Error loading settings:', error);
  }
  
  // Save settings when button is clicked
  saveButton.addEventListener('click', async () => {
    try {
      const customDescription = textarea.value.trim();
      await window.StorageManager.storeExtensionSettings({
        customDescription: customDescription
      });
      showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      showStatus('Error saving settings: ' + error.message, 'error');
      console.error('Error saving settings:', error);
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

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function generateId() {
  return 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

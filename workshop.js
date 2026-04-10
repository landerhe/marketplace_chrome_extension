// Full-page workshop: CSV, field mapping, title modes, images

let csvData = null;
let items = [];
let uploadedImages = [];

const DESCRIPTION_BLOCKS = [
  { id: 'title', label: 'Title (listing title)' },
  { id: 'size', label: 'Size' },
  { id: 'materials', label: 'Materials' },
  { id: 'condition', label: 'Condition' },
  { id: 'csvDescription', label: 'Description from CSV (mapped column)' },
  { id: 'custom', label: 'Description footnote (uniform)' }
];

const DESCRIPTION_BLOCK_IDS = new Set(DESCRIPTION_BLOCKS.map((b) => b.id));

function getDescriptionBlockLabel(id) {
  const b = DESCRIPTION_BLOCKS.find((x) => x.id === id);
  return b ? b.label : id;
}

function readDescriptionOrderFromUI() {
  const container = document.getElementById('description-parts-list');
  if (!container) return [];
  return Array.from(container.querySelectorAll('.desc-part-row'))
    .map((r) => r.dataset.partKey)
    .filter((k) => k && DESCRIPTION_BLOCK_IDS.has(k));
}

function updateDescriptionAddSelect() {
  const sel = document.getElementById('description-part-add-select');
  if (!sel) return;
  const current = readDescriptionOrderFromUI();
  sel.innerHTML = '';
  const available = DESCRIPTION_BLOCKS.filter((b) => !current.includes(b.id));
  if (available.length === 0) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(All block types added)';
    sel.appendChild(o);
    return;
  }
  available.forEach((b) => {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = b.label;
    sel.appendChild(o);
  });
}

function createDescriptionPartRow(partKey) {
  const row = document.createElement('div');
  row.className = 'desc-part-row';
  row.dataset.partKey = partKey;

  const label = document.createElement('span');
  label.className = 'desc-part-label';
  label.textContent = getDescriptionBlockLabel(partKey);
  row.appendChild(label);

  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'concat-mini-btn';
  up.textContent = 'Up';
  up.addEventListener('click', () => {
    const prev = row.previousElementSibling;
    if (prev) row.parentNode.insertBefore(row, prev);
    updateDescriptionAddSelect();
    updateDescriptionPreview();
  });
  row.appendChild(up);

  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'concat-mini-btn';
  down.textContent = 'Down';
  down.addEventListener('click', () => {
    const next = row.nextElementSibling;
    if (next) row.parentNode.insertBefore(next, row);
    updateDescriptionAddSelect();
    updateDescriptionPreview();
  });
  row.appendChild(down);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'concat-mini-btn';
  rm.textContent = 'Remove';
  rm.addEventListener('click', () => {
    row.remove();
    updateDescriptionAddSelect();
    renderDescriptionPartsListIfEmptyPlaceholder();
    updateDescriptionPreview();
  });
  row.appendChild(rm);

  return row;
}

function renderDescriptionPartsListIfEmptyPlaceholder() {
  const container = document.getElementById('description-parts-list');
  if (!container) return;
  if (container.querySelectorAll('.desc-part-row').length === 0) {
    container.innerHTML =
      '<p class="help-text" id="description-parts-empty-hint">No blocks yet — add blocks below (defaults load when you open this page).</p>';
  }
}

function renderDescriptionPartsList(order) {
  const container = document.getElementById('description-parts-list');
  if (!container) return;
  container.innerHTML = '';
  const list = (order || []).filter((k) => DESCRIPTION_BLOCK_IDS.has(k));
  if (list.length === 0) {
    renderDescriptionPartsListIfEmptyPlaceholder();
  } else {
    list.forEach((key) => container.appendChild(createDescriptionPartRow(key)));
  }
  updateDescriptionAddSelect();
  updateDescriptionPreview();
}

function updateDescriptionPreview() {
  const box = document.getElementById('description-preview');
  const textEl = document.getElementById('description-preview-text');
  if (!box || !textEl) return;
  const DA = window.DescriptionAssembly;
  if (!DA) {
    box.style.display = 'none';
    return;
  }
  if (!csvData || !csvData.rows.length) {
    box.style.display = 'block';
    textEl.textContent =
      'Upload a CSV and map columns (steps 1–2) to preview the description for the first data row.';
    return;
  }
  const fieldMapping = window.CsvProcessing.collectFieldMappingFromRoot(
    document.getElementById('field-mapping-list')
  );
  const row = csvData.rows[0];
  const item = DA.itemPreviewFromCsvRow(row, fieldMapping);
  const titleSettings = readTitleSettingsFromUI();
  const builtTitle = window.CsvProcessing.buildTitleFromRow(row, titleSettings, fieldMapping);
  if (builtTitle) item.title = builtTitle;

  const order = readDescriptionOrderFromUI();
  const ta = document.getElementById('custom-description-textarea');
  const footnote = ta ? ta.value : '';
  const text = DA.buildMarketplaceDescription(order, item, footnote);
  box.style.display = 'block';
  textEl.textContent =
    text ||
    '(Nothing to show for the first row with these blocks — map columns or add blocks above.)';
}

async function loadDescriptionSettingsPanel() {
  const settings = await window.StorageManager.getExtensionSettings();
  const ta = document.getElementById('custom-description-textarea');
  if (ta) ta.value = settings.customDescription || '';
  renderDescriptionPartsList(settings.descriptionPartOrder);
  updateDescriptionPreview();
}

async function saveDescriptionSettingsFromWorkshop() {
  const ta = document.getElementById('custom-description-textarea');
  const customDescription = ta ? ta.value.trim() : '';
  let order = readDescriptionOrderFromUI();
  order = order.filter((k) => DESCRIPTION_BLOCK_IDS.has(k));
  const prev = await window.StorageManager.getExtensionSettings();
  try {
    await window.StorageManager.storeExtensionSettings({
      ...prev,
      customDescription,
      descriptionPartOrder: order
    });
    showStatus('Description layout and footnote saved.', 'success');
    updateDescriptionPreview();
  } catch (e) {
    showStatus('Could not save: ' + (e.message || String(e)), 'error');
    console.error(e);
  }
}

function setupDescriptionSettingsPanel() {
  const addBtn = document.getElementById('description-part-add-btn');
  const saveBtn = document.getElementById('save-description-settings-button');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const sel = document.getElementById('description-part-add-select');
      if (!sel || !sel.value) return;
      const container = document.getElementById('description-parts-list');
      const hint = document.getElementById('description-parts-empty-hint');
      if (hint) hint.remove();
      if (!container.querySelector('.desc-part-row')) {
        container.innerHTML = '';
      }
      container.appendChild(createDescriptionPartRow(sel.value));
      updateDescriptionAddSelect();
      updateDescriptionPreview();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveDescriptionSettingsFromWorkshop());
  }
  const footnoteTa = document.getElementById('custom-description-textarea');
  if (footnoteTa) {
    footnoteTa.addEventListener('input', updateDescriptionPreview);
  }
  loadDescriptionSettingsPanel();
}

function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  if (!statusDiv) return;
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}

/** Inline message below Process CSV (progress + success/error for import / URL downloads). */
function setCsvProcessResult(message, type) {
  const el = document.getElementById('csv-process-result');
  if (!el) return;
  el.className = 'csv-process-result';
  if (!message) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.textContent = message;
  if (type === 'success') el.classList.add('csv-process-result--success');
  else if (type === 'error') el.classList.add('csv-process-result--error');
  else el.classList.add('csv-process-result--info');
  el.style.display = 'block';
}

function updateProcessCsvButtonHint() {
  const processCard = document.getElementById('process-csv-card');
  const btn = document.getElementById('process-csv-button');
  const hint = document.getElementById('process-csv-hint');
  const sel = document.querySelector('select[data-field="imageUrls"]');
  if (!btn || !hint) return;
  if (!processCard || processCard.style.display === 'none') {
    hint.style.display = 'none';
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
        'Map columns above, then process. If Image URLs is set, images download during this step.';
    }
  } else {
    btn.textContent = 'Process CSV & fetch images';
    if (hint) {
      hint.style.display = 'block';
      hint.textContent =
        'Links in that column are downloaded when you process (Drive: “Anyone with the link”).';
    }
  }
}

function showFieldMapping(headers) {
  const mappingList = document.getElementById('field-mapping-list');
  const { mapping, suggestedImageUrlsColumn } = window.FieldMapper.mapCSVHeaders(headers);

  mappingList.innerHTML = '';

  const intro = document.createElement('div');
  intro.className = 'field-mapping-intro';
  intro.innerHTML =
    '<strong>Confirm each row</strong> and title options, set description layout in section 3, then run <strong>Process CSV</strong> in section 4.';
  mappingList.appendChild(intro);

  const facebookFields = ['title', 'price', 'category', 'condition', 'description', 'size', 'materials'];
  facebookFields.forEach((field) => {
    const row = document.createElement('div');
    row.className = 'field-mapping-row';

    const label = document.createElement('div');
    label.className = 'field-mapping-label';
    label.textContent = window.FieldMapper.getFieldDisplayName(field) + ':';

    const select = document.createElement('select');
    select.className = 'field-mapping-select';
    select.dataset.field = field;

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '(None)';
    select.appendChild(emptyOption);

    headers.forEach((header, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = header;
      if (mapping[field] === index) option.selected = true;
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
    'HTTPS links: Google Drive shared URLs. Shared as “Anyone with the link”.';
  imgRow.appendChild(imgLabel);
  imgRow.appendChild(imgSelect);
  imgRow.appendChild(imgHint);
  mappingList.appendChild(imgRow);

  mappingList.querySelectorAll('.field-mapping-select').forEach((el) => {
    el.addEventListener('change', () => {
      updateProcessCsvButtonHint();
      updateTitlePreview();
      updateDescriptionPreview();
    });
  });

  updateProcessCsvButtonHint();
  updateDescriptionPreview();
}

async function applyStoredFieldMapping(headers) {
  const saved = await window.StorageManager.getFieldMapping();
  if (!saved) return;
  document.querySelectorAll('#field-mapping-list .field-mapping-select').forEach((sel) => {
    const f = sel.dataset.field;
    if (saved[f] !== undefined && saved[f] !== null) {
      const idx = Number(saved[f]);
      if (!Number.isNaN(idx) && idx >= 0 && idx < headers.length) {
        sel.value = String(idx);
      }
    }
  });
  updateProcessCsvButtonHint();
  updateDescriptionPreview();
}

function getTitleMode() {
  const r = document.querySelector('input[name="title-mode"]:checked');
  return r ? r.value : 'single';
}

function readConcatFromUI() {
  const container = document.getElementById('concat-rows');
  if (!container) return { concatColumns: [], concatSeparators: [] };
  const partRows = container.querySelectorAll('.concat-part-row');
  const concatColumns = [];
  const concatSeparators = [];
  partRows.forEach((row, idx) => {
    const sepInput = row.querySelector('.concat-sep-input');
    const colSel = row.querySelector('.concat-col-select');
    if (idx > 0 && sepInput) {
      concatSeparators.push(sepInput.value != null ? sepInput.value : ' – ');
    }
    if (colSel && colSel.value !== '') {
      const ci = parseInt(colSel.value, 10);
      if (!Number.isNaN(ci)) concatColumns.push(ci);
    }
  });
  while (concatSeparators.length < Math.max(0, concatColumns.length - 1)) {
    concatSeparators.push(' – ');
  }
  if (concatSeparators.length > Math.max(0, concatColumns.length - 1)) {
    concatSeparators.length = Math.max(0, concatColumns.length - 1);
  }
  return { concatColumns, concatSeparators };
}

function readTitleSettingsFromUI() {
  const mode = getTitleMode();
  if (mode !== 'concat') {
    return { mode: 'single', concatColumns: [], concatSeparators: [] };
  }
  const { concatColumns, concatSeparators } = readConcatFromUI();
  return { mode: 'concat', concatColumns, concatSeparators };
}

function createConcatPartRow(headers, columnIndex, separatorBefore, isFirst) {
  const row = document.createElement('div');
  row.className = 'concat-part-row';

  if (!isFirst) {
    const sep = document.createElement('input');
    sep.type = 'text';
    sep.className = 'concat-sep-input';
    sep.placeholder = ' – ';
    sep.value = separatorBefore != null ? separatorBefore : ' – ';
    sep.setAttribute('aria-label', 'Separator before this column');
    row.appendChild(sep);
  }

  const colSel = document.createElement('select');
  colSel.className = 'concat-col-select field-mapping-select';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '(Column)';
  colSel.appendChild(empty);
  headers.forEach((h, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = h;
    if (columnIndex === i) o.selected = true;
    colSel.appendChild(o);
  });
  row.appendChild(colSel);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'concat-mini-btn';
  rm.textContent = 'Remove';
  rm.addEventListener('click', () => {
    row.remove();
    normalizeConcatFirstRowSep();
    updateTitlePreview();
    updateDescriptionPreview();
  });
  row.appendChild(rm);

  colSel.addEventListener('change', () => {
    updateTitlePreview();
    updateDescriptionPreview();
  });
  const sepEl = row.querySelector('.concat-sep-input');
  if (sepEl) {
    sepEl.addEventListener('input', () => {
      updateTitlePreview();
      updateDescriptionPreview();
    });
  }

  return row;
}

/** First concat row must not have a separator input. */
function normalizeConcatFirstRowSep() {
  const container = document.getElementById('concat-rows');
  if (!container) return;
  const rows = container.querySelectorAll('.concat-part-row');
  rows.forEach((row, idx) => {
    const sep = row.querySelector('.concat-sep-input');
    if (idx === 0 && sep) sep.remove();
  });
}

function renderConcatRowsFromSettings(headers, settings) {
  const container = document.getElementById('concat-rows');
  if (!container) return;
  container.innerHTML = '';
  const cols = settings.concatColumns || [];
  const seps = settings.concatSeparators || [];
  if (cols.length === 0) {
    container.appendChild(createConcatPartRow(headers, null, null, true));
    updateDescriptionPreview();
    return;
  }
  cols.forEach((colIdx, i) => {
    const sepBefore = i > 0 ? seps[i - 1] : null;
    container.appendChild(createConcatPartRow(headers, colIdx, sepBefore, i === 0));
  });
  updateDescriptionPreview();
}

async function hydrateTitleUI(headers) {
  const ts = await window.StorageManager.getTitleSettings();
  const single = document.querySelector('input[name="title-mode"][value="single"]');
  const concat = document.querySelector('input[name="title-mode"][value="concat"]');
  if (ts.mode === 'concat') {
    if (concat) concat.checked = true;
    document.getElementById('title-concat-panel').style.display = 'block';
    renderConcatRowsFromSettings(headers, ts);
  } else {
    if (single) single.checked = true;
    document.getElementById('title-concat-panel').style.display = 'none';
  }
  toggleTitleModePanel();
  updateTitlePreview();
  updateDescriptionPreview();
}

function toggleTitleModePanel() {
  const panel = document.getElementById('title-concat-panel');
  if (!panel) return;
  panel.style.display = getTitleMode() === 'concat' ? 'block' : 'none';
  updateTitlePreview();
  updateDescriptionPreview();
}

function updateTitlePreview() {
  const preview = document.getElementById('title-preview');
  const textEl = document.getElementById('title-preview-text');
  if (!preview || !textEl || !csvData || !csvData.rows.length) {
    if (preview) preview.style.display = 'none';
    return;
  }
  if (getTitleMode() !== 'concat') {
    preview.style.display = 'none';
    return;
  }
  const fieldMapping = window.CsvProcessing.collectFieldMappingFromRoot(
    document.getElementById('field-mapping-list')
  );
  const titleSettings = readTitleSettingsFromUI();
  const row = csvData.rows[0];
  const t = window.CsvProcessing.buildTitleFromRow(row, titleSettings, fieldMapping);
  textEl.textContent = t || '(empty for first row — add columns or check data)';
  preview.style.display = 'block';
}

async function handleCSVFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (
    !file.name.toLowerCase().endsWith('.csv') &&
    !file.type.includes('csv') &&
    !file.type.includes('text')
  ) {
    showStatus('Please select a valid CSV file (.csv or .txt)', 'error');
    return;
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showStatus('CSV file is too large. Maximum size is 10MB.', 'error');
    return;
  }

  const fileList = document.getElementById('csv-file-list');
  fileList.innerHTML = `<div class="file-item">📄 ${escapeHtml(file.name)} (${formatFileSize(file.size)})</div>`;
  fileList.style.display = 'block';
  document.getElementById('csv-upload-section').classList.add('has-files');

  try {
    showStatus('Reading CSV…', 'info');
    const text = await window.CSVParser.fileToText(file);
    if (!text || text.trim().length === 0) throw new Error('CSV file is empty');

    csvData = window.CSVParser.parseCSV(text);
    if (!csvData.headers || csvData.headers.length === 0) {
      throw new Error('CSV file has no headers.');
    }
    if (csvData.rows.length === 0) throw new Error('CSV file has no data rows.');

    document.getElementById('mapping-card').style.display = 'block';
    document.getElementById('process-csv-card').style.display = 'block';
    setCsvProcessResult('', null);
    showFieldMapping(csvData.headers);
    await applyStoredFieldMapping(csvData.headers);
    await hydrateTitleUI(csvData.headers);

    updateProcessCsvButtonHint();
    updateDescriptionPreview();
    showStatus(`CSV loaded: ${csvData.rows.length} rows.`, 'success');
  } catch (error) {
    showStatus('Error parsing CSV: ' + error.message, 'error');
    console.error(error);
    csvData = null;
    document.getElementById('mapping-card').style.display = 'none';
    document.getElementById('process-csv-card').style.display = 'none';
    setCsvProcessResult('', null);
    updateDescriptionPreview();
  }
}

async function importCsvUrlImages(processedItems, csvRows, fieldMapping, progressFill, startPercent, endPercent) {
  const Imp = window.ImageUrlImporter;
  if (!Imp) return { imported: 0, errors: [] };
  const col = fieldMapping.imageUrls;
  if (col === undefined || col === null) return { imported: 0, errors: [] };
  const csvIndex = typeof col === 'number' ? col : parseInt(col, 10);
  if (Number.isNaN(csvIndex)) return { imported: 0, errors: [] };

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
        setCsvProcessResult(
          `Downloading images for "${titleDisplay}" — ${i + 1} of ${urls.length} (${done + 1} of ${totalFetches} total)`,
          'info'
        );
        const base = (item.title || `row${item._rowIndex}`).toString();
        const file = await Imp.fetchUrlToFile(urls[i], base, i);
        const imageKey = `${item.id}_url_${i}`;
        await window.StorageManager.storeImage(imageKey, file, item.id);
        item.images.push({ key: imageKey, filename: file.name, local: imageKey });
        imported++;
      } catch (e) {
        errors.push({ row: item._rowIndex, url: urls[i], message: e.message || String(e) });
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
    showStatus('Please upload a CSV file first.', 'error');
    return;
  }

  setCsvProcessResult('', null);

  const progress = document.getElementById('csv-progress');
  const progressFill = document.getElementById('csv-progress-fill');
  progress.style.display = 'block';
  progressFill.style.width = '10%';

  try {
    const fieldMapping = window.CsvProcessing.collectFieldMappingFromRoot(
      document.getElementById('field-mapping-list')
    );
    const titleSettings = readTitleSettingsFromUI();

    if (titleSettings.mode === 'single') {
      if (fieldMapping.title === undefined || fieldMapping.title === null) {
        const ok = confirm(
          'No Title column is mapped. Facebook needs a title. Continue anyway?'
        );
        if (!ok) {
          progress.style.display = 'none';
          setCsvProcessResult('', null);
          return;
        }
      }
    } else if (!titleSettings.concatColumns || titleSettings.concatColumns.length === 0) {
      setCsvProcessResult('Concat title: add at least one column.', 'error');
      progress.style.display = 'none';
      return;
    }

    progressFill.style.width = '30%';

    const { processedItems } = window.CsvProcessing.processCsvDataRows({
      rows: csvData.rows,
      fieldMapping,
      titleSettings,
      headerLength: csvData.headers.length,
      generateId
    });

    if (processedItems.length === 0) {
      throw new Error('No valid items found. Check data and mapping.');
    }

    progressFill.style.width = '70%';

    if (
      fieldMapping.imageUrls !== undefined &&
      fieldMapping.imageUrls !== null &&
      !Number.isNaN(parseInt(fieldMapping.imageUrls, 10))
    ) {
      setCsvProcessResult('Downloading images from your Image URLs column…', 'info');
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
    await window.StorageManager.storeTitleSettings(titleSettings);

    progressFill.style.width = '100%';

    let statusMsg = `Processed ${items.length} item(s).`;
    if (urlResult.imported > 0) statusMsg += ` Downloaded ${urlResult.imported} image(s) from URLs.`;
    if (urlResult.errors.length > 0) {
      console.warn('CSV URL import errors:', urlResult.errors);
      setCsvProcessResult(
        statusMsg + ' Some URL downloads failed — check Drive sharing.',
        'info'
      );
    } else {
      setCsvProcessResult(statusMsg, 'success');
    }
  } catch (error) {
    setCsvProcessResult('Error: ' + error.message, 'error');
    console.error(error);
  } finally {
    setTimeout(() => {
      progress.style.display = 'none';
      progressFill.style.width = '0%';
    }, 800);
  }
}

function setupCSVUpload() {
  const csvInput = document.getElementById('csv-file-input');
  const csvSection = document.getElementById('csv-upload-section');
  if (!csvInput || !csvSection) return;

  csvInput.addEventListener('change', handleCSVFileSelect);

  csvSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvSection.classList.add('drag-over');
  });
  csvSection.addEventListener('dragleave', () => csvSection.classList.remove('drag-over'));
  csvSection.addEventListener('drop', (e) => {
    e.preventDefault();
    csvSection.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && (files[0].name.endsWith('.csv') || files[0].type.includes('csv'))) {
      csvInput.files = files;
      handleCSVFileSelect({ target: csvInput });
    }
  });
}

function setupTitleMode() {
  document.querySelectorAll('input[name="title-mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      toggleTitleModePanel();
      if (getTitleMode() === 'concat' && csvData) {
        const container = document.getElementById('concat-rows');
        if (container && !container.querySelector('.concat-part-row')) {
          renderConcatRowsFromSettings(csvData.headers, { concatColumns: [], concatSeparators: [] });
        }
      }
      updateTitlePreview();
      updateDescriptionPreview();
    });
  });

  const addConcatBtn = document.getElementById('concat-add-row');
  if (addConcatBtn) {
    addConcatBtn.addEventListener('click', () => {
      if (!csvData) return;
      const container = document.getElementById('concat-rows');
      const isFirst = !container.querySelector('.concat-part-row');
      container.appendChild(
        createConcatPartRow(csvData.headers, null, isFirst ? null : ' – ', isFirst)
      );
      normalizeConcatFirstRowSep();
      updateTitlePreview();
      updateDescriptionPreview();
    });
  }
}

function handleImageFileSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const maxSize = 10 * 1024 * 1024;
  const invalidFiles = [];
  const oversizedFiles = [];

  files.forEach((file) => {
    if (
      !validImageTypes.includes(file.type.toLowerCase()) &&
      !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)
    ) {
      invalidFiles.push(file.name);
    }
    if (file.size > maxSize) oversizedFiles.push(file.name);
  });

  if (invalidFiles.length > 0) {
    showStatus('Invalid image type(s). Use JPG, PNG, WEBP, or HEIC.', 'error');
    return;
  }
  if (oversizedFiles.length > 0) {
    showStatus('Some images exceed 10MB.', 'error');
    return;
  }

  uploadedImages = files;
  const fileList = document.getElementById('image-file-list');
  fileList.innerHTML = files
    .map((f) => `<div class="file-item">🖼️ ${escapeHtml(f.name)} (${formatFileSize(f.size)})</div>`)
    .join('');
  document.getElementById('image-upload-section').classList.add('has-files');
  document.getElementById('process-images-button').style.display = 'block';
  showStatus(`${files.length} image(s) selected.`, 'success');
}

async function processImages() {
  if (uploadedImages.length === 0) {
    showStatus('Please choose images first.', 'error');
    return;
  }
  items = await window.StorageManager.getItems();
  if (items.length === 0) {
    showStatus('Process the CSV first (step 4) so there are items to match.', 'error');
    return;
  }
  if (!csvData) {
    showStatus('Upload the CSV again to match filenames to rows, or process CSV in this session.', 'error');
    return;
  }
  if (!window.ImageMatcher) {
    showStatus('Image matcher not loaded. Reload the page.', 'error');
    return;
  }

  const progress = document.getElementById('image-progress');
  const progressFill = document.getElementById('image-progress-fill');
  progress.style.display = 'block';
  progressFill.style.width = '5%';

  try {
    const fieldMapping =
      (await window.StorageManager.getFieldMapping()) ||
      window.CsvProcessing.collectFieldMappingFromRoot(document.getElementById('field-mapping-list'));
    const titleSettings = await window.StorageManager.getTitleSettings();
    const identifierColumn = window.CsvProcessing.resolveIdentifierColumn(
      fieldMapping,
      titleSettings,
      csvData.headers.length
    );

    progressFill.style.width = '15%';
    const csvRows = csvData.rows;
    const matchedImages = window.ImageMatcher.matchImagesToRows(
      uploadedImages,
      csvRows,
      identifierColumn
    );

    const matchedCount = Object.keys(matchedImages).length;
    const matchedFlat = Object.values(matchedImages).flat();
    const unmatchedCount = uploadedImages.length - matchedFlat.length;

    if (matchedCount === 0) {
      showStatus('No images matched. Use Row{n}_{name}_{n} filenames.', 'error');
      progress.style.display = 'none';
      return;
    }
    if (unmatchedCount > 0) {
      showStatus(`${unmatchedCount} file(s) did not match any row.`, 'info');
    }

    progressFill.style.width = '30%';
    let storedCount = 0;
    const totalImages = matchedFlat.length;

    for (const [itemIndex, imageFiles] of Object.entries(matchedImages)) {
      const itemIndexNum = parseInt(itemIndex, 10);
      const item = items[itemIndexNum];
      if (!item) continue;
      item.images = [];

      for (const imageFile of imageFiles) {
        try {
          const filename =
            imageFile.name ||
            imageFile.filename ||
            (imageFile instanceof File ? imageFile.name : '') ||
            'image.jpg';
          let blob = null;
          if (imageFile instanceof File || imageFile instanceof Blob) {
            blob = imageFile;
          } else if (imageFile.blob instanceof Blob || imageFile.blob instanceof File) {
            blob = imageFile.blob;
          }
          if (!blob) continue;

          if (!blob.type || blob.type === 'application/octet-stream') {
            const ext = filename.split('.').pop().toLowerCase();
            const mimeTypes = {
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              gif: 'image/gif',
              webp: 'image/webp',
              heic: 'image/heic',
              heif: 'image/heif'
            };
            blob = new Blob([blob], { type: mimeTypes[ext] || 'image/jpeg' });
          }

          const imageKey = `${item.id}_${imageFile.parsed?.imageNumber || storedCount}`;
          await window.StorageManager.storeImage(imageKey, blob, item.id);
          item.images.push({ key: imageKey, filename, local: imageKey });
          storedCount++;
          progressFill.style.width = `${Math.min(30 + (storedCount / totalImages) * 65, 95)}%`;
        } catch (e) {
          console.error(e);
        }
      }
    }

    progressFill.style.width = '100%';
    await window.StorageManager.storeItems(items);
    showStatus(`Stored ${storedCount} image(s) for ${matchedCount} item(s).`, 'success');
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    console.error(error);
  } finally {
    setTimeout(() => {
      progress.style.display = 'none';
      progressFill.style.width = '0%';
    }, 800);
  }
}

function setupImageUpload() {
  const imageInput = document.getElementById('image-file-input');
  const imageSection = document.getElementById('image-upload-section');
  const processButton = document.getElementById('process-images-button');
  if (!imageInput || !imageSection || !processButton) return;

  imageInput.addEventListener('change', handleImageFileSelect);
  processButton.addEventListener('click', () => processImages());

  imageSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageSection.classList.add('drag-over');
  });
  imageSection.addEventListener('dragleave', () => imageSection.classList.remove('drag-over'));
  imageSection.addEventListener('drop', (e) => {
    e.preventDefault();
    imageSection.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      imageInput.files = dt.files;
      handleImageFileSelect({ target: imageInput });
    }
  });
}

async function init() {
  await new Promise((r) => setTimeout(r, 50));
  setupCSVUpload();
  setupTitleMode();
  setupDescriptionSettingsPanel();
  setupImageUpload();
  document.getElementById('process-csv-button').addEventListener('click', processCSV);
  document.getElementById('field-mapping-list').addEventListener('change', (e) => {
    if (e.target.classList.contains('field-mapping-select')) {
      updateProcessCsvButtonHint();
      updateTitlePreview();
      updateDescriptionPreview();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

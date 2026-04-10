// Shared CSV row processing: title modes (single / concat) and row label for logs / _identifier

function buildConcatTitleFromRow(row, titleSettings) {
  const cols = titleSettings.concatColumns || [];
  const seps = titleSettings.concatSeparators || [];
  const defaultSep = ' – ';
  const entries = [];
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c === undefined || c === null || Number.isNaN(Number(c))) continue;
    const idx = Number(c);
    const t = row[idx] != null ? String(row[idx]).trim() : '';
    if (t) entries.push({ i, t });
  }
  if (entries.length === 0) return '';
  let out = entries[0].t;
  for (let k = 1; k < entries.length; k++) {
    const from = entries[k - 1].i;
    const to = entries[k].i;
    let sep = '';
    for (let j = from; j < to; j++) {
      sep += seps[j] != null ? seps[j] : defaultSep;
    }
    if (!sep) sep = defaultSep;
    out += sep + entries[k].t;
  }
  return out;
}

function buildTitleFromRow(row, titleSettings, fieldMapping) {
  if (
    titleSettings &&
    titleSettings.mode === 'concat' &&
    titleSettings.concatColumns &&
    titleSettings.concatColumns.length
  ) {
    const built = buildConcatTitleFromRow(row, titleSettings);
    if (built) return built;
  }
  if (fieldMapping && fieldMapping.title != null && !Number.isNaN(Number(fieldMapping.title))) {
    const c = Number(fieldMapping.title);
    const v = row[c];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/** Column used for console log labels and item._identifier: first concat column, else mapped title column, else 0. */
function resolveIdentifierColumn(fieldMapping, titleSettings, numCols) {
  let col;
  if (
    titleSettings &&
    titleSettings.mode === 'concat' &&
    titleSettings.concatColumns &&
    titleSettings.concatColumns.length
  ) {
    col = Number(titleSettings.concatColumns[0]);
  } else if (fieldMapping && fieldMapping.title != null && !Number.isNaN(Number(fieldMapping.title))) {
    col = Number(fieldMapping.title);
  } else {
    col = 0;
  }
  if (numCols <= 0 || col < 0 || col >= numCols) col = 0;
  return col;
}

function collectFieldMappingFromRoot(root) {
  const fieldMapping = {};
  if (!root) return fieldMapping;
  root.querySelectorAll('.field-mapping-select').forEach((select) => {
    const field = select.dataset.field;
    const csvIndex = parseInt(select.value, 10);
    if (!isNaN(csvIndex)) {
      fieldMapping[field] = csvIndex;
    }
  });
  return fieldMapping;
}

/**
 * @param {object} options
 * @param {string[][]} options.rows
 * @param {object} options.fieldMapping
 * @param {object} options.titleSettings
 * @param {number} options.headerLength
 * @param {function} options.generateId
 * @returns {{ processedItems: object[], identifierColumn: number }}
 */
function processCsvDataRows(options) {
  const { rows, fieldMapping, titleSettings, headerLength, generateId } = options;

  const idFn = typeof generateId === 'function' ? generateId : () => 'item-' + Date.now();
  const identifierColumn = resolveIdentifierColumn(fieldMapping, titleSettings, headerLength);

  const processedItems = [];
  const Imp = window.ImageUrlImporter;

  rows.forEach((row, index) => {
    try {
      const item = window.FieldMapper.applyMapping(row, fieldMapping);

      if (
        titleSettings &&
        titleSettings.mode === 'concat' &&
        titleSettings.concatColumns &&
        titleSettings.concatColumns.length
      ) {
        const built = buildConcatTitleFromRow(row, titleSettings);
        if (built) {
          item.title = built;
        } else if (fieldMapping.title != null && row[fieldMapping.title] != null) {
          const t = String(row[fieldMapping.title]).trim();
          if (t) item.title = t;
        }
      }

      const imgCol = fieldMapping.imageUrls;
      const hasImageUrls =
        Imp &&
        imgCol !== undefined &&
        imgCol !== null &&
        !Number.isNaN(Number(imgCol)) &&
        Imp.parseUrlsFromCell(row[imgCol]).length > 0;

      if (Object.keys(item).length === 0 && !hasImageUrls) {
        return;
      }
      if (Object.keys(item).length === 0 && hasImageUrls) {
        item.title = `Listing (row ${index + 1})`;
      }

      if (!item.id) {
        item.id = idFn();
      }

      item._rowIndex = index + 1;
      item._identifier = row[identifierColumn] ? row[identifierColumn].toString().trim() : '';

      if (!item.images) {
        item.images = [];
      }

      processedItems.push(item);
    } catch (e) {
      console.warn(`Error processing row ${index + 1}:`, e);
    }
  });

  return { processedItems, identifierColumn };
}

if (typeof window !== 'undefined') {
  window.CsvProcessing = {
    buildConcatTitleFromRow,
    buildTitleFromRow,
    resolveIdentifierColumn,
    collectFieldMappingFromRoot,
    processCsvDataRows
  };
}

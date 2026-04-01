// Field mapping utility - maps CSV column names to Facebook field names

const FACEBOOK_FIELDS = {
  title: ['title', 'name', 'brand', 'item name', 'product name', 'item'],
  price: ['price', 'cost', 'amount', 'value'],
  category: ['category', 'type', 'item category', 'product category'],
  condition: ['condition', 'used condition', 'item condition', 'quality'],
  description: ['description', 'desc', 'details', 'item description'],
  size: ['size'],
  materials: ['materials', 'material', 'fabric', 'composition']
};

// CSV columns that hold comma-separated image URLs (not sent to Facebook as text)
const IMAGE_URL_COLUMN_ALIASES = [
  'pics',
  'pictures',
  'images',
  'image urls',
  'image url',
  'photo urls',
  'photo url',
  'image links',
  'photos',
  '图片',
  '照片',
  '相片',
  '图链',
  '圖片'
];

const INTERNAL_MAPPING_KEYS = new Set(['imageUrls']);

function normalizeHeaderName(csvColumnName) {
  if (csvColumnName === undefined || csvColumnName === null) return '';
  return csvColumnName
    .toString()
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

// Auto-detect Facebook field from CSV column name
function detectField(csvColumnName) {
  if (!csvColumnName) return null;

  const normalized = normalizeHeaderName(csvColumnName);
  
  for (const [fbField, variations] of Object.entries(FACEBOOK_FIELDS)) {
    if (variations.includes(normalized)) {
      return fbField;
    }
  }
  
  return null;
}

function detectImageUrlColumn(csvColumnName) {
  if (!csvColumnName) return false;
  const normalized = normalizeHeaderName(csvColumnName);
  return IMAGE_URL_COLUMN_ALIASES.some((alias) => {
    if (normalized === alias) return true;
    if (alias === 'pics') return /\bpics\b/i.test(csvColumnName.toString());
    if (alias.length <= 2) return normalized === alias;
    return normalized.includes(alias);
  });
}

// Map CSV headers to Facebook fields
function mapCSVHeaders(headers) {
  const mapping = {};
  const unmappedColumns = [];
  let suggestedImageUrlsColumn = null;

  headers.forEach((header, index) => {
    const fbField = detectField(header);
    if (fbField) {
      if (!mapping[fbField]) {
        mapping[fbField] = index;
      }
    } else {
      unmappedColumns.push({ index, name: header });
    }
    if (suggestedImageUrlsColumn === null && detectImageUrlColumn(header)) {
      suggestedImageUrlsColumn = index;
    }
  });

  return { mapping, unmappedColumns, suggestedImageUrlsColumn };
}

// Apply field mapping to CSV row
function applyMapping(row, mapping) {
  const item = {};

  for (const [fbField, csvIndex] of Object.entries(mapping)) {
    if (INTERNAL_MAPPING_KEYS.has(fbField)) {
      continue;
    }
    const value = row[csvIndex];
    if (value !== undefined && value !== null && value.toString().trim() !== '') {
      item[fbField] = value.toString().trim();
    }
  }
  
  return item;
}

// Get field display name
function getFieldDisplayName(field) {
  const names = {
    title: 'Title',
    price: 'Price',
    category: 'Category',
    condition: 'Condition',
    description: 'Description',
    size: 'Size',
    materials: 'Materials',
    imageUrls: 'Image URLs (optional)'
  };
  return names[field] || field;
}

// Export functions to window for use in other scripts
if (typeof window !== 'undefined') {
  window.FieldMapper = {
    detectField,
    detectImageUrlColumn,
    normalizeHeaderName,
    mapCSVHeaders,
    applyMapping,
    getFieldDisplayName,
    FACEBOOK_FIELDS,
    IMAGE_URL_COLUMN_ALIASES
  };
}


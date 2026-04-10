// Field mapping utility - maps CSV column names to Facebook field names

const FACEBOOK_FIELDS = {
  title: ['title', 'name', 'item name', 'product name', 'item', 'title of the item'],
  price: ['price', 'cost', 'amount', 'value', 'price (numbers only)'],
  category: ['category', 'type', 'item category', 'product category'],
  condition: [
    'condition',
    'used condition',
    'item condition',
    'quality',
    'condition of the item'
  ],
  description: [
    'description',
    'desc',
    'details',
    'item description',
    'description (include relevant details, dimensions, and reasons for selling)'
  ],
  size: ['size'],
  materials: ['materials', 'material', 'fabric', 'composition'],
  listingBrand: ['brand', 'product brand', 'item brand'],
  colour: ['colour', 'color'],
  sku: ['sku'],
  availability: ['availability'],
  productTags: ['product tags', 'tags'],
  localTransactionOptions: [
    'local transaction options',
    'transaction options',
    'meetup options',
    'meetup'
  ],
  listingManagement: ['listing management settings', 'listing management']
};

// Long Google Form–style headers: map by normalized prefix when not an exact alias match
const FIELD_HEADER_PREFIXES = [
  ['title', (n) => n.startsWith('title of the item')],
  ['price', (n) => n.startsWith('price (numbers only)') || n.startsWith('price(numbers only)')],
  ['condition', (n) => n.startsWith('condition of the item')],
  [
    'description',
    (n) =>
      n.startsWith('description (include') ||
      (n.startsWith('description') && n.length > 'description'.length)
  ],
  ['availability', (n) => n.startsWith('availability')],
  ['productTags', (n) => n.startsWith('product tags')],
  ['localTransactionOptions', (n) => n.startsWith('local transaction')],
  ['listingManagement', (n) => n.startsWith('listing management')],
  ['colour', (n) => n.startsWith('colour') || n.startsWith('color')]
];

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
  '圖片',
  // "New Product Listing Form" sample CSV — Upload Photos / Videos (Max 5) of the Item
  'upload photos / videos',
  'upload photos',
  'upload videos',
  'max 5) of the item'
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

  for (const [fbField, matches] of FIELD_HEADER_PREFIXES) {
    if (matches(normalized)) {
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
    imageUrls: 'Image URLs (optional)',
    availability: 'Availability',
    productTags: 'Product tags',
    localTransactionOptions: 'Local transaction / meetup',
    listingManagement: 'Listing management',
    listingBrand: 'Brand (More details)',
    colour: 'Colour / color',
    sku: 'SKU'
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


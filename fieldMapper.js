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

// Auto-detect Facebook field from CSV column name
function detectField(csvColumnName) {
  if (!csvColumnName) return null;
  
  const normalized = csvColumnName.trim().toLowerCase();
  
  for (const [fbField, variations] of Object.entries(FACEBOOK_FIELDS)) {
    if (variations.includes(normalized)) {
      return fbField;
    }
  }
  
  return null;
}

// Map CSV headers to Facebook fields
function mapCSVHeaders(headers) {
  const mapping = {};
  const unmappedColumns = [];
  
  headers.forEach((header, index) => {
    const fbField = detectField(header);
    if (fbField) {
      if (!mapping[fbField]) {
        mapping[fbField] = index;
      }
    } else {
      unmappedColumns.push({ index, name: header });
    }
  });
  
  return { mapping, unmappedColumns };
}

// Apply field mapping to CSV row
function applyMapping(row, mapping) {
  const item = {};
  
  for (const [fbField, csvIndex] of Object.entries(mapping)) {
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
    materials: 'Materials'
  };
  return names[field] || field;
}

// Export functions to window for use in other scripts
if (typeof window !== 'undefined') {
  window.FieldMapper = {
    detectField,
    mapCSVHeaders,
    applyMapping,
    getFieldDisplayName,
    FACEBOOK_FIELDS
  };
}


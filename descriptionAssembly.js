// Shared: how Marketplace description text is assembled (workshop preview + content script fill)

function getDescriptionBlockText(key, item, customDescription) {
  switch (key) {
    case 'title':
      return item.title ? String(item.title).trim() : '';
    case 'size':
      return item.size && String(item.size).trim() ? `Size: ${String(item.size).trim()}` : '';
    case 'materials':
      return item.materials && String(item.materials).trim()
        ? `Materials: ${String(item.materials).trim()}`
        : '';
    case 'condition':
      return item.condition && String(item.condition).trim()
        ? `Condition: ${String(item.condition).trim()}`
        : '';
    case 'csvDescription':
      return item.description ? String(item.description).trim() : '';
    case 'custom':
      return customDescription ? String(customDescription).trim() : '';
    default:
      return '';
  }
}

const DESCRIPTION_ASSEMBLY_KEYS = new Set([
  'title',
  'size',
  'materials',
  'condition',
  'csvDescription',
  'custom'
]);

function buildMarketplaceDescription(order, item, customDescription) {
  if (!Array.isArray(order)) return '';
  const parts = [];
  const seen = new Set();
  for (const key of order) {
    if (typeof key !== 'string' || !DESCRIPTION_ASSEMBLY_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    const text = getDescriptionBlockText(key, item, customDescription);
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
}

/** Map one CSV row + field mapping to an item-shaped object for description blocks. */
function itemPreviewFromCsvRow(row, fieldMapping) {
  const item = {};
  if (!row || !fieldMapping) return item;
  const keys = ['title', 'size', 'materials', 'condition', 'description'];
  for (const fbKey of keys) {
    const idx = fieldMapping[fbKey];
    if (idx === undefined || idx === null || Number.isNaN(Number(idx))) continue;
    const v = row[Number(idx)];
    if (v === undefined || v === null) continue;
    const t = String(v).trim();
    if (!t) continue;
    if (fbKey === 'description') item.description = t;
    else item[fbKey] = t;
  }
  return item;
}

if (typeof window !== 'undefined') {
  window.DescriptionAssembly = {
    getDescriptionBlockText,
    buildMarketplaceDescription,
    itemPreviewFromCsvRow,
    DESCRIPTION_ASSEMBLY_KEYS
  };
}

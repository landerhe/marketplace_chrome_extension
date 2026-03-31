// CSV Parser - handles parsing CSV files with multiple delimiters

function parseCSV(text, delimiter = null) {
  // Detect delimiter if not provided
  if (!delimiter) {
    delimiter = detectDelimiter(text);
  }
  
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse header
  const headers = parseCSVLine(lines[0], delimiter);
  
  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i], delimiter);
    // Pad row if it's shorter than headers (handle missing trailing commas)
    while (row.length < headers.length) {
      row.push('');
    }
    // Trim row if it's longer (shouldn't happen, but be safe)
    if (row.length > headers.length) {
      row.splice(headers.length);
    }
    rows.push(row);
  }
  
  return { headers, rows };
}

function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

function detectDelimiter(text) {
  // Check first few lines for common delimiters
  const firstLine = text.split(/\r?\n/)[0];
  
  const delimiters = [',', ';', '\t', '|'];
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  for (const delim of delimiters) {
    const count = (firstLine.match(new RegExp('\\' + delim, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delim;
    }
  }
  
  return detectedDelimiter;
}

// Convert File to text
async function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Export functions to window for use in other scripts
if (typeof window !== 'undefined') {
  window.CSVParser = {
    parseCSV,
    fileToText,
    detectDelimiter
  };
}


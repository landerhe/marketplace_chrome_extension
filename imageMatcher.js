// Image Matcher - matches images to CSV rows based on naming convention
// Format: Row{rowNumber}_{identifier}_{imageNumber}.{ext}

function parseImageFilename(filename) {
  if (!filename) {
    console.warn('parseImageFilename: filename is empty or undefined');
    return { valid: false };
  }
  
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  console.log(`Parsing filename: "${filename}" → "${nameWithoutExt}"`);
  
  // Pattern: Row{number}_{identifier}_{number}
  // Handle cases with trailing spaces: Row4_Jeans Jacket _1
  // Use non-greedy match for identifier, but allow spaces before the final number
  const match = nameWithoutExt.match(/^Row(\d+)_(.+?)\s*_(\d+)$/i);
  
  if (match) {
    const result = {
      rowNumber: parseInt(match[1], 10),
      identifier: match[2].trim(), // Trim whitespace from identifier
      imageNumber: parseInt(match[3], 10),
      valid: true
    };
    console.log(`✓ Matched pattern 1: Row${result.rowNumber}, Identifier: "${result.identifier}", Image#: ${result.imageNumber}`);
    return result;
  }
  
  // Try alternative pattern: Row{number}_{identifier} (no image number)
  const match2 = nameWithoutExt.match(/^Row(\d+)_(.+)$/i);
  if (match2) {
    const result = {
      rowNumber: parseInt(match2[1], 10),
      identifier: match2[2].trim(), // Trim whitespace from identifier
      imageNumber: 1, // Default to 1 if not specified
      valid: true
    };
    console.log(`✓ Matched pattern 2: Row${result.rowNumber}, Identifier: "${result.identifier}", Image#: ${result.imageNumber}`);
    return result;
  }
  
  console.warn(`✗ Failed to parse: "${filename}"`);
  return { valid: false };
}

// Match images to CSV rows
function matchImagesToRows(images, csvRows, identifierColumnIndex = 0) {
  console.log('Starting image matching...');
  console.log(`Total images: ${images.length}, Total CSV rows: ${csvRows.length}`);
  
  // Group images by row number
  const imagesByRow = {};
  
  images.forEach((image, index) => {
    const filename = image.name || image.filename || '';
    const parsed = parseImageFilename(filename);
    
    if (parsed.valid) {
      console.log(`Parsed: ${filename} → Row${parsed.rowNumber}, Image #${parsed.imageNumber}`);
      if (!imagesByRow[parsed.rowNumber]) {
        imagesByRow[parsed.rowNumber] = [];
      }
      
      // Preserve the original File object - don't spread it as that loses the File prototype
      // Instead, attach parsed info as properties
      image.parsed = parsed;
      image.sortOrder = parsed.imageNumber;
      
      imagesByRow[parsed.rowNumber].push(image);
    } else {
      console.warn(`Failed to parse image filename: ${filename}`);
    }
  });
  
  console.log('Images grouped by row:', Object.keys(imagesByRow).map(k => `Row${k}: ${imagesByRow[k].length} images`).join(', '));
  
  // Sort images within each row by image number
  Object.keys(imagesByRow).forEach(rowNum => {
    imagesByRow[rowNum].sort((a, b) => a.sortOrder - b.sortOrder);
  });
  
  // Match to CSV rows by row number only
  // Image filenames use Row{N} where Row2 matches the first CSV data row (index 0)
  // So: CSV row index 0 → Row2, CSV row index 1 → Row3, etc.
  // Formula: imageRowNumber = CSV row index + 2
  const matchedImages = {};
  
  csvRows.forEach((row, index) => {
    // CSV row index 0 should match Row2, so: imageRowNumber = index + 2
    const imageRowNumber = index + 2;
    const title = row[0] || row[identifierColumnIndex] || '';
    
    if (imagesByRow[imageRowNumber]) {
      console.log(`✓ Matched CSV row ${index} (${title}) → Row${imageRowNumber} (${imagesByRow[imageRowNumber].length} images)`);
      // Match by row number only - no identifier checking needed
      matchedImages[index] = imagesByRow[imageRowNumber];
    } else {
      console.log(`✗ No match for CSV row ${index} (${title}) - Expected Row${imageRowNumber}, but only have: ${Object.keys(imagesByRow).join(', ')}`);
    }
  });
  
  console.log(`Total matched: ${Object.keys(matchedImages).length} CSV rows with images`);
  return matchedImages;
}

// Export functions to window for use in other scripts
if (typeof window !== 'undefined') {
  window.ImageMatcher = {
    parseImageFilename,
    matchImagesToRows
  };
}


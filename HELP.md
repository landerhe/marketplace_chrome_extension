# Facebook Marketplace Auto-Fill - Help Guide

## Table of Contents

1. [CSV Format Guide](#csv-format-guide)
2. [Image Naming](#image-naming)
3. [Field Mapping](#field-mapping)
4. [Step-by-Step Tutorial](#step-by-step-tutorial)
5. [Facebook Field Reference](#facebook-field-reference)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

## CSV Format Guide

### Required Columns

Your CSV file must have at least these columns (column names can vary):

- **Title**: The product title (required)
- **Price**: The product price (required)

### Optional Columns

- **Category**: Must match Facebook's exact category name
- **Condition**: Must match Facebook's exact condition name  
- **Description**: Product description
- **Size**: Product size
- **Materials**: Product materials

### CSV File Requirements

- **Format**: CSV (Comma-Separated Values) or TXT file
- **Delimiters**: Comma, semicolon, or tab (auto-detected)
- **Headers**: Must be on the first row
- **Encoding**: UTF-8 recommended
- **Max Size**: 10MB

### CSV Example

```csv
Title,Price,Category,Condition,Size,Materials,Description
Vintage Jeans,25.00,Men's clothing & shoes,Used - Like New,32,Denim,Great condition vintage jeans
Cotton T-Shirt,15.00,Men's clothing & shoes,New,Medium,Cotton,New with tags
```

### Column Name Variations

The extension auto-detects common column name variations:

**Title**: Title, Name, Brand, Item Name, Product Name, Item  
**Price**: Price, Cost, Amount, Value  
**Category**: Category, Type, Item Category, Product Category  
**Condition**: Condition, Used condition, Item Condition, Quality  
**Description**: Description, Desc, Details, Item Description  
**Size**: Size  
**Materials**: Materials, Material, Fabric, Composition

### Tips

- Use quotes for values containing commas: `"Smith, John"`
- Empty cells are allowed - fields will be left unselected
- You can have additional columns that aren't mapped to Facebook fields

## Image Naming

### Naming Format

Images must be named using this format:

```
Row{rowNumber}_{identifier}_{imageNumber}.{ext}
```

Where:
- `{rowNumber}`: Row number in your CSV (starting from 1)
- `{identifier}`: Value from the identifier column in your CSV (column 5 by default)
- `{imageNumber}`: Sequence number for multiple images (1, 2, 3, etc.)
- `{ext}`: File extension (jpg, png, webp, heic, heif)

### Examples

For CSV row 11 with identifier "Andrea Martin furry jacket Printed on the back":

```
Row11_Andrea Martin furry jacket Printed on the back_1.jpg
Row11_Andrea Martin furry jacket Printed on the back_2.jpg
Row11_Andrea Martin furry jacket Printed on the back_3.jpg
```

For CSV row 5 with identifier "Blue Dress":

```
Row5_Blue Dress_1.jpg
Row5_Blue Dress_2.png
```

### Important Notes

- **Row numbers start at 1** (first data row is Row1, not Row0)
- **Identifier must match** the value in your CSV's identifier column (case-insensitive, partial matches allowed)
- **Image numbers** are sequential (1, 2, 3...) for multiple images of the same product
- **File extensions** are case-insensitive (.jpg, .JPG, .jpeg all work)

### Image Requirements

- **Formats**: JPG, JPEG, PNG, WEBP, HEIC, HEIF
- **Max Size**: 10MB per image
- **Max per Item**: 9 images (Facebook limit is 10, but we reserve 1 for frame.png if used)

## Field Mapping

### Auto-Detection

The extension automatically detects common column names and maps them to Facebook fields. If your CSV uses standard column names, mapping will happen automatically.

### Manual Mapping

If auto-detection doesn't work:

1. Upload your CSV file
2. Review the field mapping section
3. Use the dropdown menus to select which CSV column maps to each Facebook field
4. Select "(None)" if a field shouldn't be mapped

### Identifier Column

The identifier column (default: column 5, index 4) is used to match images to CSV rows. Make sure this column contains a unique identifier for each product.

## Step-by-Step Tutorial

### 1. Prepare Your Data

**Create CSV file:**
```
Title,Price,Category,Condition
My Product,25.99,Men's clothing & shoes,Used - Like New
```

**Name your images:**
```
Row1_My Product_1.jpg
Row1_My Product_2.jpg
```

### 2. Upload CSV

1. Click the extension icon
2. Go to the "CSV" tab
3. Click "Choose CSV File" or drag and drop your CSV file
4. Review the field mapping
5. Click "Process CSV"

### 3. Upload Images

1. Go to the "Images" tab
2. Click "Choose Images" or drag and drop your image files
3. Click "Match Images to Items"
4. Check that images matched correctly

### 4. Fill Forms

1. Navigate to `https://www.facebook.com/marketplace/create/listing`
2. Click the extension icon
3. Go to the "Items" tab
4. Select an item from the list
5. Click "Fill Form"
6. Review the filled form and submit

## Facebook Field Reference

### Category Values

Use Facebook's exact category names. Common examples:
- Men's clothing & shoes
- Women's clothing & shoes
- Electronics
- Home & garden
- Sports & outdoors

**Note**: Category names may vary by region. Check Facebook's dropdown for exact names in your area.

### Condition Values

Use Facebook's exact condition names:
- New
- Used - Like New
- Used - Good
- Used - Fair

**Important**: The extension does NOT transform values. "Worn" will NOT become "Used - Fair". You must use Facebook's exact values.

### Field Requirements

- **Title**: Required, max 100 characters
- **Price**: Required, numeric value
- **Category**: Optional but recommended
- **Condition**: Optional but recommended
- **Description**: Optional, max 8000 characters

## Troubleshooting

### CSV Issues

**Problem**: CSV file not loading  
**Solution**: 
- Check file format is CSV or TXT
- Verify file size is under 10MB
- Ensure first row contains headers
- Check file encoding (use UTF-8)

**Problem**: No items processed  
**Solution**:
- Check that CSV has data rows (not just headers)
- Verify field mapping is correct
- Ensure at least Title or Price is mapped

**Problem**: Wrong columns mapped  
**Solution**:
- Use manual field mapping dropdowns
- Check your CSV column names match expected variations

### Image Issues

**Problem**: Images not matching to items  
**Solution**:
- Verify image naming format: `Row{number}_{identifier}_{number}.{ext}`
- Check row numbers start from 1 (first data row = Row1)
- Ensure identifier matches CSV column value (case-insensitive)
- Verify identifier column is correct (default is column 5)

**Problem**: Some images not matched  
**Solution**:
- Check image filenames for typos
- Verify identifier in filename matches CSV exactly
- Ensure image number format is correct (_1, _2, etc.)

**Problem**: Image upload fails  
**Solution**:
- Check file size (max 10MB per image)
- Verify file format is supported (JPG, PNG, WEBP, HEIC, HEIF)
- Try uploading fewer images at once

### Form Filling Issues

**Problem**: Form fields not filling  
**Solution**:
- Ensure you're on Facebook Marketplace create page
- Refresh the page and try again
- Check browser console (F12) for errors
- Verify field values match Facebook's exact options

**Problem**: Category/Condition not selected  
**Solution**:
- Verify values in CSV match Facebook's exact field names
- Check Facebook's dropdown to see available options
- The extension won't transform values - use Facebook's exact names

**Problem**: Images not uploading to form  
**Solution**:
- Verify images were matched successfully
- Check image storage quota (clear browser data if needed)
- Try selecting a different item

## FAQ

**Q: Do I need to use exact Facebook field values?**  
A: Yes. The extension does not transform values. Use Facebook's exact category and condition names.

**Q: Can I skip mapping a field?**  
A: Yes. Select "(None)" in the field mapping dropdown for any field you don't want to fill.

**Q: What if my CSV has extra columns?**  
A: That's fine. Only mapped columns will be used. Extra columns are ignored.

**Q: Can I change the identifier column?**  
A: Currently, the identifier column defaults to column 5 (index 4). This is not configurable in the UI yet.

**Q: How many images can I upload?**  
A: Up to 9 images per item (Facebook limit is 10, but we reserve 1 for frame.png if used).

**Q: Where are my images stored?**  
A: Images are stored in your browser's IndexedDB. They persist until you clear browser data.

**Q: Can I use this on multiple computers?**  
A: Data is stored locally per browser. You'll need to upload CSV and images on each computer.

**Q: What if I update my CSV?**  
A: Upload the new CSV file. It will replace the old data. Images need to be re-matched if row numbers changed.

**Q: Why don't my condition values work?**  
A: The extension uses exact matching. Check Facebook's dropdown for the exact condition names (e.g., "Used - Like New" not "Like New").

**Q: Can I batch process multiple listings?**  
A: Yes! Process all items from CSV, then go through each one and click "Fill Form" for each.


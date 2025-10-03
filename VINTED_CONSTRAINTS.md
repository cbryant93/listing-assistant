# Vinted Data Constraints & Validation Rules

## 1. Photos
- **Count**: 1-20 photos (minimum 1, maximum 20)
- **Dimensions**: Recommended 1000x1500px (2:3 ratio) or 800x800px
- **File Size**: Unknown - need to determine through testing
- **Format**: JPG, PNG, GIF (JPG recommended)
- **Quality**: Natural daylight, no filters/flash, multiple angles

## 2. Condition (Fixed Enum Values)
- `new_with_tags` - "New with tags"
- `new_without_tags` - "New without tags"
- `very_good` - "Very good"
- `good` - "Good"
- `satisfactory` - "Satisfactory"
- `not_functional` - "Not fully functional" (electronics only)

## 3. Colors
- Multiple colors allowed (typically 1-3)
- Uses color IDs from Vinted API ontologies
- Common colors: Black, White, Grey, Red, Blue, Green, Yellow, Orange, Pink, Purple, Brown, Beige
- **Note**: Exact list requires API ontologies fetch

## 4. Materials
- Up to 3 materials per item
- Uses material IDs from Vinted API ontologies
- Common: Cotton, Polyester, Wool, Silk, Denim, Leather, Synthetic
- **Note**: Exact list requires API ontologies fetch

## 5. Category
- Hierarchical structure (Women → Tops → T-shirts)
- Gender encoded in root categories (Women, Men, Kids)
- Category-dependent fields (sizes vary by category)
- **Note**: Full category tree requires API ontologies fetch

## 6. Size
- Varies by category and region
- Clothing: XS, S, M, L, XL, XXL or numeric (6, 8, 10, 12, etc.)
- Shoes: UK/EU/US sizes
- **Note**: Size options depend on selected category

## 7. Brand
- Free text or selection from predefined list
- Can use "Other" if brand not listed
- **Note**: Brand list requires API ontologies fetch

## 8. Text Fields
- **Title**: No strict character limit (recommend 60-100 chars for readability)
- **Description**: No strict character limit (recommend clear, keyword-rich text + hashtags)
- **Best Practice**: Include Brand + Item Type + Color + Size in title

## 9. Price
- **Minimum**: £1.00 (based on marketplace data)
- **Maximum**: No strict limit (£500+ supported, 3% flat fee)
- **Increments**: £0.50 or £1.00 recommended
- **Note**: Unusually low/high prices may be flagged as auctions

## 10. Parcel Size
- Required field for shipping
- Options provided by Vinted based on carrier
- **Note**: Options require API or manual testing

## Validation Strategy for Phase 1

### Must Implement:
- Photo count validation (1-20)
- Photo format validation (JPG, PNG, GIF)
- Photo dimension recommendations (resize to 1000x1500 or 800x800)
- Condition enum validation
- Price validation (min £1.00, increments of £0.50)
- Title/description length recommendations

### Can Defer to Phase 2:
- Full category tree integration (use free text for now)
- Color/Material ID mappings (use free text for now)
- Size validation per category (use free text for now)
- Brand list integration (use free text for now)

### Testing Edge Cases:
- 0 photos (should fail)
- 21 photos (should fail)
- Oversized images (compress/resize)
- Invalid file formats (.bmp, .tiff)
- Invalid condition values
- Price < £1.00
- Empty required fields

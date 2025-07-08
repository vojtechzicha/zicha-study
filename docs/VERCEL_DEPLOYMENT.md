# Vercel Deployment Notes

## Study Notes DOCX Conversion

The study notes feature uses Mammoth.js for converting DOCX files to HTML, which is fully compatible with Vercel's deployment environment.

### How it works:

1. **Local Development**: Full functionality with on-demand conversion
2. **Vercel Production**: Full functionality with on-demand conversion
   - Converts DOCX files to HTML using Mammoth.js
   - Caches conversions in the database for performance
   - Supports regeneration with `?flush=1` parameter

### Features:

1. **Automatic conversion**: DOCX files are converted on-demand when accessed
2. **Smart caching**: Checks OneDrive timestamps to determine if regeneration is needed
3. **Media handling**: Extracts and stores images from DOCX files
4. **TOC generation**: Automatically generates table of contents from headings

### Database caching:

All converted documents are stored in the database with:
- HTML content
- Media files (images) 
- Metadata (title, timestamps)
- Cache keys for versioning

This provides optimal performance while maintaining the ability to regenerate content when source files are updated.
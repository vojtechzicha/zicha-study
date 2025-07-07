# Vercel Deployment Notes

## Study Notes DOCX Conversion

The study notes feature requires Pandoc for converting DOCX files to HTML. However, Pandoc is not available on Vercel's deployment environment.

### How it works:

1. **Local Development**: Full functionality with Pandoc installed locally
2. **Vercel Production**: 
   - Serves previously cached conversions from the database
   - Shows a user-friendly message if no cache exists
   - Cannot generate new conversions or regenerate with `?flush=1`

### Solutions:

1. **Pre-generate locally**: Generate all study notes locally before deploying
2. **Alternative hosting**: Use a VPS or Docker-based hosting that supports Pandoc
3. **Serverless function**: Use a separate service for document conversion

### Setting up alternative hosting:

```dockerfile
# Dockerfile example
FROM node:18-alpine
RUN apk add --no-cache pandoc
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]
```

### Database caching:

All converted documents are stored in the database with:
- HTML content
- Media files (images)
- Metadata (title, timestamps)

This allows Vercel deployments to serve previously converted documents even without Pandoc.
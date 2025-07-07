// Pandoc availability check and alternative for Vercel deployment

export function isPandocAvailable(): boolean {
  // On Vercel, Pandoc is not available
  return process.env.VERCEL !== '1'
}

export function getPandocUnavailableMessage(): string {
  return `
    <div style="padding: 2rem; text-align: center; font-family: system-ui, -apple-system, sans-serif;">
      <h1 style="color: #dc2626; margin-bottom: 1rem;">Konverze dokumentu není dostupná</h1>
      <p style="color: #4b5563; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto;">
        Omlouváme se, ale funkce konverze DOCX souborů není momentálně dostupná na produkčním serveru. 
        Tato funkce vyžaduje nástroj Pandoc, který není na Vercel podporován.
      </p>
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 0.5rem; padding: 1rem; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #92400e; margin-bottom: 0.5rem;">Řešení:</h3>
        <ul style="text-align: left; color: #78350f; margin: 0; padding-left: 1.5rem;">
          <li>Použijte lokální verzi aplikace pro generování studijních zápisů</li>
          <li>Kontaktujte správce pro vygenerování zápisu</li>
          <li>Počkejte na implementaci alternativního řešení</li>
        </ul>
      </div>
    </div>
  `
}

export function getPandocInstallInstructions(): string {
  return `
    <div style="padding: 2rem; font-family: monospace; background-color: #f3f4f6; border-radius: 0.5rem;">
      <h3>Pandoc Installation Required</h3>
      <p>To enable DOCX conversion on this server, install Pandoc:</p>
      <pre style="background-color: #1f2937; color: #f3f4f6; padding: 1rem; border-radius: 0.375rem; overflow-x: auto;">
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y pandoc

# Alpine Linux (for Docker)
apk add --no-cache pandoc

# Using Docker
FROM node:18-alpine
RUN apk add --no-cache pandoc
      </pre>
    </div>
  `
}
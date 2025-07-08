# OneDrive OAuth Setup for Refresh Tokens

This application uses Microsoft OAuth for OneDrive integration. To enable automatic token refresh (so users don't have to re-authenticate every hour), you need to configure OAuth credentials.

## Prerequisites

1. An Azure App Registration that matches your Supabase Auth configuration
2. The same Azure app that Supabase uses for authentication

## Required Environment Variables

Add these to your `.env` file:

```bash
# The Azure AD client ID (same as configured in Supabase)
NEXT_PUBLIC_SUPABASE_AZURE_CLIENT_ID=your_client_id_here

# The Azure AD client secret
SUPABASE_AZURE_CLIENT_SECRET=your_client_secret_here
```

## Getting the Values

### Client ID
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Find your app (the same one configured in Supabase)
4. Copy the "Application (client) ID"

### Client Secret
1. In your app registration, go to "Certificates & secrets"
2. Under "Client secrets", click "New client secret"
3. Add a description and expiration
4. Copy the secret value immediately (it won't be shown again)

## Important Notes

- The client ID and secret must match the app configured in Supabase Auth
- The redirect URI in Azure must include `{YOUR_SUPABASE_URL}/auth/v1/callback`
- Required API permissions: `Files.Read`, `Files.Read.All`, `Files.ReadWrite`, `offline_access`
- The `offline_access` scope is crucial for getting refresh tokens

## How It Works

1. When users log in via Supabase Auth, they get an access token and refresh token
2. The access token expires after 1 hour
3. Our token manager uses the refresh token and client credentials to get new access tokens
4. This happens automatically without user intervention

## Troubleshooting

If you see "Access token expired and refresh failed" errors:

1. Check that both environment variables are set correctly
2. Verify the client secret hasn't expired in Azure
3. Ensure the Azure app has the correct API permissions
4. Check that `offline_access` is included in the login scopes
5. Try logging out and logging back in to get a fresh refresh token

## Database Schema

The refresh tokens are stored in the `user_oauth_tokens` table with proper RLS policies. This table is created by the migration `20250108_add_oauth_tokens_table.sql`.
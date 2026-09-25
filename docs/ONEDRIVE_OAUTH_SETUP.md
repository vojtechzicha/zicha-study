# Microsoft Entra ID and OneDrive setup

Sign-in and OneDrive access both use one Microsoft Entra ID app registration. Auth.js signs the user in and receives the OneDrive access token in the same step. The app needs no separate OneDrive credentials.

## Register the app

1. In the [Azure portal](https://portal.azure.com), go to Microsoft Entra ID > App registrations > New registration.
2. Under supported account types, choose "Personal Microsoft accounts only". `auth.ts` uses the personal-account (consumers) tenant as its issuer, so work and school accounts cannot sign in.
3. Add a redirect URI with the Web platform for each place the app runs:
   - Local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Production: `https://www.zicha.study/api/auth/callback/microsoft-entra-id`

   Preview deployments need no URI of their own. They sign in through production. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).
4. Copy the Application (client) ID into `AUTH_MICROSOFT_ENTRA_ID_ID`.
5. Under Certificates & secrets, create a client secret. Copy its value into `AUTH_MICROSOFT_ENTRA_ID_SECRET` right away, because Azure shows it only once. Note the expiry date.

## Permissions

At sign-in the app requests these delegated Microsoft Graph scopes:

```
openid email profile offline_access User.Read Files.Read.All Files.ReadWrite.All
```

You can add them under API permissions, or let the user grant them at sign-in. `offline_access` is required: without it Microsoft returns no refresh token. The app passes `prompt=consent`, so the consent screen appears at every sign-in.

## Token handling

The Microsoft access and refresh tokens are kept in the encrypted Auth.js session cookie (a JWT). They are not stored in the database. The `jwt` callback in `auth.ts` refreshes the access token when it is within 60 seconds of expiry. Server code reads the token with `getOneDriveToken()` or `makeGraphRequest()` from `lib/utils/onedrive.ts`.

## Troubleshooting

If a refresh fails, OneDrive requests throw "Access token expired and refresh failed". To fix it:

1. Sign out and sign in again. This gets a new refresh token.
2. If that does not help, check in Azure whether the client secret has expired. Also check that `AUTH_MICROSOFT_ENTRA_ID_SECRET` matches it in every environment.

If sign-in ends on the Auth.js error page with `error=AccessDenied`, your address is not in `ALLOWED_EMAILS`. When that variable is set, the `signIn` callback rejects every address that is not in the list.

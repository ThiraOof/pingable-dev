// OAuth 2.0 / OIDC provider registry.
//
// We deliberately avoid Passport and per-provider SDKs — the flow is a plain
// Authorization-Code exchange done with raw `fetch` (same spirit as the AI
// mentor's direct Claude API calls). Each provider declares its endpoints,
// scopes, env-backed credentials, and a `parseProfile` that normalizes the
// userinfo payload into `{ sub, email, emailVerified, name }`.
//
// Adding Apple later: add an `apple` entry here (its client secret is an
// ES256-signed JWT, so give it a `clientSecret: () => signAppleSecret()` that
// builds the JWT with node:crypto) — the service and routes are provider-agnostic.

// Browser-facing base URL; callback URLs must be registered verbatim in each
// provider's developer console.
const baseUrl = () =>
  (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');

export function callbackUrl(provider) {
  return `${baseUrl()}/auth/oauth/${provider}/callback`;
}

export const PROVIDERS = {
  google: {
    label: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    // Ask for a refresh-free consent screen; `select_account` lets the user
    // pick which Google account even if already signed in.
    authParams: { prompt: 'select_account' },
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    parseProfile: (info) => ({
      sub: info.sub,
      email: (info.email || '').toLowerCase(),
      // Google returns email_verified as a real boolean on the OIDC userinfo.
      emailVerified: info.email_verified === true || info.email_verified === 'true',
      name: info.name || info.given_name || '',
    }),
  },

  facebook: {
    label: 'Facebook',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    scope: 'email public_profile',
    authParams: {},
    clientId: () => process.env.FACEBOOK_CLIENT_ID,
    clientSecret: () => process.env.FACEBOOK_CLIENT_SECRET,
    parseProfile: (info) => ({
      sub: info.id,
      email: (info.email || '').toLowerCase(),
      // Facebook only hands back an email once the user has confirmed it, so
      // its presence implies verification. It may be absent (phone-only signup).
      emailVerified: !!info.email,
      name: info.name || '',
    }),
  },
};

// A provider is usable only once both halves of its credential pair are set.
export function isEnabled(provider) {
  const p = PROVIDERS[provider];
  return !!(p && p.clientId() && p.clientSecret());
}

// For the login/register views: the buttons to actually render.
export function enabledProviders() {
  return Object.entries(PROVIDERS)
    .filter(([key]) => isEnabled(key))
    .map(([key, p]) => ({ key, label: p.label }));
}

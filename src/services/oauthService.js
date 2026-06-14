// OAuth Authorization-Code flow, provider-agnostic. The route layer owns the
// `state` CSRF token + session plumbing; this module owns the three network
// hops (authorize URL → token exchange → userinfo) and the find-or-create that
// maps an external identity onto our `User` collection.
import { randomUUID } from 'crypto';
import User from '../models/User.js';
import { PROVIDERS, callbackUrl } from '../config/oauth.js';

// Step 1 — the URL we redirect the browser to. `state` is round-tripped and
// re-checked at the callback to defeat CSRF on the OAuth handshake.
export function buildAuthUrl(provider, state) {
  const p = PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: p.clientId(),
    redirect_uri: callbackUrl(provider),
    response_type: 'code',
    scope: p.scope,
    state,
    ...(p.authParams || {}),
  });
  return `${p.authUrl}?${params.toString()}`;
}

// Step 2 — swap the one-time `code` for an access token.
export async function exchangeCode(provider, code) {
  const p = PROVIDERS[provider];
  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: p.clientId(),
      client_secret: p.clientSecret(),
      redirect_uri: callbackUrl(provider),
    }).toString(),
  });
  if (!res.ok) throw new Error(`${provider} token exchange failed: ${res.status}`);
  return res.json();
}

// Step 3 — fetch + normalize the profile.
export async function fetchProfile(provider, tokens) {
  const p = PROVIDERS[provider];
  const res = await fetch(p.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${provider} profile fetch failed: ${res.status}`);
  return p.parseProfile(await res.json());
}

// OAuth users don't choose a username — derive a clean, unique one from their
// display name (or email local-part), suffixing digits on collision.
async function uniqueUsername(seed) {
  let base = String(seed || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  if (base.length < 3) base = `${base || 'user'}`.padEnd(3, '0');
  if (!(await User.exists({ username: base }))) return base;
  for (let i = 0; i < 50; i++) {
    const candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 32);
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}${randomUUID().slice(0, 8)}`.slice(0, 32);
}

// Resolve a normalized OAuth profile to a User, creating or linking as needed.
// Linking precedence:
//   1. Identity already linked (provider + sub) → that user, no questions asked.
//   2. A *verified* provider email that matches an existing account → attach the
//      identity to it (seamless account merge; the verified email is the proof).
//   3. Otherwise a brand-new account. We never silently claim an email that
//      belongs to a password account we couldn't verify-link to (step 2 missed),
//      so a placeholder no-reply email is used in that (rare) case.
export async function findOrCreateUser(provider, profile) {
  if (!profile.sub) throw new Error('oauth profile missing subject id');

  let user = await User.findOne({ identities: { $elemMatch: { provider, sub: profile.sub } } });
  if (user) return user;

  if (profile.email && profile.emailVerified) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      user.identities.push({ provider, sub: profile.sub });
      if (!user.emailVerified) user.emailVerified = true;
      await user.save();
      return user;
    }
  }

  // New account. Guard against grabbing an email that already exists (a password
  // account whose email the provider reported unverified, or a race).
  let email = profile.email || null;
  if (email && (await User.exists({ email }))) email = null;
  if (!email) email = `${provider}_${profile.sub}@oauth.pingable.local`;

  const username = await uniqueUsername(profile.name || (profile.email || '').split('@')[0]);
  user = new User({
    username,
    email,
    emailVerified: !!profile.emailVerified,
    identities: [{ provider, sub: profile.sub }],
  });
  await user.save();
  return user;
}

// Attach an external identity to an already-logged-in account (settings →
// "เชื่อมต่อ"). Refuses if the identity is already claimed by someone else.
export async function linkIdentity(userId, provider, profile) {
  if (!profile.sub) throw new Error('oauth profile missing subject id');

  const owner = await User.findOne({ identities: { $elemMatch: { provider, sub: profile.sub } } });
  if (owner && String(owner._id) !== String(userId)) {
    const err = new Error('identity already linked to another account');
    err.code = 'IDENTITY_TAKEN';
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('user not found');
  if (!user.identities.some((i) => i.provider === provider && i.sub === profile.sub)) {
    user.identities.push({ provider, sub: profile.sub });
    // Linking a verified provider email that matches confirms the local email too.
    if (profile.email && profile.emailVerified && profile.email === user.email && !user.emailVerified) {
      user.emailVerified = true;
    }
    await user.save();
  }
  return user;
}

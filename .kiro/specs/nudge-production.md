# NUDGE Production Dashboard Specification

**Spec ID:** `SPEC-NUDGE-PRODUCTION-V1`  
**Status:** Active

## Functional requirements

### [PROD-001] Definitive dashboard shell
The authenticated dashboard must follow the approved reference: persistent left navigation, browser-local time greeting with profile name, top-right Save/notification/avatar controls, bottom-left Profile and browser-extension status, four attention statistics, ranked attention rows, and compact recently-saved cards. Layout must remain usable on tablet and mobile.

### [PROD-002] Truthful controls
Save, notifications, profile, category management, and extension state must navigate or perform a real action. Production UI must not claim “Local capture” or “Extension active” without evidence.

### [PROD-003] Demo entry
The landing page must expose a prominent Demo action. A Demo request creates an isolated temporary profile, copies the reviewed demo dataset with fresh IDs, issues a signed HttpOnly session cookie, and redirects to the canonical `/overview` dashboard using the configured public application origin. The legacy `/needs-attention` path redirects to `/overview`. Demo mutations must not affect another demo or registered user.

### [PROD-004] Registered account entry
The landing page must expose Get Started. Registration requires display name, valid email, and password. Passwords are never stored in plaintext. Existing users can log in. The session is a signed JWT with a 15-minute expiration.

### [PROD-005] Existing intelligence behavior
The production shell must preserve five-day approaching-deadline rules, action/review visibility, internal intelligence details, useful links, AI-default categories, user category renaming, and item movement without altering the original AI classification.

## Security invariants

### [SEC-PROD-001] Profile isolation — CRITICAL
Every dashboard read and mutation must resolve the profile from a valid session. Item IDs, category keys, cleanup actions, and demo cloning must remain scoped to that profile.

### [SEC-PROD-002] Demo isolation — CRITICAL
Demo rows receive a new profile ID and remapped relationship IDs. A second Demo request cannot read or mutate the first profile’s rows.

### [SEC-PROD-003] Credential handling — CRITICAL
Passwords use bcrypt with a work factor of at least 12. JWTs use an environment-provided secret of at least 32 characters in production, are stored in HttpOnly SameSite=Lax cookies, and expire after 15 minutes. Authentication responses never include password hashes.

### [SEC-PROD-004] Login throttling — HIGH
After five failed login attempts for one IP/email window within one minute, login returns HTTP 429 until the window expires.

### [SEC-PROD-005] Public mutation boundaries — HIGH
Same-origin dashboard mutations require a valid session. Registered and temporary demo profiles can generate or rotate a profile-scoped extension credential from Profile; plaintext is returned only in that authenticated generation response and kept in extension-local storage, while the server persists only its digest. Rotation invalidates the prior credential, expired demo credentials are rejected, and the extension may send credentials only to the fixed hosted NUDGE origin.

## UX and motion

- Use the existing NUDGE palette and inline SVG icon system; no external image/icon dependency is required for the shell.
- Motion is subtle: page/card entrance, hover elevation, notification pulse, and menu/modal transitions.
- Honor `prefers-reduced-motion`.
- Greeting uses browser-local time: morning before 12:00, afternoon before 18:00, evening otherwise. Server fallback copy must not cause hydration mismatch.
- Demo and account labels remain explicit; the product must not imply external OAuth or email verification where none exists.

## Deployment constraints

- Production requires `SESSION_SECRET`, durable `DB_PATH`, and an HTTPS application URL.
- Localhost wording is development-only.
- Render deployment remains paused until storage, environment variables, and profile-isolation smoke checks pass.

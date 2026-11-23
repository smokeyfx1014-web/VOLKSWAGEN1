# Multi-Dealership Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Any unmatched collection or document is denied read/write access.
2. **Dealership Branch Integrity**: Only branch document IDs `'1'` (Newcastle VW), `'2'` (Ermelo VW), and `'3'` (Vryheid VW) may exist in `/dealerships/{branchId}`, writable solely by verified Admins. Optional `autotraderUrl` must be empty or match `^https://(www\.)?autotrader\.co\.za/dealer/.*$`.
3. **Master Group Stock Integrity**: Public readers may only read/list `/vehicles` where `status == 'available'` (preserving reserved/sold isolation from public scraping). Admins may create, update, or delete any vehicle with bounded `images` list (`1 <= size <= 10`), valid `homeDealershipId in ['1', '2', '3']`, and optional bounded AutoTrader sync metadata (`source in ['autotrader', 'manual']`, `externalListingId`, `dealerId`, `variant`, `priceFormatted`, `canonicalUrl`, `lastSyncedAt`).
4. **Scoped Promotions Consistency**: `/promotions` enforces `scope == 'MASTER' => dealershipId == null` and `scope == 'BRANCH' => dealershipId in ['1', '2', '3']`. Public list queries require `active == true` (admin queries full collection).
5. **PII Isolation & Branch Attribution on Leads**: `/leads/{leadId}` allows public creation ONLY with `status == 'new'`, `createdAt == request.time`, `details.size() <= 6000` (accommodating structured 4-step FSP/NCA finance applications without raw binary attachments), valid `submittedAtDealershipId in ['1', '2', '3']`, and valid `homeDealershipId` (`null` or `'1'|'2'|'3'`). Public visitors can never `get`, `list`, `update`, or `delete` `/leads`.
6. **Verified Admin Gate**: Admin privileges require `request.auth != null && ((request.auth.token.email_verified == true && request.auth.token.email == 'smokeydhlamini@gmail.com') || exists(/databases/$(database)/documents/admins/$(request.auth.uid)))`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Dealership Hijack**: Non-admin attempts `setDoc(/dealerships/1, { receptionNumber: '0000' })` -> `PERMISSION_DENIED`.
2. **Invalid Branch ID Injection**: Admin attempts `setDoc(/dealerships/99, ...)` -> `PERMISSION_DENIED` (`branchId in ['1', '2', '3']`).
3. **Public Scraping of Sold/Reserved Stock**: Anonymous client queries `/vehicles` without `where('status', '==', 'available')` -> `PERMISSION_DENIED`.
4. **Unbounded Images Array (Denial of Wallet)**: Admin submits `/vehicles` with `images: []` or 15 URLs or non-string `images[0]` -> `PERMISSION_DENIED`.
5. **Broken Scope-Branch Coupling on Promotion**: Admin sets `scope: 'MASTER'` with `dealershipId: '2'`, OR `scope: 'BRANCH'` with `dealershipId: null` -> `PERMISSION_DENIED`.
6. **Public Scraping of Inactive Promotions**: Anonymous client queries `/promotions` without `where('active', '==', true)` -> `PERMISSION_DENIED`.
7. **PII Blanket Read on Leads**: Signed-in non-admin user attempts `getDocs(/leads)` -> `PERMISSION_DENIED`.
8. **Lead Status Shortcutting**: Public user creates lead with `status: 'contacted'` -> `PERMISSION_DENIED`.
9. **Spoofed Lead Origin Branch**: Public user creates lead with `submittedAtDealershipId: '9'` -> `PERMISSION_DENIED`.
10. **Shadow Field Injection on Lead**: Public user creates lead with extra key `isAdmin: true` -> `PERMISSION_DENIED` (`keys().hasOnly(...)`).
11. **Backdated Timestamp Poisoning**: User creates lead or vehicle with client-provided `Date()` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Privilege Escalation via Admins Doc**: Non-admin user tries writing `/admins/{ownUid}` with `role: 'admin'` -> `PERMISSION_DENIED`.

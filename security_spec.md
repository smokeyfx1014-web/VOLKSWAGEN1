# Multi-Dealership Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Any unmatched collection or document is denied read/write access.
2. **Dealership Branch Integrity**: Only branch document IDs `'1'` (Newcastle VW), `'2'` (Ermelo VW), and `'3'` (Vryheid VW) may exist in `/dealerships/{branchId}`, writable solely by verified Admins. Optional `autotraderUrl` must be empty or match `^https://(www\.)?autotrader\.co\.za/dealer/.*$`.
3. **Master Group Stock Integrity**: Public readers may only read/list `/vehicles` where `status == 'available'`. Admins may create, update, or delete any vehicle across all branches. Active Car Sales Agents may create, update, or delete ONLY manual vehicles (`source == 'manual'`) belonging strictly to their `allocatedDealershipId`, and cannot reassign `homeDealershipId` across branches or modify AutoTrader-synced listings.
4. **Scoped Promotions Consistency**: `/promotions` enforces `scope == 'MASTER' => dealershipId == null` and `scope == 'BRANCH' => dealershipId in ['1', '2', '3']`. Public list queries require `active == true`. Admins may manage all promotions; active Car Sales Agents may create, update, or delete ONLY `type in ['special', 'event']` promotions scoped strictly to `scope == 'BRANCH'` and their `allocatedDealershipId`.
5. **PII Isolation & Branch Attribution on Leads**: `/leads/{leadId}` allows public creation ONLY with `status == 'new'`, `createdAt == request.time`, `details.size() <= 6000`, valid `submittedAtDealershipId in ['1', '2', '3']`, and valid `homeDealershipId` (`null` or `'1'|'2'|'3'`). Only Admins may `get`, `list`, `update` (`status` only), or `delete` `/leads`.
6. **Verified Admin & Staff User RBAC Gate**:
   - **Administrators (`isAdmin()`)**: Verified bootstrapped admin (`smokeydhlamini@gmail.com` with `email_verified == true`), active `/admins/{uid}`, or `/staffUsers/{uid}` with `role == 'admin' && active == true`.
   - **Car Sales Agents (`isAgentForBranch(branchId)`)**: Signed-in user with `/staffUsers/{uid}` where `role == 'agent' && active == true && allocatedDealershipId == branchId`.
   - **Staff Roster PII Protection (`/staffUsers/{uid}`)**: Only Admins can list, create, update role/branch/active/profile, or delete staff users. Individual staff users may ONLY `get` their own document and execute a single restricted self-update flipping `mustChangePassword` from `true` to `false` (along with `updatedAt` and `updatedBy`) during first-login password configuration.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Dealership Hijack**: Non-admin or Sales Agent attempts `setDoc(/dealerships/1, { receptionNumber: '0000' })` -> `PERMISSION_DENIED`.
2. **Invalid Branch ID Injection**: Admin attempts `setDoc(/dealerships/99, ...)` -> `PERMISSION_DENIED`.
3. **Public Scraping of Sold/Reserved Stock**: Anonymous client queries `/vehicles` without `where('status', '==', 'available')` -> `PERMISSION_DENIED`.
4. **Cross-Branch Vehicle Injection by Sales Agent**: Newcastle Agent (`allocatedDealershipId: '1'`) creates `/vehicles/test` with `homeDealershipId: '2'` -> `PERMISSION_DENIED`.
5. **AutoTrader Fleet Tampering by Sales Agent**: Newcastle Agent attempts to modify or delete a `/vehicles/at_*` document (`source == 'autotrader'`) -> `PERMISSION_DENIED`.
6. **Master / Cross-Branch Special Hijack by Sales Agent**: Ermelo Agent (`allocatedDealershipId: '2'`) creates promotion with `scope: 'MASTER'` or `dealershipId: '1'` or `type: 'competition'` -> `PERMISSION_DENIED`.
7. **PII Blanket Read on Leads / Staff Roster**: Sales Agent attempts `getDocs(/leads)` or `getDocs(/staffUsers)` -> `PERMISSION_DENIED`.
8. **Self-Role Escalation on `/staffUsers/{ownUid}`**: Sales Agent updates `/staffUsers/{ownUid}` adding `role: 'admin'` or changing `allocatedDealershipId: '2'` -> `PERMISSION_DENIED`.
9. **Agent Adding Another User**: Sales Agent attempts `setDoc(/staffUsers/newUid, ...)` -> `PERMISSION_DENIED`.
10. **Shadow Field Injection**: User submits extra key `isAdmin: true` on `/staffUsers`, `/vehicles`, `/promotions`, or `/leads` -> `PERMISSION_DENIED` (`keys().hasOnly(...)`).
11. **Backdated Timestamp Poisoning**: User creates record with client-provided `Date()` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Privilege Escalation via Admins Doc**: Non-admin user tries writing `/admins/{ownUid}` with `role: 'admin'` -> `PERMISSION_DENIED`.

# Multi-Dealership Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Any unmatched collection or document is denied read/write access.
2. **Dealership Group & Dynamic Branch Integrity**:
   - `/groupSettings/main` holds corporate group identity (`groupName`, `legalEntity`, `fspNumber`, compliance details, logos, `defaultBranchId`), publicly readable via `get` and writable solely by verified Admins.
   - `/dealerships/{branchId}` supports dynamic branch IDs matching `^[a-zA-Z0-9_-]{1,64}$` (enabling 1, 2, 3, 4, or more branches). Writable and deletable solely by verified Admins. Optional `autotraderUrl` must be empty or match `^https://(www\.)?autotrader\.co\.za/dealer/.*$`.
3. **Master Group Stock Integrity**: Public readers may only read/list `/vehicles` where `status == 'available'`. Admins may create, update, or delete any vehicle across all branches. Active Car Sales Agents (`role == 'agent'`) may create, update, or delete ONLY manual vehicles (`source == 'manual'`) belonging strictly to their `allocatedDealershipId`. Marketing, Parts Sales Executives, and Service Booking Clerks cannot modify vehicle inventory.
4. **Scoped Promotions & Motoring News Consistency**:
   - `/promotions` enforces `scope == 'MASTER' => dealershipId == null` and `scope == 'BRANCH' => isValidBranchId(dealershipId)`. Public queries require `active == true`.
   - **Admins** & **Marketing (`role == 'marketing'`)**: Full group-wide management of `special`, `event`, and `competition` campaigns (`MASTER` or `BRANCH`) and `/news` articles.
   - **Car Sales Agents (`role == 'agent'`)**: Manage `type in ['special', 'event']` scoped strictly to `scope == 'BRANCH'` and `dealershipId == allocatedDealershipId`.
   - **Parts Sales Executives (`role == 'parts'`) & Service Booking Clerks (`role == 'service'`)**: Manage `type == 'special'` scoped strictly to `scope == 'BRANCH'` and `dealershipId == allocatedDealershipId`.
5. **PII Isolation & Department-Scoped Lead Access (`/leads/{leadId}`)**:
   - Public creation allowed ONLY with `status == 'new'`, `createdAt == request.time`, `details.size() <= 6000`, and valid branch attribution.
   - **Admins**: Full read, status update, and delete on all leads.
   - **Parts Sales Executives (`role == 'parts'`)**: Read (`get`/`list`) and update (`status` only) ONLY leads with `leadType == 'parts'` attributed to their `allocatedDealershipId` (`submittedAtDealershipId` or `homeDealershipId`). Cannot read finance, test-drive, service, or contact leads, and cannot delete leads.
   - **Service Booking Clerks (`role == 'service'`)**: Read (`get`/`list`) and update (`status` only) ONLY leads with `leadType == 'service'` attributed to their `allocatedDealershipId` (`submittedAtDealershipId` or `homeDealershipId`). Cannot read parts, finance, or vehicle leads, and cannot delete leads.
   - **Car Sales Agents & Marketing**: Zero access to `/leads`.
6. **Verified Admin & 5-Role Staff Roster Gate (`/staffUsers/{uid}`)**:
   - Roles: `admin`, `agent`, `marketing`, `parts`, `service`.
   - Group-wide roles (`admin`, `marketing`) may have `allocatedDealershipId == null` or a valid branch ID; branch-scoped roles (`agent`, `parts`, `service`) strictly require a valid `allocatedDealershipId`.
   - Only Admins can list, create, modify role/branch/active, or delete staff users. Individual staff may ONLY `get` their own profile and execute the single self-update clearing `mustChangePassword` from `true` to `false`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated Group/Branch Hijack**: Non-admin (including Marketing/Parts/Service/Agent) writes `/groupSettings/main` or `/dealerships/branch-4` -> `PERMISSION_DENIED`.
2. **Invalid Branch ID Injection**: Admin attempts `setDoc(/dealerships/bad id!, ...)` -> `PERMISSION_DENIED`.
3. **Public Scraping of Sold/Reserved Stock**: Anonymous client queries `/vehicles` without `where('status', '==', 'available')` -> `PERMISSION_DENIED`.
4. **Cross-Branch Vehicle Injection by Sales Agent**: Agent (`allocatedDealershipId: '1'`) creates `/vehicles/test` with `homeDealershipId: '2'` -> `PERMISSION_DENIED`.
5. **Marketing Attempting Vehicle or Lead Access**: Marketing user attempts write on `/vehicles/*` or `getDocs(/leads)` -> `PERMISSION_DENIED`.
6. **Parts Executive Reading Service or Finance Leads**: Parts Executive (`role: 'parts'`, `allocatedDealershipId: '1'`) queries `/leads` with `leadType == 'service'` or `leadType == 'finance'` -> `PERMISSION_DENIED`.
7. **Service Clerk Cross-Branch or Delete Attempt**: Service Clerk (`allocatedDealershipId: '1'`) queries `service` leads for branch `'2'`, edits customer `phone`, or deletes a lead -> `PERMISSION_DENIED`.
8. **Parts/Service Creating Competitions or Master Promotions**: Parts Executive or Service Clerk creates promotion with `scope: 'MASTER'` or `type: 'competition'` -> `PERMISSION_DENIED`.
9. **Self-Role Escalation on `/staffUsers/{ownUid}`**: Any non-admin staff member updates `/staffUsers/{ownUid}` setting `role: 'admin'` or changing `allocatedDealershipId` -> `PERMISSION_DENIED`.
10. **Shadow Field Injection**: Extra key `isAdmin: true` on `/groupSettings`, `/dealerships`, `/staffUsers`, `/vehicles`, `/promotions`, `/news`, or `/leads` -> `PERMISSION_DENIED`.
11. **Backdated Timestamp Poisoning**: Client supplies custom Date instead of `request.time` -> `PERMISSION_DENIED`.
12. **Privilege Escalation via Admins Doc**: Non-admin user writes `/admins/{ownUid}` with `role: 'admin'` -> `PERMISSION_DENIED`.

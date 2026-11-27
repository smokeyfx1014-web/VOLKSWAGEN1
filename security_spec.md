# Multi-Dealership Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Any unmatched collection or document is denied read/write access.
2. **Dealership Group & Dynamic Branch Integrity**:
   - `/groupSettings/main` holds corporate group identity (`groupName`, `legalEntity`, `fspNumber`, compliance details, logos, `defaultBranchId`), publicly readable via `get` and writable solely by Group Admins (`role == 'admin'`).
   - `/dealerships/{branchId}` supports dynamic branch IDs matching `^[a-zA-Z0-9_-]{1,64}$`. Creatable by Group Admins or Group IT Manager; updatable by Group Admins, Group IT Manager, or the branch's assigned Branch Admin; deletable solely by Group Admins.
3. **Master Group Stock Integrity**: Public readers may only read/list `/vehicles` where `status == 'available'`. Group Admins, IT Manager, and Branch Admins (for their branch) may create, update, or delete vehicles. Car Sales Executives (`role == 'agent'`) may create, update, or delete ONLY manual vehicles (`source == 'manual'`) belonging strictly to their `allocatedDealershipId`.
4. **Scoped Promotions & Motoring News Consistency**:
   - `/promotions` enforces `scope == 'MASTER' => dealershipId == null` and `scope == 'BRANCH' => isValidBranchId(dealershipId)`. Public queries require `active == true`.
   - **Group Admins**, **IT Manager**, & **Marketing (`role == 'marketing'`)**: Full group-wide management of `special`, `event`, and `competition` campaigns and `/news` articles.
   - **Branch Admin (`role == 'branch_admin'`)**: Full management of `special`, `event`, and `competition` campaigns scoped strictly to their `allocatedDealershipId`.
   - **Car Sales Executives (`role == 'agent'`)**: Manage `type in ['special', 'event']` scoped strictly to their branch.
   - **Parts Agents (`role == 'parts'`) & Service Booking Agents (`role == 'service'`)**: Manage `type == 'special'` scoped strictly to their branch.
5. **PII Isolation & Role-Scoped Lead Access (`/leads/{leadId}`)**:
   - Public creation allowed ONLY with `status == 'new'`, `createdAt == request.time`, valid `leadType`, `details.size() <= 6000`, and valid branch attribution.
   - **Group Admins** & **IT Manager**: Full read & status updates on all leads across all branches; Group Admins only can delete leads.
   - **Branch Admin / Dealer Principal (`role == 'branch_admin'`)**: Full read & status updates on ALL lead types belonging to their `allocatedDealershipId`.
   - **Parts Agents (`role == 'parts'`)**: Read (`get`/`list`) and update (`status` only) ONLY `leadType == 'parts'` attributed to their branch.
   - **Service Booking Agents (`role == 'service'`)**: Read (`get`/`list`) and update (`status` only) ONLY `leadType == 'service'` attributed to their branch.
   - **Car Sales Executives (`role == 'agent'`)**: Read (`get`/`list`) and update (`status` only) ONLY Spotter leads (`leadType in ['spotter', 'competition-entry']`) attributed to their branch.
   - **Marketing & Non-Escalated IT Agents**: Zero direct access to `/leads`.
6. **Verified 8-Role Staff Roster & Server-Time Escalation Gate (`/staffUsers/{uid}`, `/itTickets/{ticketId}`)**:
   - Roles: `admin`, `branch_admin`, `it_manager`, `it_agent`, `agent`, `parts`, `marketing`, `service`.
   - Only Group Admins and the Group IT Manager may create/update staff accounts, and the IT Manager cannot create, modify, promote, or deactivate `admin` or `it_manager` accounts.
   - Branch IT Agents (`role == 'it_agent'`) may submit `/itTickets` escalation requests (`status == 'open'`) for their assigned branch only, and cannot self-approve or write `activeEscalation`.
   - When an IT Manager or Group Admin grants a temporary escalation on `/staffUsers/{uid}.activeEscalation`, every Firestore rule checks `activeEscalation.expiresAt > request.time` against server time so expired escalations lose all elevated permissions automatically.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated Group/Branch Hijack**: Non-admin (including Marketing/Parts/Service/Agent/IT Agent) writes `/groupSettings/main` or creates `/dealerships/branch-4` -> `PERMISSION_DENIED`.
2. **IT Agent Self-Escalation**: IT Agent updates `/staffUsers/{ownUid}` to inject `activeEscalation` or change `role` -> `PERMISSION_DENIED`.
3. **IT Agent Self-Approving Ticket**: IT Agent updates `/itTickets/{ticketId}` to set `status: 'approved_temporary'` -> `PERMISSION_DENIED`.
4. **Expired Temporary Escalation**: IT Agent uses expired `activeEscalation` (`expiresAt <= request.time`) to read `/leads` or edit `/vehicles` -> `PERMISSION_DENIED`.
5. **IT Manager Privilege Escalation**: IT Manager attempts to create/promote an `'admin'` or `'it_manager'` user or write `/admins/{uid}` -> `PERMISSION_DENIED`.
6. **Branch Admin Cross-Branch Access**: Branch Admin (`allocatedDealershipId: '1'`) queries `/leads` or `/jobApplications` for branch `'2'` -> `PERMISSION_DENIED`.
7. **Parts/Service Cross-Department Lead Access**: Parts Agent reads `service` or `spotter` leads, or Service Agent reads `parts` leads -> `PERMISSION_DENIED`.
8. **Sales Executive Non-Spotter Lead Access**: Sales Executive (`role == 'agent'`) queries `finance` or `service` leads -> `PERMISSION_DENIED`.
9. **Public Scraping of Sold/Reserved Stock**: Anonymous client queries `/vehicles` without `where('status', '==', 'available')` -> `PERMISSION_DENIED`.
10. **Shadow Field Injection**: Extra fields on `/itTickets`, `/staffUsers`, `/leads`, `/vehicles`, `/promotions`, `/dealerships` -> `PERMISSION_DENIED`.
11. **Backdated Timestamp Poisoning**: Client supplies backdated timestamp instead of `request.time` -> `PERMISSION_DENIED`.
12. **Privilege Escalation via Admins Doc**: Non-Group-Admin writes `/admins/{ownUid}` -> `PERMISSION_DENIED`.

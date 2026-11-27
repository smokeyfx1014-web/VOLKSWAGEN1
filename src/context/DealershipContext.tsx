import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BRANCH_SOCIAL_LINKS,
  DEFAULT_DEALERSHIPS,
  DEFAULT_GROUP_PROFILE,
} from '../data/dealership';
import { validateAutoTraderDealerUrl } from '../lib/autotraderParser';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  handleFirestoreError,
} from '../lib/firebase';
import {
  DealershipGroupProfile,
  DealershipId,
  DealershipRecord,
} from '../types/dealership';

const SESSION_BRANCH_KEY = 'vw_active_branch_override';
export const VALID_BRANCH_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidBranchIdFormat(val: string | null | undefined): val is DealershipId {
  return Boolean(val && VALID_BRANCH_ID_RE.test(val.trim()));
}

function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');
}

const DEFAULT_BRANCH_LIST: DealershipRecord[] = [
  DEFAULT_DEALERSHIPS['1'],
  DEFAULT_DEALERSHIPS['2'],
  DEFAULT_DEALERSHIPS['3'],
];

export function resolveDealershipId(
  activeBranches: DealershipRecord[] = DEFAULT_BRANCH_LIST,
  allBranches: DealershipRecord[] = activeBranches,
  defaultBranchId: DealershipId = DEFAULT_GROUP_PROFILE.defaultBranchId
): { id: DealershipId; viaOverride: boolean } {
  const safeDefault =
    activeBranches.find((b) => b.id === defaultBranchId)?.id ??
    activeBranches[0]?.id ??
    allBranches[0]?.id ??
    '1';

  if (typeof window === 'undefined') {
    return { id: safeDefault, viaOverride: false };
  }

  // a) Check URL query parameter ?branch=<id> and persist in sessionStorage
  const params = new URLSearchParams(window.location.search);
  const queryBranch = params.get('branch')?.trim();
  if (queryBranch && allBranches.some((b) => b.id === queryBranch)) {
    try {
      window.sessionStorage.setItem(SESSION_BRANCH_KEY, queryBranch);
    } catch {
      // Ignore sessionStorage restrictions in private browsing
    }
    return { id: queryBranch, viaOverride: true };
  }

  // Check persisted sessionStorage override for cross-route localhost/staging testing
  try {
    const storedBranch = window.sessionStorage.getItem(SESSION_BRANCH_KEY)?.trim();
    if (storedBranch && allBranches.some((b) => b.id === storedBranch)) {
      return { id: storedBranch, viaOverride: true };
    }
  } catch {
    // Ignore storage failures
  }

  // b) Dynamic hostname resolution against all active dealership branches
  const hostname = normalizeHost(window.location.hostname);
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    const exactMatch = activeBranches.find((b) => {
      const branchHost = normalizeHost(b.domain || '');
      return Boolean(branchHost) && (hostname === branchHost || hostname.endsWith(`.${branchHost}`));
    });
    if (exactMatch) {
      return { id: exactMatch.id, viaOverride: false };
    }

    const stemMatch = activeBranches.find((b) => {
      const branchHost = normalizeHost(b.domain || '');
      const stem = branchHost.split('.')[0] ?? '';
      return stem.length >= 4 && hostname.includes(stem);
    });
    if (stemMatch) {
      return { id: stemMatch.id, viaOverride: false };
    }
  }

  return { id: safeDefault, viaOverride: false };
}

interface DealershipContextValue {
  groupProfile: DealershipGroupProfile;
  activeDealershipId: DealershipId;
  activeDealership: DealershipRecord;
  dealershipsById: Record<DealershipId, DealershipRecord>;
  activeDealerships: DealershipRecord[];
  allDealerships: DealershipRecord[];
  hasDbGroupSettings: boolean;
  hasDbDealerships: boolean;
  isBranchOverrideActive: boolean;
  switchPreviewBranch: (branchId: DealershipId | null) => void;
  saveGroupProfile: (
    profile: Omit<DealershipGroupProfile, 'id' | 'updatedAt' | 'updatedBy'>
  ) => Promise<void>;
  saveDealershipSettings: (record: DealershipRecord) => Promise<void>;
  setDealershipArchived: (branchId: DealershipId, archived: boolean) => Promise<void>;
  deleteDealershipBranch: (branchId: DealershipId) => Promise<void>;
  seedDefaultDealerships: () => Promise<void>;
}

const DealershipContext = createContext<DealershipContextValue | null>(null);

export function DealershipProvider({ children }: { children: React.ReactNode }) {
  const [dbGroupProfile, setDbGroupProfile] = useState<DealershipGroupProfile | null>(null);
  const [dbDealerships, setDbDealerships] = useState<DealershipRecord[] | null>(null);
  const [isBranchAdmin, setIsBranchAdmin] = useState<boolean | null>(null);
  const [resolutionTick, setResolutionTick] = useState(0);

  // Track whether the signed-in user is an active Admin before switching to unfiltered branch listing
  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        if (!cancelled) setIsBranchAdmin(false);
        return;
      }

      const isBootstrap =
        Boolean(nextUser.emailVerified) &&
        nextUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
      if (isBootstrap) {
        if (!cancelled) setIsBranchAdmin(true);
        return;
      }

      try {
        const [adminSnap, staffSnap] = await Promise.all([
          getDoc(doc(db, 'admins', nextUser.uid)).catch(() => null),
          getDoc(doc(db, 'staffUsers', nextUser.uid)).catch(() => null),
        ]);
        const staffData = staffSnap?.exists()
          ? (staffSnap.data() as { role?: string; active?: boolean })
          : null;
        const verifiedAdmin =
          Boolean(adminSnap?.exists()) ||
          Boolean(
            staffData?.active === true &&
              (staffData?.role === 'admin' || staffData?.role === 'it_manager')
          );
        if (!cancelled) setIsBranchAdmin(verifiedAdmin);
      } catch {
        if (!cancelled) setIsBranchAdmin(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Real-time Firestore listener for Corporate Group profile (/groupSettings/main)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'groupSettings', 'main'),
      (snap) => {
        setDbGroupProfile(snap.exists() ? (snap.data() as DealershipGroupProfile) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'groupSettings/main')
    );
    return () => unsub();
  }, []);

  // Real-time Firestore listener for dynamic dealership branches
  // Public & non-admin clients query active branches (where archived == false); admins list all branches.
  useEffect(() => {
    if (isBranchAdmin === null) return;

    let legacyBackfilled = false;
    const branchesQuery = isBranchAdmin
      ? collection(db, 'dealerships')
      : query(collection(db, 'dealerships'), where('archived', '==', false));

    const unsub = onSnapshot(
      branchesQuery,
      (snap) => {
        const rows: DealershipRecord[] = [];
        const legacyMissingArchived: DealershipRecord[] = [];

        snap.docs.forEach((d) => {
          const raw = d.data() as DealershipRecord & { archived?: unknown };
          const id = raw.id || d.id;
          if (isValidBranchIdFormat(id)) {
            rows.push({ ...raw, id });
            if (isBranchAdmin && typeof raw.archived !== 'boolean') {
              legacyMissingArchived.push({ ...raw, id });
            }
          }
        });
        setDbDealerships(rows);

        // One-time backfill if legacy seeded branch docs lack the `archived` flag
        if (isBranchAdmin && !legacyBackfilled && legacyMissingArchived.length > 0 && auth.currentUser?.uid) {
          legacyBackfilled = true;
          const uid = auth.currentUser.uid;
          const batch = writeBatch(db);
          legacyMissingArchived.forEach((branch) => {
            const fallback = DEFAULT_DEALERSHIPS[branch.id];
            const cleanRef = (branch.referenceCode ?? fallback?.referenceCode ?? branch.shortName ?? 'BR')
              .replace(/[^a-zA-Z0-9]/g, '')
              .toUpperCase()
              .slice(0, 10);
            batch.set(doc(db, 'dealerships', branch.id), {
              ...(fallback ?? {}),
              ...branch,
              referenceCode: cleanRef,
              archived: false,
              sortOrder: typeof branch.sortOrder === 'number' ? branch.sortOrder : Number(branch.id) || 10,
              updatedAt: serverTimestamp(),
              updatedBy: uid,
            });
          });
          void batch.commit().catch(() => {
            // Non-blocking best-effort backfill
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'dealerships')
    );

    return () => unsub();
  }, [isBranchAdmin]);

  // Listen for browser navigation / query param updates
  useEffect(() => {
    const syncResolution = () => {
      setResolutionTick((t) => t + 1);
    };
    window.addEventListener('popstate', syncResolution);
    return () => window.removeEventListener('popstate', syncResolution);
  }, []);

  const groupProfile: DealershipGroupProfile = useMemo(
    () => ({
      ...DEFAULT_GROUP_PROFILE,
      ...(dbGroupProfile ?? {}),
      id: 'main',
    }),
    [dbGroupProfile]
  );

  const allDealerships: DealershipRecord[] = useMemo(() => {
    const source = dbDealerships && dbDealerships.length > 0 ? dbDealerships : DEFAULT_BRANCH_LIST;
    return source
      .map((branch, idx) => {
        const fallback = DEFAULT_DEALERSHIPS[branch.id];
        const socialFallback = BRANCH_SOCIAL_LINKS[branch.id];
        return {
          ...(fallback ?? {}),
          ...branch,
          referenceCode:
            branch.referenceCode ??
            fallback?.referenceCode ??
            branch.shortName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5),
          facebookUrl: branch.facebookUrl ?? socialFallback?.facebookUrl ?? '',
          instagramUrl: branch.instagramUrl ?? socialFallback?.instagramUrl ?? '',
          youtubeUrl:
            branch.youtubeUrl ?? socialFallback?.youtubeUrl ?? groupProfile.youtubeUrl,
          archived: Boolean(branch.archived),
          sortOrder: typeof branch.sortOrder === 'number' ? branch.sortOrder : idx + 1,
          salesNotifyEmail:
            branch.salesNotifyEmail ??
            fallback?.salesNotifyEmail ??
            groupProfile.defaultNotifyEmail ??
            '',
          serviceNotifyEmail:
            branch.serviceNotifyEmail ??
            fallback?.serviceNotifyEmail ??
            groupProfile.defaultNotifyEmail ??
            '',
          partsNotifyEmail:
            branch.partsNotifyEmail ??
            fallback?.partsNotifyEmail ??
            groupProfile.defaultNotifyEmail ??
            '',
          financeNotifyEmail:
            branch.financeNotifyEmail ??
            fallback?.financeNotifyEmail ??
            groupProfile.defaultNotifyEmail ??
            '',
          generalNotifyEmail:
            branch.generalNotifyEmail ??
            fallback?.generalNotifyEmail ??
            groupProfile.defaultNotifyEmail ??
            '',
          smtpHost: branch.smtpHost ?? fallback?.smtpHost ?? 'smtp.gmail.com',
          smtpPort:
            typeof branch.smtpPort === 'number'
              ? branch.smtpPort
              : fallback?.smtpPort ?? 465,
          smtpUser:
            branch.smtpUser ??
            fallback?.smtpUser ??
            groupProfile.defaultNotifyEmail ??
            '',
          smtpFrom:
            branch.smtpFrom ??
            fallback?.smtpFrom ??
            `${branch.name} <${branch.smtpUser ?? fallback?.smtpUser ?? groupProfile.defaultNotifyEmail ?? ''}>`,
          defaultNotifyEmail:
            branch.defaultNotifyEmail ??
            fallback?.defaultNotifyEmail ??
            branch.email ??
            groupProfile.defaultNotifyEmail ??
            '',
          smtpPassEnvKey:
            branch.smtpPassEnvKey ??
            fallback?.smtpPassEnvKey ??
            `SMTP_PASS_BRANCH_${branch.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'MAIN'}`,
        };
      })
      .sort(
        (a, b) =>
          (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
          a.name.localeCompare(b.name)
      );
  }, [dbDealerships, groupProfile.youtubeUrl, groupProfile.defaultNotifyEmail]);

  const activeDealerships: DealershipRecord[] = useMemo(() => {
    const active = allDealerships.filter((b) => !b.archived);
    return active.length > 0 ? active : allDealerships.slice(0, 1);
  }, [allDealerships]);

  const dealershipsById: Record<DealershipId, DealershipRecord> = useMemo(() => {
    const map: Record<DealershipId, DealershipRecord> = {};
    for (const branch of allDealerships) {
      map[branch.id] = branch;
    }
    return map;
  }, [allDealerships]);

  const resolution = useMemo(
    () =>
      resolveDealershipId(
        activeDealerships,
        allDealerships,
        groupProfile.defaultBranchId
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDealerships, allDealerships, groupProfile.defaultBranchId, resolutionTick]
  );

  const activeDealershipId = resolution.id;
  const activeDealership =
    dealershipsById[activeDealershipId] ?? activeDealerships[0] ?? DEFAULT_DEALERSHIPS['1'];

  const switchPreviewBranch = useCallback((branchId: DealershipId | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (branchId === null) {
      try {
        window.sessionStorage.removeItem(SESSION_BRANCH_KEY);
      } catch {
        // Ignore
      }
      url.searchParams.delete('branch');
    } else {
      try {
        window.sessionStorage.setItem(SESSION_BRANCH_KEY, branchId);
      } catch {
        // Ignore
      }
      url.searchParams.set('branch', branchId);
    }

    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    setResolutionTick((t) => t + 1);
  }, []);

  const saveGroupProfile = useCallback(
    async (profile: Omit<DealershipGroupProfile, 'id' | 'updatedAt' | 'updatedBy'>) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Authenticated admin session required.');
      const safeDefaultBranch = isValidBranchIdFormat(profile.defaultBranchId)
        ? profile.defaultBranchId.trim()
        : activeDealerships[0]?.id ?? '1';

      const parsedPort = Number(profile.smtpPort ?? 465);
      const safePort =
        Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535
          ? Math.round(parsedPort)
          : 465;
      const rawPassKey = (profile.smtpPassEnvKey || '').trim().toUpperCase();
      const safePassKey = /^SMTP_PASS(?:_[A-Z0-9_]{1,40})?$/.test(rawPassKey)
        ? rawPassKey
        : 'SMTP_PASS';

      const payload: DealershipGroupProfile = {
        id: 'main',
        groupName: profile.groupName.trim().slice(0, 120),
        legalEntity: profile.legalEntity.trim().slice(0, 140),
        fspNumber: profile.fspNumber.trim().slice(0, 30),
        complianceOfficer: profile.complianceOfficer.trim().slice(0, 120),
        complianceEmail: profile.complianceEmail.trim().slice(0, 140),
        vwRoadsideTollFree: profile.vwRoadsideTollFree.trim().slice(0, 40),
        vwRoadsideCrossBorder: profile.vwRoadsideCrossBorder.trim().slice(0, 40),
        testDriveHoursSummary: profile.testDriveHoursSummary.trim().slice(0, 160),
        groupLogoSrc: profile.groupLogoSrc.trim().slice(0, 500),
        emblemLogoSrc: profile.emblemLogoSrc.trim().slice(0, 500),
        youtubeUrl: profile.youtubeUrl.trim().slice(0, 300),
        defaultBranchId: safeDefaultBranch,
        defaultNotifyEmail: (profile.defaultNotifyEmail || '').trim().slice(0, 140),
        primarySiteUrl: (profile.primarySiteUrl || '').trim().slice(0, 300),
        smtpHost: (profile.smtpHost || '').trim().slice(0, 140),
        smtpPort: safePort,
        smtpUser: (profile.smtpUser || '').trim().slice(0, 140),
        smtpFrom: (profile.smtpFrom || '').trim().slice(0, 180),
        smtpPassEnvKey: safePassKey.slice(0, 60),
        licenceScannerEnabled:
          typeof profile.licenceScannerEnabled === 'boolean'
            ? profile.licenceScannerEnabled
            : true,
        autotraderSyncDefault:
          typeof profile.autotraderSyncDefault === 'boolean'
            ? profile.autotraderSyncDefault
            : true,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      };

      try {
        await setDoc(doc(db, 'groupSettings', 'main'), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'groupSettings/main');
      }
    },
    [activeDealerships]
  );

  const saveDealershipSettings = useCallback(async (record: DealershipRecord) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Authenticated admin session required.');
    const cleanedId = record.id.trim();
    if (!isValidBranchIdFormat(cleanedId)) {
      throw new Error(
        'Branch ID must be 1–64 characters using only letters, numbers, hyphens (-), or underscores (_).'
      );
    }

    const validatedAutoTraderUrl = validateAutoTraderDealerUrl(record.autotraderUrl || '').slice(
      0,
      300
    );
    const cleanedRefCode = (record.referenceCode || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10);

    const parsedPort = Number(record.smtpPort ?? 465);
    const safePort =
      Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535
        ? Math.round(parsedPort)
        : 465;
    const rawPassKey = (record.smtpPassEnvKey || '').trim().toUpperCase();
    const safePassKey = /^SMTP_PASS(?:_[A-Z0-9_]{1,40})?$/.test(rawPassKey)
      ? rawPassKey
      : `SMTP_PASS_BRANCH_${cleanedId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'MAIN'}`;

    const payload: DealershipRecord = {
      id: cleanedId,
      name: record.name.trim().slice(0, 120),
      shortName: record.shortName.trim().slice(0, 60),
      referenceCode: cleanedRefCode,
      legalEntity: record.legalEntity.trim().slice(0, 140),
      fspNumber: record.fspNumber.trim().slice(0, 30),
      domain: record.domain.trim().slice(0, 120),
      receptionNumber: record.receptionNumber.trim().slice(0, 40),
      whatsappNumber: record.whatsappNumber.trim().slice(0, 40),
      email: record.email.trim().slice(0, 140),
      physicalAddress: record.physicalAddress.trim().slice(0, 200),
      postalAddress: record.postalAddress.trim().slice(0, 160),
      city: record.city.trim().slice(0, 80),
      province: record.province.trim().slice(0, 80),
      salesHours: record.salesHours.trim().slice(0, 160),
      serviceHours: record.serviceHours.trim().slice(0, 160),
      roadsideAssist: record.roadsideAssist.trim().slice(0, 40),
      vwFinancialServices: record.vwFinancialServices.trim().slice(0, 40),
      volkswagensure: record.volkswagensure.trim().slice(0, 40),
      mapEmbedUrl: record.mapEmbedUrl.trim().slice(0, 600),
      facebookUrl: (record.facebookUrl || '').trim().slice(0, 300),
      instagramUrl: (record.instagramUrl || '').trim().slice(0, 300),
      youtubeUrl: (record.youtubeUrl || '').trim().slice(0, 300),
      autotraderDealerId: (record.autotraderDealerId || '').trim().slice(0, 30),
      autotraderUrl: validatedAutoTraderUrl,
      syncEnabled: Boolean(record.syncEnabled && validatedAutoTraderUrl),
      archived: Boolean(record.archived),
      sortOrder: Math.max(0, Math.min(10000, Number(record.sortOrder ?? 10) || 10)),
      salesNotifyEmail: (record.salesNotifyEmail || '').trim().slice(0, 140),
      serviceNotifyEmail: (record.serviceNotifyEmail || '').trim().slice(0, 140),
      partsNotifyEmail: (record.partsNotifyEmail || '').trim().slice(0, 140),
      financeNotifyEmail: (record.financeNotifyEmail || '').trim().slice(0, 140),
      generalNotifyEmail: (record.generalNotifyEmail || '').trim().slice(0, 140),
      smtpHost: (record.smtpHost || '').trim().slice(0, 140),
      smtpPort: safePort,
      smtpUser: (record.smtpUser || '').trim().slice(0, 140),
      smtpFrom: (record.smtpFrom || '').trim().slice(0, 180),
      defaultNotifyEmail: (record.defaultNotifyEmail || '').trim().slice(0, 140),
      smtpPassEnvKey: safePassKey.slice(0, 60),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    try {
      await setDoc(doc(db, 'dealerships', cleanedId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `dealerships/${cleanedId}`);
    }
  }, []);

  const setDealershipArchived = useCallback(
    async (branchId: DealershipId, archived: boolean) => {
      const target = dealershipsById[branchId];
      if (!target) {
        throw new Error(`Dealership branch "${branchId}" not found.`);
      }
      if (archived && activeDealerships.length <= 1 && !target.archived) {
        throw new Error(
          'At least one active dealership branch must remain published for public visitors.'
        );
      }
      await saveDealershipSettings({
        ...target,
        archived,
      });
    },
    [dealershipsById, activeDealerships.length, saveDealershipSettings]
  );

  const deleteDealershipBranch = useCallback(
    async (branchId: DealershipId) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Authenticated admin session required.');
      if (allDealerships.length <= 1) {
        throw new Error('Cannot delete the only remaining dealership branch.');
      }
      try {
        await deleteDoc(doc(db, 'dealerships', branchId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `dealerships/${branchId}`);
      }
    },
    [allDealerships.length]
  );

  const seedDefaultDealerships = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Authenticated admin session required.');
    const batch = writeBatch(db);
    batch.set(doc(db, 'groupSettings', 'main'), {
      ...DEFAULT_GROUP_PROFILE,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    (['1', '2', '3'] as const).forEach((id) => {
      batch.set(doc(db, 'dealerships', id), {
        ...DEFAULT_DEALERSHIPS[id],
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'dealerships/seed');
    }
  }, []);

  const value: DealershipContextValue = {
    groupProfile,
    activeDealershipId,
    activeDealership,
    dealershipsById,
    activeDealerships,
    allDealerships,
    hasDbGroupSettings: Boolean(dbGroupProfile),
    hasDbDealerships: Boolean(dbDealerships && dbDealerships.length > 0),
    isBranchOverrideActive: resolution.viaOverride,
    switchPreviewBranch,
    saveGroupProfile,
    saveDealershipSettings,
    setDealershipArchived,
    deleteDealershipBranch,
    seedDefaultDealerships,
  };

  return <DealershipContext.Provider value={value}>{children}</DealershipContext.Provider>;
}

export function useDealership(): DealershipContextValue {
  const ctx = useContext(DealershipContext);
  if (!ctx) {
    throw new Error('useDealership must be used within a DealershipProvider.');
  }
  return ctx;
}

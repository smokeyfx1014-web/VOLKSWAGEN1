import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_DEALERSHIPS } from '../data/dealership';
import { OperationType, auth, db, handleFirestoreError } from '../lib/firebase';
import { DealershipId, DealershipRecord } from '../types/dealership';

const SESSION_BRANCH_KEY = 'vw_active_branch_override';
const VALID_BRANCH_IDS: DealershipId[] = ['1', '2', '3'];

function isValidBranchId(val: string | null | undefined): val is DealershipId {
  return val === '1' || val === '2' || val === '3';
}

export function resolveDealershipId(): { id: DealershipId; viaOverride: boolean } {
  if (typeof window === 'undefined') {
    return { id: '1', viaOverride: false };
  }

  // a) Check URL query parameter ?branch=1|2|3 and persist in sessionStorage
  const params = new URLSearchParams(window.location.search);
  const queryBranch = params.get('branch')?.trim();
  if (isValidBranchId(queryBranch)) {
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
    if (isValidBranchId(storedBranch)) {
      return { id: storedBranch, viaOverride: true };
    }
  } catch {
    // Ignore storage failures
  }

  // b) Domain-based resolution (case-insensitive, supports www. and apex domains)
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('ermelovw')) {
    return { id: '2', viaOverride: false };
  }
  if (hostname.includes('vryheidvw')) {
    return { id: '3', viaOverride: false };
  }
  if (hostname.includes('newcastlevw')) {
    return { id: '1', viaOverride: false };
  }

  // Default fallback
  return { id: '1', viaOverride: false };
}

interface DealershipContextValue {
  activeDealershipId: DealershipId;
  activeDealership: DealershipRecord;
  dealershipsById: Record<DealershipId, DealershipRecord>;
  allDealerships: DealershipRecord[];
  isBranchOverrideActive: boolean;
  switchPreviewBranch: (branchId: DealershipId | null) => void;
  saveDealershipSettings: (record: DealershipRecord) => Promise<void>;
  seedDefaultDealerships: () => Promise<void>;
}

const DealershipContext = createContext<DealershipContextValue | null>(null);

export function DealershipProvider({ children }: { children: React.ReactNode }) {
  const [resolution, setResolution] = useState<{ id: DealershipId; viaOverride: boolean }>(() =>
    resolveDealershipId()
  );
  const [dbDealerships, setDbDealerships] = useState<Partial<Record<DealershipId, DealershipRecord>>>(
    {}
  );

  // Listen for browser navigation / query param updates
  useEffect(() => {
    const syncResolution = () => {
      setResolution(resolveDealershipId());
    };
    window.addEventListener('popstate', syncResolution);
    return () => window.removeEventListener('popstate', syncResolution);
  }, []);

  // Real-time Firestore listener for all 3 branch documents
  useEffect(() => {
    const branchesQuery = query(
      collection(db, 'dealerships'),
      where('id', 'in', VALID_BRANCH_IDS)
    );

    const unsub = onSnapshot(
      branchesQuery,
      (snap) => {
        const next: Partial<Record<DealershipId, DealershipRecord>> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as DealershipRecord;
          if (isValidBranchId(data.id)) {
            next[data.id] = data;
          }
        });
        setDbDealerships(next);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'dealerships')
    );

    return () => unsub();
  }, []);

  const dealershipsById: Record<DealershipId, DealershipRecord> = useMemo(
    () => ({
      '1': dbDealerships['1'] ?? DEFAULT_DEALERSHIPS['1'],
      '2': dbDealerships['2'] ?? DEFAULT_DEALERSHIPS['2'],
      '3': dbDealerships['3'] ?? DEFAULT_DEALERSHIPS['3'],
    }),
    [dbDealerships]
  );

  const allDealerships = useMemo(
    () => [dealershipsById['1'], dealershipsById['2'], dealershipsById['3']],
    [dealershipsById]
  );

  const activeDealershipId = resolution.id;
  const activeDealership = dealershipsById[activeDealershipId];

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
    setResolution(resolveDealershipId());
  }, []);

  const saveDealershipSettings = useCallback(async (record: DealershipRecord) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Authenticated admin session required.');
    const payload: DealershipRecord = {
      id: record.id,
      name: record.name.trim().slice(0, 120),
      shortName: record.shortName.trim().slice(0, 60),
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
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    try {
      await setDoc(doc(db, 'dealerships', record.id), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `dealerships/${record.id}`);
    }
  }, []);

  const seedDefaultDealerships = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Authenticated admin session required.');
    const batch = writeBatch(db);
    VALID_BRANCH_IDS.forEach((id) => {
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
    activeDealershipId,
    activeDealership,
    dealershipsById,
    allDealerships,
    isBranchOverrideActive: resolution.viaOverride,
    switchPreviewBranch,
    saveDealershipSettings,
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

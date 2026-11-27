import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  XCircle,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import {
  parseFirestoreTimestampMs,
  useDealershipData,
} from '../context/DealershipDataContext';
import { DealershipId, EscalatableStaffRole, ItEscalationTicket } from '../types/dealership';

const ESCALATION_ROLE_LABELS: Record<EscalatableStaffRole, string> = {
  branch_admin: 'Branch Admin / Dealer Principal',
  agent: 'Car Sales Executive (Stock, Specials & Spotters)',
  parts: 'Parts Agent (Parts Requests & Specials)',
  service: 'Service Booking Agent (Service Inbox & Specials)',
  marketing: 'Marketing Coordinator (Promotions & News)',
};

const DURATION_OPTIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 480, label: '8 hours' },
  { minutes: 1440, label: '24 hours' },
];

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

type TicketFilter = 'open' | 'active' | 'closed' | 'all';

export function ItEscalationCenter() {
  const { allDealerships, dealershipsById } = useDealership();
  const {
    isAdmin,
    isItManager,
    isItAgent,
    isBranchAdmin,
    staffProfile,
    allocatedBranchId,
    activeEscalation,
    escalationRemainingSeconds,
    itTickets,
    createItTicket,
    approveItTicketEscalation,
    resolveItTicketDirectly,
    rejectItTicket,
    revokeItTicketEscalation,
  } = useDealershipData();

  const canManageTickets = isAdmin || isItManager;

  const [filter, setFilter] = useState<TicketFilter>('open');
  const [showNewForm, setShowNewForm] = useState(false);

  // IT Agent new ticket form
  const [requestedRole, setRequestedRole] = useState<EscalatableStaffRole>('parts');
  const [targetBranchId, setTargetBranchId] = useState<DealershipId>(
    staffProfile?.allocatedDealershipId || allDealerships[0]?.id || '1'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newError, setNewError] = useState('');
  const [newSuccess, setNewSuccess] = useState('');

  // Manager / Admin action drawer state per ticket
  const [reviewingTicketId, setReviewingTicketId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<
    'approve' | 'resolve' | 'reject' | 'revoke' | null
  >(null);
  const [reviewDurationMinutes, setReviewDurationMinutes] = useState<number>(60);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const nowMs = Date.now();

  const sortedTickets = useMemo(() => {
    return [...itTickets].sort((a, b) => {
      const aTime = parseFirestoreTimestampMs(a.createdAt);
      const bTime = parseFirestoreTimestampMs(b.createdAt);
      return bTime - aTime;
    });
  }, [itTickets]);

  const isTicketCurrentlyActive = (t: ItEscalationTicket) =>
    t.status === 'approved_temporary' && parseFirestoreTimestampMs(t.expiresAt) > nowMs;

  const counts = useMemo(() => {
    let open = 0;
    let active = 0;
    let closed = 0;
    for (const t of sortedTickets) {
      if (t.status === 'open') open += 1;
      else if (isTicketCurrentlyActive(t)) active += 1;
      else closed += 1;
    }
    return { open, active, closed, all: sortedTickets.length };
  }, [sortedTickets, nowMs]);

  const filteredTickets = useMemo(() => {
    return sortedTickets.filter((t) => {
      if (filter === 'open') return t.status === 'open';
      if (filter === 'active') return isTicketCurrentlyActive(t);
      if (filter === 'closed') return t.status !== 'open' && !isTicketCurrentlyActive(t);
      return true;
    });
  }, [sortedTickets, filter, nowMs]);

  const handleSubmitNewTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewError('');
    setNewSuccess('');
    setSubmittingNew(true);
    try {
      await createItTicket({
        targetDealershipId: requestedRole === 'marketing' ? null : targetBranchId,
        requestedRole,
        requestedDurationMinutes: durationMinutes,
        title,
        reason,
      });
      setTitle('');
      setReason('');
      setShowNewForm(false);
      setNewSuccess(
        'Escalation ticket submitted. Your Group IT Manager can approve temporary timed access or resolve the request directly.'
      );
      setFilter('open');
    } catch (err) {
      setNewError(err instanceof Error ? err.message : 'Unable to submit IT escalation ticket.');
    } finally {
      setSubmittingNew(false);
    }
  };

  const openActionPanel = (
    ticket: ItEscalationTicket,
    mode: 'approve' | 'resolve' | 'reject' | 'revoke'
  ) => {
    setReviewingTicketId(ticket.id);
    setReviewMode(mode);
    setReviewDurationMinutes(ticket.requestedDurationMinutes || 60);
    setReviewNote('');
    setReviewError('');
  };

  const handleConfirmAction = async (ticket: ItEscalationTicket) => {
    if (!reviewMode) return;
    setReviewError('');
    setReviewSaving(true);
    try {
      if (reviewMode === 'approve') {
        await approveItTicketEscalation({
          ticketId: ticket.id,
          durationMinutes: reviewDurationMinutes,
          reviewNote:
            reviewNote.trim() ||
            `Approved ${reviewDurationMinutes}-minute temporary access to ${ESCALATION_ROLE_LABELS[ticket.requestedRole]}.`,
        });
      } else if (reviewMode === 'resolve') {
        await resolveItTicketDirectly({
          ticketId: ticket.id,
          reviewNote:
            reviewNote.trim() || 'Handled and completed directly by Group IT Manager.',
        });
      } else if (reviewMode === 'reject') {
        await rejectItTicket({
          ticketId: ticket.id,
          reviewNote,
        });
      } else if (reviewMode === 'revoke') {
        await revokeItTicketEscalation({
          ticketId: ticket.id,
          reviewNote:
            reviewNote.trim() || 'Temporary escalated access revoked by IT Manager.',
        });
      }
      setReviewingTicketId(null);
      setReviewMode(null);
      setReviewNote('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to update IT ticket.');
    } finally {
      setReviewSaving(false);
    }
  };

  const getBranchLabel = (branchId: DealershipId | null) => {
    if (!branchId) return 'Group-Wide';
    return dealershipsById[branchId]?.shortName || dealershipsById[branchId]?.name || `Branch ${branchId}`;
  };

  const renderStatusPill = (ticket: ItEscalationTicket) => {
    const expiredApproval =
      ticket.status === 'approved_temporary' &&
      parseFirestoreTimestampMs(ticket.expiresAt) <= nowMs;

    if (ticket.status === 'open') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5" />
          Pending Review
        </span>
      );
    }
    if (ticket.status === 'approved_temporary' && !expiredApproval) {
      const secs = Math.max(
        0,
        Math.floor((parseFirestoreTimestampMs(ticket.expiresAt) - nowMs) / 1000)
      );
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <KeyRound className="w-3.5 h-3.5" />
          Active ({formatCountdown(secs)} left)
        </span>
      );
    }
    if (expiredApproval) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          Escalation Expired
        </span>
      );
    }
    if (ticket.status === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved by IT Manager
        </span>
      );
    }
    if (ticket.status === 'revoked') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 border border-orange-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          Revoked Early
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-200">
        <XCircle className="w-3.5 h-3.5" />
        Rejected
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#001E50]/10 text-[#001E50]">
                <Ticket className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  IT Role Escalation & Support Tickets
                </h2>
                <p className="text-sm text-slate-600">
                  {canManageTickets
                    ? 'Review branch IT Agent elevation requests: grant time-limited role access, resolve tasks directly, reject requests, or revoke active access.'
                    : isItAgent
                    ? 'Submit timed role-escalation tickets to your Group IT Manager whenever branch troubleshooting requires temporary access.'
                    : `Read-only IT support & escalation ticket activity for ${getBranchLabel(allocatedBranchId)}.`}
                </p>
              </div>
            </div>
          </div>

          {isItAgent && (
            <button
              type="button"
              onClick={() => {
                setShowNewForm((prev) => !prev);
                setNewError('');
                setNewSuccess('');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001E50] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003380] transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              {showNewForm ? 'Close Ticket Form' : 'Request Role Escalation'}
            </button>
          )}
        </div>

        {/* Active temporary escalation banner for IT Agent */}
        {isItAgent && activeEscalation && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-950">
                  Temporary Role Escalation Active — {ESCALATION_ROLE_LABELS[activeEscalation.grantedRole]}
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Scope: <strong>{getBranchLabel(activeEscalation.dealershipId)}</strong> · Elevated tabs are unlocked in your portal navigation bar and automatically expire when the timer reaches zero.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 border border-emerald-200 text-xs font-bold text-emerald-900 shrink-0">
              <Clock className="w-4 h-4 text-emerald-600" />
              {formatCountdown(escalationRemainingSeconds)} remaining
            </div>
          </div>
        )}

        {newSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{newSuccess}</span>
          </div>
        )}
      </div>

      {/* New Escalation Request Form (IT Agent) */}
      {isItAgent && showNewForm && (
        <form
          onSubmit={handleSubmitNewTicket}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              New Role Escalation / IT Support Ticket
            </h3>
            <span className="text-xs font-medium text-slate-500">
              Requester Branch: {getBranchLabel(staffProfile?.allocatedDealershipId ?? null)}
            </span>
          </div>

          {newError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{newError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
                Requested Temporary Role *
              </label>
              <select
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as EscalatableStaffRole)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#001E50] focus:outline-none"
              >
                {(Object.keys(ESCALATION_ROLE_LABELS) as EscalatableStaffRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ESCALATION_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
                Target Branch
              </label>
              <select
                value={requestedRole === 'marketing' ? '' : targetBranchId}
                disabled={requestedRole === 'marketing'}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#001E50] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                {requestedRole === 'marketing' ? (
                  <option value="">Group-Wide Marketing Scope</option>
                ) : (
                  allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
                Requested Duration *
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#001E50] focus:outline-none"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
              Ticket Summary / Subject *
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inspect delayed parts enquiry emails and update branch special expiry"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#001E50] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
              Detailed Reason & Task Description *
            </label>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain what needs to be checked or updated so the IT Manager can either approve timed access or complete it directly."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#001E50] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingNew}
              className="rounded-xl bg-[#001E50] px-5 py-2 text-sm font-semibold text-white hover:bg-[#003380] disabled:opacity-50 cursor-pointer"
            >
              {submittingNew ? 'Submitting...' : 'Submit Ticket to IT Manager'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'open', label: 'Open Requests', count: counts.open },
            { id: 'active', label: 'Active Escalations', count: counts.active },
            { id: 'closed', label: 'Resolved / Closed', count: counts.closed },
            { id: 'all', label: 'All Tickets', count: counts.all },
          ] as Array<{ id: TicketFilter; label: string; count: number }>
        ).map((tab) => {
          const isCurrent = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-[#001E50] text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs ${
                  isCurrent ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            No {filter === 'all' ? '' : filter} IT escalation tickets found.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {isItAgent
              ? 'Click "Request Role Escalation" above whenever you need temporary elevated access or Group IT support.'
              : 'Submitted escalation requests from branch IT Agents will appear here in real time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const activeNow = isTicketCurrentlyActive(ticket);
            const isReviewingThis = reviewingTicketId === ticket.id && reviewMode !== null;

            return (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderStatusPill(ticket)}
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Requested: {ESCALATION_ROLE_LABELS[ticket.requestedRole]}
                      </span>
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#001E50]">
                        Target: {getBranchLabel(ticket.targetDealershipId)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {ticket.requestedDurationMinutes} mins requested
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{ticket.title}</h3>
                    <p className="text-xs text-slate-500">
                      Submitted by <strong className="text-slate-700">{ticket.requesterName}</strong> ({ticket.requesterEmail}) · Home Branch: {getBranchLabel(ticket.requesterBranchId)}
                    </p>
                  </div>

                  {canManageTickets && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {ticket.status === 'open' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openActionPanel(ticket, 'approve')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Grant Timed Access
                          </button>
                          <button
                            type="button"
                            onClick={() => openActionPanel(ticket, 'resolve')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001E50] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003380] cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolve Directly
                          </button>
                          <button
                            type="button"
                            onClick={() => openActionPanel(ticket, 'reject')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}

                      {activeNow && (
                        <>
                          <button
                            type="button"
                            onClick={() => openActionPanel(ticket, 'revoke')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Revoke Access Now
                          </button>
                          <button
                            type="button"
                            onClick={() => openActionPanel(ticket, 'resolve')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001E50] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003380] cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Resolved
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {ticket.reason}
                </div>

                {ticket.reviewNote && (
                  <div className="rounded-xl bg-blue-50/60 border border-blue-200 px-4 py-3 text-xs text-slate-800">
                    <span className="font-bold text-[#001E50]">
                      IT Manager Note ({ticket.reviewedByName || 'Group IT'}):{' '}
                    </span>
                    {ticket.reviewNote}
                  </div>
                )}

                {isReviewingThis && (
                  <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#001E50]">
                        {reviewMode === 'approve' && 'Grant Temporary Role Escalation'}
                        {reviewMode === 'resolve' && 'Resolve Directly Without Escalating Agent'}
                        {reviewMode === 'reject' && 'Reject Escalation Request'}
                        {reviewMode === 'revoke' && 'Revoke Active Temporary Escalation'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingTicketId(null);
                          setReviewMode(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {reviewError && (
                      <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {reviewError}
                      </p>
                    )}

                    {reviewMode === 'approve' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Access Window Duration
                        </label>
                        <select
                          value={reviewDurationMinutes}
                          onChange={(e) => setReviewDurationMinutes(Number(e.target.value))}
                          className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          {DURATION_OPTIONS.map((opt) => (
                            <option key={opt.minutes} value={opt.minutes}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {reviewMode === 'reject'
                          ? 'Rejection Reason (Required)'
                          : 'Resolution / Audit Note (Optional)'}
                      </label>
                      <textarea
                        rows={2}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder={
                          reviewMode === 'resolve'
                            ? 'Describe what you completed on behalf of the agent before marking resolved...'
                            : reviewMode === 'reject'
                            ? 'Explain why this elevation request was declined...'
                            : 'Add instructions or audit notes for the IT Agent...'
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={reviewSaving}
                        onClick={() => handleConfirmAction(ticket)}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer ${
                          reviewMode === 'reject'
                            ? 'bg-red-600 hover:bg-red-700'
                            : reviewMode === 'revoke'
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : reviewMode === 'approve'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-[#001E50] hover:bg-[#003380]'
                        }`}
                      >
                        {reviewSaving
                          ? 'Saving...'
                          : reviewMode === 'approve'
                          ? `Approve ${reviewDurationMinutes}m Access`
                          : reviewMode === 'resolve'
                          ? 'Confirm Resolved'
                          : reviewMode === 'revoke'
                          ? 'Confirm Revocation'
                          : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

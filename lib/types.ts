export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Platform = 'tiktok' | 'youtube' | 'instagram' | 'x';

export interface User {
  id: string;
  wallet: string | null;
  username: string | null;
  isAdmin?: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  creatorId: string;
  creatorWallet?: string;
  title: string;
  description: string;
  sourceUrl: string | null;
  platforms: Platform[];
  ratePerThousand: number; // cents per 1,000 views
  budgetCents: number; // confirmed escrow deposits minus refunds
  spentCents: number; // pending + confirmed payouts
  minViews: number;
  maxPayoutCents: number | null;
  requirements: string | null;
  status: CampaignStatus;
  createdAt: string;
  submissionCount?: number;
  pendingCount?: number;
}

export interface Submission {
  id: string;
  campaignId: string;
  clipperId: string;
  clipperWallet?: string;
  url: string;
  platform: Platform;
  status: SubmissionStatus;
  views: number;
  earnedCents: number;
  paidCents: number;
  createdAt: string;
  campaignTitle?: string;
  ratePerThousand?: number;
  lastTx?: string | null;
}

export interface PlatformStats {
  totalPaidCents: number;
  activeCampaigns: number;
  totalClips: number;
  totalViews: number;
  escrowedCents: number;
}

/* Postgres bigint → number (safe: cent totals stay far below 2^53) */
const n = (v: unknown) => Number(v ?? 0);

export function mapCampaign(r: Record<string, unknown>): Campaign {
  return {
    id: r.id as string,
    creatorId: r.creator_id as string,
    creatorWallet: (r.creator_wallet as string) ?? undefined,
    title: r.title as string,
    description: r.description as string,
    sourceUrl: (r.source_url as string) ?? null,
    platforms: (r.platforms as Platform[]) ?? [],
    ratePerThousand: n(r.rate_per_thousand),
    budgetCents: n(r.budget_cents),
    spentCents: n(r.spent_cents),
    minViews: n(r.min_views),
    maxPayoutCents: r.max_payout_cents == null ? null : n(r.max_payout_cents),
    requirements: (r.requirements as string) ?? null,
    status: r.status as CampaignStatus,
    createdAt: r.created_at as string,
    submissionCount: r.submission_count == null ? undefined : n(r.submission_count),
    pendingCount: r.pending_count == null ? undefined : n(r.pending_count),
  };
}

export function mapSubmission(r: Record<string, unknown>): Submission {
  return {
    id: r.id as string,
    campaignId: r.campaign_id as string,
    clipperId: r.clipper_id as string,
    clipperWallet: (r.clipper_wallet as string) ?? undefined,
    url: r.url as string,
    platform: r.platform as Platform,
    status: r.status as SubmissionStatus,
    views: n(r.views),
    earnedCents: n(r.earned_cents),
    paidCents: n(r.paid_cents),
    createdAt: r.created_at as string,
    campaignTitle: (r.campaign_title as string) ?? undefined,
    ratePerThousand: r.rate_per_thousand == null ? undefined : n(r.rate_per_thousand),
    lastTx: (r.last_tx as string) ?? null,
  };
}

/** Cents earned for a clip: rate is cents per 1,000 views, floored, capped. */
export function computeEarned(
  views: number,
  ratePerThousand: number,
  minViews: number,
  maxPayout: number | null
): number {
  if (views < minViews) return 0;
  let earned = Math.floor((views * ratePerThousand) / 1000);
  if (maxPayout != null) earned = Math.min(earned, maxPayout);
  return earned;
}

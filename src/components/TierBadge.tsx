import { badgeText, type Tier } from "../lib/loyalty";

/** Huy hiệu hạng thành viên (màu riêng từng hạng) hiển thị sau tên. */
export default function TierBadge({ tier }: { tier: Tier | null | undefined }) {
  if (!tier) return null;
  return <span className="tier-badge" style={{ background: tier.color, color: badgeText(tier.color) }} title={tier.name}>◆ {tier.name}</span>;
}

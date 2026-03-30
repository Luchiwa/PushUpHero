import './TierBadge.scss';

export const TIER_FROM_LEVEL = (lvl: number) =>
    lvl >= 35 ? 'platinum' : lvl >= 20 ? 'gold' : lvl >= 10 ? 'silver' : 'bronze';

export function TierBadge({ level }: { level: number }) {
    const tier = TIER_FROM_LEVEL(level);
    const TIER_ICON: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
    return (
        <span className={`friend-tier-badge friend-tier-badge--${tier}`} title={`${tier} tier`}>
            {TIER_ICON[tier]}
        </span>
    );
}

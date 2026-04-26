import { getTier, type Level, type Tier } from '@domain';
import './TierBadge.scss';

const TIER_ICON: Record<Tier, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };

export function TierBadge({ level }: { level: Level }) {
    const tier = getTier(level);
    return (
        <span className={`friend-tier-badge friend-tier-badge--${tier}`} title={`${tier} tier`}>
            {TIER_ICON[tier]}
        </span>
    );
}

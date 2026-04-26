import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { computeXpProgress, type AppUser, type DbUser } from '@domain';
import { Avatar } from '@components/Avatar/Avatar';
import { XPBar } from '@components/XPBar/XPBar';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import './PlayerHUD.scss';

interface PlayerHUDProps {
    user: AppUser | null;
    dbUser: DbUser | null;
    tier: string;
    level: number;
    totalXp: number;
    xpIntoCurrentLevel: number;
    xpNeededForNextLevel: number;
    levelProgressPct: number;
    onOpenProfile: () => void;
    onOpenAuth: () => void;
}

const RING_RADIUS = 32;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function LevelRing({ progress, tier }: { progress: number; tier: string }) {
    const clamped = Math.min(1, Math.max(0, progress));
    const offset = RING_CIRCUMFERENCE - clamped * RING_CIRCUMFERENCE;
    const style = {
        '--ring-circumference': `${RING_CIRCUMFERENCE}px`,
        '--ring-offset': `${offset}px`,
    } as CSSProperties;
    return (
        <svg
            className={`hud-level-ring tier-${tier}`}
            viewBox="0 0 72 72"
            width="72"
            height="72"
            aria-hidden="true"
            style={style}
        >
            <circle className="hud-level-ring-track" cx="36" cy="36" r={RING_RADIUS} />
            <circle
                className="hud-level-ring-fill"
                cx="36"
                cy="36"
                r={RING_RADIUS}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
            />
        </svg>
    );
}

export function PlayerHUD({
    user,
    dbUser,
    tier,
    level,
    totalXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    onOpenProfile,
    onOpenAuth,
}: PlayerHUDProps) {
    const { t } = useTranslation('start');
    const levelLabel = t('hud.level_kicker', {
        level: String(level).padStart(2, '0'),
        current: xpIntoCurrentLevel.toLocaleString(),
        total: xpNeededForNextLevel.toLocaleString(),
    });
    const { xpRemaining, progressRatio } = computeXpProgress(xpIntoCurrentLevel, xpNeededForNextLevel);

    return (
        <div className="player-hud">
            {user ? (
                <>
                    <div className="hud-row">
                        <button
                            type="button"
                            className={`hud-avatar-button tier-${tier}`}
                            onClick={onOpenProfile}
                            aria-label={t('hud.open_profile')}
                        >
                            <div className="hud-avatar-wrap">
                                <LevelRing progress={progressRatio} tier={tier} />
                                <Avatar
                                    photoURL={dbUser?.profile.photoURL}
                                    photoThumb={dbUser?.profile.photoThumb}
                                    initials={dbUser?.profile.displayName || 'U'}
                                    size={56}
                                    className="hud-avatar"
                                />
                                <span className={`hud-level-badge tier-${tier}`} aria-hidden="true">
                                    <span className="hud-level-badge-num">{level}</span>
                                </span>
                            </div>
                        </button>

                        <div className="hud-main">
                            <span className="hud-kicker">{levelLabel}</span>
                            <span className="hud-name">{dbUser?.profile.displayName || t('hud.default_player_name')}</span>
                        </div>

                        <div className="hud-total-xp" aria-label={t('hud.total_xp_aria', { xp: totalXp.toLocaleString() })}>
                            <span className="hud-total-xp-val">{totalXp.toLocaleString()}</span>
                            <span className="hud-total-xp-lbl">XP</span>
                        </div>
                    </div>

                    <XPBar
                        current={xpIntoCurrentLevel}
                        next={xpNeededForNextLevel}
                        rightLabel={t('hud.xp_to_next_level', { xp: xpRemaining.toLocaleString(), level: level + 1 })}
                    />
                </>
            ) : (
                <div className="player-hud-guest">
                    <div className="hud-guest-info">
                        <span className="hud-guest-kicker">{t('hud.guest_kicker')}</span>
                        <span className="hud-guest-sub">{t('hud.guest_subtitle')}</span>
                    </div>
                    <PrimaryCTA variant="solid" size="md" onClick={onOpenAuth}>
                        {t('hud.sign_in')}
                    </PrimaryCTA>
                </div>
            )}
        </div>
    );
}

import type { AppUser, DbUser } from '@hooks/useAuth';
import { Avatar } from '@components/Avatar/Avatar';
import { XPBar } from '@components/XPBar/XPBar';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import './PlayerHUD.scss';

interface PlayerHUDProps {
    user: AppUser | null;
    dbUser: DbUser | null;
    tier: string;
    streak: number;
    level: number;
    totalXp: number;
    xpIntoCurrentLevel: number;
    xpNeededForNextLevel: number;
    levelProgressPct: number;
    onOpenProfile: () => void;
    onOpenAuth: () => void;
}

export function PlayerHUD({
    user,
    dbUser,
    tier,
    streak,
    level,
    totalXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    onOpenProfile,
    onOpenAuth,
}: PlayerHUDProps) {
    const levelLabel = `LV ${String(level).padStart(2, '0')} · ${xpIntoCurrentLevel.toLocaleString()}/${xpNeededForNextLevel.toLocaleString()}`;
    const xpRemaining = Math.max(0, xpNeededForNextLevel - xpIntoCurrentLevel);

    return (
        <div className="player-hud">
            {user ? (
                <button type="button" className={`player-hud-card tier-${tier}`} onClick={onOpenProfile} title="Mon profil">
                    <div className="hud-avatar-wrap">
                        <Avatar
                            photoURL={dbUser?.photoURL}
                            photoThumb={dbUser?.photoThumb}
                            initials={dbUser?.displayName || 'U'}
                            size={48}
                            className="hud-avatar"
                        />
                        <span className={`hud-level-badge tier-${tier}`} aria-hidden="true">
                            <span className="hud-level-badge-num">{level}</span>
                        </span>
                    </div>

                    <div className="hud-info">
                        <div className="hud-top-row">
                            <span className="hud-name">{dbUser?.displayName || 'Player'}</span>
                            {streak > 0 && (
                                <span className={`hud-streak${streak >= 7 ? ' on-fire' : ''}`} aria-label={`${streak} day streak`}>
                                    <span className="hud-streak-icon" aria-hidden="true">🔥</span>
                                    <span className="hud-streak-val">{streak}</span>
                                </span>
                            )}
                            <span className="hud-total-xp" aria-label={`${totalXp} total XP`}>
                                <span aria-hidden="true">⚡</span>
                                <span className="hud-total-xp-val">{totalXp.toLocaleString()}</span>
                            </span>
                        </div>

                        <div className="hud-kicker">{levelLabel}</div>

                        <XPBar
                            current={xpIntoCurrentLevel}
                            next={xpNeededForNextLevel}
                            rightLabel={`${xpRemaining.toLocaleString()} XP → LV ${level + 1}`}
                        />
                    </div>

                    <span className="hud-chevron" aria-hidden="true">›</span>
                </button>
            ) : (
                <div className="player-hud-guest">
                    <div className="hud-guest-info">
                        <span className="hud-guest-kicker">Guest Profile</span>
                        <span className="hud-guest-sub">Sign in to save your progress</span>
                    </div>
                    <PrimaryCTA variant="solid" size="md" onClick={onOpenAuth}>
                        Sign in
                    </PrimaryCTA>
                </div>
            )}
        </div>
    );
}

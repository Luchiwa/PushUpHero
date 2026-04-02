import type { AppUser, DbUser } from '@hooks/useAuth';
import { Avatar } from '@components/Avatar/Avatar';
import './PlayerHUD.scss';

const XP_SEG_IDS = ['s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11'];

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
    levelProgressPct,
    onOpenProfile,
    onOpenAuth,
}: PlayerHUDProps) {
    const filledSegments = Math.round(levelProgressPct / 100 * XP_SEG_IDS.length);

    return (
        <div className="player-hud">
            {user ? (
                <button type="button" className={`player-hud-card tier-${tier}`} onClick={onOpenProfile} title="Mon profil">
                    <div className="hud-avatar-wrap">
                        <Avatar
                            photoURL={dbUser?.photoURL}
                            photoThumb={dbUser?.photoThumb}
                            initials={dbUser?.displayName || 'U'}
                            size={44}
                            className="hud-avatar"
                        />
                        <span className={`hud-level-badge tier-${tier}`}>LV{level}</span>
                    </div>

                    <div className="hud-info">
                        <div className="hud-top-row">
                            <span className="hud-name">{dbUser?.displayName || 'Player'}</span>
                            {streak > 0 && (
                                <span className={`hud-streak${streak >= 7 ? ' on-fire' : ''}`}>
                                    {streak}<span className="hud-streak-icon">🔥</span>
                                </span>
                            )}
                            <span className="hud-total-xp">⚡{totalXp.toLocaleString()}</span>
                        </div>

                        <div className="hud-xp-bar" role="progressbar" aria-valuenow={xpIntoCurrentLevel} aria-valuemax={xpNeededForNextLevel}>
                            {XP_SEG_IDS.map((id, i) => (
                                <div
                                    key={id}
                                    className={`hud-xp-seg${i < filledSegments ? ' filled' : ''}${i === filledSegments - 1 && filledSegments > 0 ? ' tip' : ''}`}
                                    style={{ animationDelay: `${i * 60}ms` }}
                                />
                            ))}
                        </div>

                        <div className="hud-xp-label">
                            <span>{xpIntoCurrentLevel.toLocaleString()} XP</span>
                            <span className="hud-xp-next">→ LV{level + 1} in {(xpNeededForNextLevel - xpIntoCurrentLevel).toLocaleString()} XP</span>
                        </div>
                    </div>

                    <span className="hud-chevron">›</span>
                </button>
            ) : (
                <div className="player-hud-guest">
                    <div className="hud-guest-info">
                        <span className="hud-guest-label">🎮 Playing as Guest</span>
                        <span className="hud-guest-sub">Sign in to save your progress</span>
                    </div>
                    <button type="button" className="hud-signin-btn" onClick={onOpenAuth}>
                        Sign in
                    </button>
                </div>
            )}
        </div>
    );
}

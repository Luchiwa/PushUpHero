import { useAuth } from '../hooks/useAuth';
import { useLevelSystem } from '../hooks/useLevelSystem';
import { useSessionHistory } from '../hooks/useSessionHistory';

interface ProfileModalProps {
    onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
    const { user, dbUser, logout } = useAuth();
    const { level, totalLifetimeReps } = useLevelSystem();
    const { getSessions } = useSessionHistory();
    const sessions = getSessions();

    const handleLogout = async () => {
        await logout();
        onClose();
    };

    if (!user) return null;

    const memberSince = dbUser?.createdAt
        ? new Date(dbUser.createdAt).toLocaleDateString()
        : new Date(user.metadata.creationTime || Date.now()).toLocaleDateString();

    return (
        <div className="auth-modal-overlay">
            <div className="profile-modal-card">
                <button className="btn-close" onClick={onClose}>✕</button>

                <div className="profile-header">
                    <div className="profile-avatar-large">
                        {dbUser?.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="profile-info">
                        <h2>{dbUser?.displayName || 'User'}</h2>
                        <span className="profile-member-since">Member since {memberSince}</span>
                    </div>
                </div>

                <div className="profile-stats-grid">
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{level}</span>
                        <span className="profile-stat-label">Level</span>
                    </div>
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{totalLifetimeReps}</span>
                        <span className="profile-stat-label">Total Reps</span>
                    </div>
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{sessions.length}</span>
                        <span className="profile-stat-label">Sessions</span>
                    </div>
                </div>

                <div className="profile-actions">
                    <button className="btn-outline btn-logout" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

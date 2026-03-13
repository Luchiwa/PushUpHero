import './Avatar.scss';

interface AvatarProps {
    photoURL?: string | null;
    initials: string;
    size?: number;
    className?: string;
    onClick?: () => void;
}

export function Avatar({ photoURL, initials, size = 40, className = '', onClick }: AvatarProps) {
    const style = { width: size, height: size, fontSize: size * 0.4 };

    return (
        <div
            className={`avatar ${onClick ? 'avatar--clickable' : ''} ${className}`}
            style={style}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {photoURL ? (
                <img
                    src={photoURL}
                    alt={initials}
                    className="avatar__img"
                    draggable={false}
                />
            ) : (
                <span className="avatar__initials">{initials[0]?.toUpperCase() || '?'}</span>
            )}
        </div>
    );
}

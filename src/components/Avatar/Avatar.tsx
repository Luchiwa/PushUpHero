import { useState, useEffect, useRef } from 'react';
import { getCachedAvatarUrl } from '@hooks/useAvatarCache';
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
    const [cachedSrc, setCachedSrc] = useState<string | null>(null);
    const prevUrl = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (!photoURL) {
            setCachedSrc(null);
            prevUrl.current = photoURL;
            return;
        }

        // Only refetch if the URL actually changed
        if (photoURL === prevUrl.current) return;
        prevUrl.current = photoURL;

        let revoked = false;
        getCachedAvatarUrl(photoURL).then(url => {
            if (!revoked) setCachedSrc(url);
        });
        return () => {
            revoked = true;
        };
    }, [photoURL]);

    return (
        <div
            className={`avatar ${onClick ? 'avatar--clickable' : ''} ${className}`}
            style={style}
            onClick={onClick}
            onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {cachedSrc ? (
                <img
                    src={cachedSrc}
                    alt={initials}
                    className="avatar__img"
                    draggable={false}
                />
            ) : photoURL ? (
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

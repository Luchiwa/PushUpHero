import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './PrimaryCTA.scss';

interface PrimaryCTAProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: ReactNode;
    variant?: 'solid' | 'ghost';
    size?: 'md' | 'lg';
    block?: boolean;
}

export const PrimaryCTA = forwardRef<HTMLButtonElement, PrimaryCTAProps>(
    ({ icon, variant = 'solid', size = 'md', block = false, className, children, ...rest }, ref) => {
        const classes = [
            'primary-cta',
            `primary-cta--${variant}`,
            `primary-cta--${size}`,
            block ? 'primary-cta--block' : '',
            className ?? '',
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <button ref={ref} type="button" className={classes} {...rest}>
                {icon ? <span className="primary-cta-icon" aria-hidden="true">{icon}</span> : null}
                <span className="primary-cta-label">{children}</span>
            </button>
        );
    }
);

PrimaryCTA.displayName = 'PrimaryCTA';

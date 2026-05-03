/**
 * Button — Arena design-system primitive.
 *
 * Canonical button API for the app. Implements the spec from the
 * design-system handoff verbatim:
 *
 *   - 4 variants: primary | secondary | ghost | danger (default 'primary')
 *   - 3 sizes:    lg | md | sm                          (default 'lg')
 *   - Oswald 600 UPPERCASE, letter-spacing 2px (brand rule)
 *   - 16px radius, 180ms `$ease-arena`, focus-visible ember outline
 *
 * Don't hand-roll buttons elsewhere — extend this if a new variant or size
 * is needed (and update the spec first).
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Optional node rendered before `children` (e.g. an inline SVG). */
    icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { children, variant = 'primary', size = 'lg', icon, className, type = 'button', ...rest },
    ref,
) {
    const classes = [
        'arena-btn',
        `arena-btn--${variant}`,
        `arena-btn--${size}`,
        className ?? '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button ref={ref} type={type} className={classes} {...rest}>
            {icon ? <span className="arena-btn-icon" aria-hidden="true">{icon}</span> : null}
            <span className="arena-btn-label">{children}</span>
        </button>
    );
});

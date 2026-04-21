import type { ReactNode } from 'react';
import './ExerciseCard.scss';

interface ExerciseStat {
    label: string;
    value: ReactNode;
    highlight?: boolean;
}

interface ExerciseCardProps {
    title: string;
    subtitle?: string;
    index?: number;
    stats?: ExerciseStat[];
    actions?: ReactNode;
    onClick?: () => void;
    children?: ReactNode;
    selected?: boolean;
}

export function ExerciseCard({
    title,
    subtitle,
    index,
    stats,
    actions,
    onClick,
    children,
    selected = false,
}: ExerciseCardProps) {
    const Wrapper = onClick ? 'button' : 'div';

    return (
        <Wrapper
            type={onClick ? 'button' : undefined}
            className={`exercise-card${onClick ? ' exercise-card--clickable' : ''}${selected ? ' exercise-card--selected' : ''}`}
            onClick={onClick}
        >
            {typeof index === 'number' && (
                <span className="exercise-card-index" aria-hidden="true">{index}</span>
            )}

            <div className="exercise-card-body">
                <div className="exercise-card-head">
                    <div className="exercise-card-titles">
                        <h3 className="exercise-card-title">{title}</h3>
                        {subtitle ? <span className="exercise-card-subtitle">{subtitle}</span> : null}
                    </div>
                    {actions ? <div className="exercise-card-actions">{actions}</div> : null}
                </div>

                {stats && stats.length > 0 ? (
                    <dl className="exercise-card-stats">
                        {stats.map((stat) => (
                            <div className="exercise-card-stat" key={stat.label}>
                                <dt className="exercise-card-stat-label">{stat.label}</dt>
                                <dd
                                    className={`exercise-card-stat-value${stat.highlight ? ' exercise-card-stat-value--hi' : ''}`}
                                >
                                    {stat.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ) : null}

                {children}
            </div>
        </Wrapper>
    );
}

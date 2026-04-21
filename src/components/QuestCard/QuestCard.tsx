import type { CSSProperties, ReactNode } from 'react';
import { CornerFrame } from '@components/CornerFrame/CornerFrame';
import './QuestCard.scss';

type Tone = 'ember' | 'gold' | 'purple' | 'ice' | 'good';

interface QuestCardProps {
    kicker?: string;
    title: ReactNode;
    description?: ReactNode;
    reward?: ReactNode;
    tone?: Tone;
    footer?: ReactNode;
    onClick?: () => void;
    children?: ReactNode;
}

const TONE_VAR: Record<Tone, string> = {
    ember: 'var(--ember)',
    gold: 'var(--gold)',
    purple: 'var(--purple)',
    ice: 'var(--ice)',
    good: 'var(--good)',
};

export function QuestCard({
    kicker,
    title,
    description,
    reward,
    tone = 'ember',
    footer,
    onClick,
    children,
}: QuestCardProps) {
    const style = { '--quest-tone': TONE_VAR[tone] } as CSSProperties;
    const Wrapper = onClick ? 'button' : 'div';

    return (
        <CornerFrame tone={tone}>
            <Wrapper
                type={onClick ? 'button' : undefined}
                className={`quest-card${onClick ? ' quest-card--clickable' : ''}`}
                style={style}
                onClick={onClick}
            >
                <div className="quest-card-scanline" aria-hidden="true" />

                <div className="quest-card-head">
                    <div className="quest-card-head-text">
                        {kicker ? <span className="quest-card-kicker">{kicker}</span> : null}
                        <h3 className="quest-card-title">{title}</h3>
                        {description ? <p className="quest-card-desc">{description}</p> : null}
                    </div>
                    {reward ? <div className="quest-card-reward">{reward}</div> : null}
                </div>

                {children ? <div className="quest-card-body">{children}</div> : null}
                {footer ? <div className="quest-card-footer">{footer}</div> : null}
            </Wrapper>
        </CornerFrame>
    );
}

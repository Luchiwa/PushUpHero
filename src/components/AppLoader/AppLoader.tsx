import './AppLoader.scss';

export function AppLoader() {
    return (
        <div className="app-loader">
            <div className="app-loader__barbell">
                <div className="app-loader__plate app-loader__plate--left-sm" />
                <div className="app-loader__plate app-loader__plate--left-lg" />
                <div className="app-loader__bar" />
                <div className="app-loader__plate app-loader__plate--right-lg" />
                <div className="app-loader__plate app-loader__plate--right-sm" />
            </div>

            <div className="app-loader__brand">
                {/* Classic ECG trace — sawtooth heartbeat that draws itself
                    across the wordmark in a continuous loop. Sits above the
                    wordmark (z-index 1) so the QRS spike visibly cuts
                    through it. */}
                <svg
                    className="app-loader__heartbeat"
                    viewBox="0 0 300 60"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <path
                        className="app-loader__heartbeat-line"
                        d="M 0 30 H 105 L 118 30 L 128 22 L 138 8 L 148 50 L 158 18 L 168 34 L 178 30 H 300"
                    />
                </svg>
                <h1 className="app-loader__wordmark">Push-Up Hero</h1>
            </div>
        </div>
    );
}

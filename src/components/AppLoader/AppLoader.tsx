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
                    across the wordmark in a continuous loop. The line is
                    rendered above the hero text (z-index 1) so the spike
                    visibly cuts through "HERO". */}
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
                <h1 className="app-loader__wordmark">
                    <span className="app-loader__wordmark-prefix">Push-Up</span>
                    <span className="app-loader__wordmark-hero">
                        <span>H</span><span>E</span><span>R</span><span>O</span>
                    </span>
                </h1>
                <p className="app-loader__caption">Live Form Tracker</p>
            </div>
        </div>
    );
}

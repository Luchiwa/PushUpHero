import './ModalFallback.scss';

/**
 * ModalFallback — Suspense fallback for lazy-loaded modals/screens.
 * Centered ember spinner over a transparent backdrop. Replaces the
 * `fallback={null}` flash-of-blank that the user otherwise sees on
 * first open over a slow network.
 */
export function ModalFallback() {
    return (
        <div className="modal-fallback" role="status" aria-label="Loading">
            <span className="modal-fallback__spinner" aria-hidden="true" />
        </div>
    );
}

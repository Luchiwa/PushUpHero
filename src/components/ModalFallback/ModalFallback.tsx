import './ModalFallback.scss';

// Replaces `fallback={null}` so users don't see a flash-of-blank
// while a lazy modal/screen chunk loads on slow networks.
export function ModalFallback() {
    return (
        <div className="modal-fallback" role="status" aria-label="Loading">
            <span className="modal-fallback__spinner" aria-hidden="true" />
        </div>
    );
}

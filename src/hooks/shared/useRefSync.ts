import { useRef, useEffect } from 'react';

/**
 * Keeps a ref in sync with a value. Useful to read the latest value
 * inside callbacks/effects without listing it as a dependency.
 */
export function useRefSync<T>(value: T): React.MutableRefObject<T> {
    const ref = useRef(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref;
}

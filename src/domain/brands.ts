/**
 * brands.ts — Branded primitive types for domain identities & scalars.
 *
 * Prevents primitive obsession at module boundaries: a `UserId` cannot
 * be confused with a `displayName`, a `Level` cannot be confused with
 * an `XpAmount`. TypeScript enforces these distinctions at compile time;
 * at runtime, a branded value is just its underlying primitive.
 *
 * Mint at boundaries only:
 *   - Firebase Auth → createUserId(firebaseUser.uid)
 *   - Firestore unfold → createLevel(flat.level), createXpAmount(flat.totalXp)
 *
 * Components/hooks consume brands via the natural pipe — no `as` casts
 * outside these factories.
 */

export type UserId = string & { readonly __brand: 'UserId' };
export type Level = number & { readonly __brand: 'Level' };
export type XpAmount = number & { readonly __brand: 'XpAmount' };

export function createUserId(s: string): UserId {
    if (!s) throw new Error('createUserId: empty string');
    return s as UserId;
}

export function createLevel(n: number): Level {
    if (!Number.isInteger(n) || n < 0) {
        throw new Error(`createLevel: invalid level ${n}`);
    }
    return n as Level;
}

export function createXpAmount(n: number): XpAmount {
    if (!Number.isFinite(n) || n < 0) {
        throw new Error(`createXpAmount: invalid xp ${n}`);
    }
    return n as XpAmount;
}

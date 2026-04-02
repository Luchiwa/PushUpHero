/** True on Android / iOS mobile browsers. Evaluated once at module load. */
export const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** True on iOS (iPhone / iPad / iPod). */
export const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

---
name: Heavy model consideration
description: MediaPipe Heavy model considered for future exercises but deferred — not worth the cost for leg raises alone
type: project
---

Heavy model (~30MB vs ~8MB Full) considered for conditional loading on lying-down exercises (leg raises). Deferred for now.

**Why:** Leg raises work with Full model + confidence interpolation. Grades are not great but ankles being out of frame is likely a bigger factor than model precision. Heavy model makes more sense when multiple exercises benefit from it.

**How to apply:** When adding new exercises with unusual poses (lying, inverted, etc.), revisit the Heavy model option. Implementation would require conditional model loading in `usePoseDetection.ts` based on exercise type, with ~1-3s loading screen on switch.

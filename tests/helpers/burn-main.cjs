'use strict';
// test_busy_shed.js preload: while the file named by BURN_ON exists, the server's main thread is kept busy about BURN_PCT % of the time
// (after each idle gap it busy-waits gap x duty / (1 - duty)), the way a full Server 1 is. Requests are still served in the gaps.
// Test servers only.
// v1368 (flakes, Phil 11 Nov: "Have all the flaky suite failure been resolved?"): the duty was fixed at BURN_PCT. On a loaded cluster CT
// the requests' own work (slower there) filled the 5 % gaps, the server's 2 s event-loop utilisation read 1.000, the shed share p
// pinned at 1 - every POST was refused (40 of 40: "actions less often than polls" failed) and no cloud save was ever accepted
// (the "refused save changed nothing" check had nothing to compare) - test_busy_shed failed 5 of 5 suites on 11 Nov. The burn now
// steers the duty from the same measure the server sheds by (perf_hooks event-loop utilisation, burn + request work together), so
// the main thread sits at BURN_PCT % on an idle PC and on a loaded CT alike, i.e. in the middle of the shed band, which is what
// the test means to put it in. BURN_FIXED=1 = the old fixed duty.
const fs = require('fs');
const { performance } = require('perf_hooks');
const on = process.env.BURN_ON, pct = Math.min(99, Math.max(1, +process.env.BURN_PCT || 93)), target = pct / 100, fixed = process.env.BURN_FIXED === '1';
if (on) {
  let last = Date.now(), live = false, checkedAt = 0, duty = target;
  const tick = () => {
    const now = Date.now();
    if (now - checkedAt > 200) { checkedAt = now; try { live = fs.existsSync(on); } catch (e) { live = false; } }
    if (live && duty > 0) { const b = Math.min(400, Math.max(1, now - last) * duty / (1 - duty)); while (Date.now() - now < b) {} }
    last = Date.now(); setTimeout(tick, 1).unref();
  };
  setTimeout(tick, 1).unref();
  if (!fixed) {   // every 250 ms (the server samples on the same period): move the duty by half the gap between measured and wanted utilisation
    let prev = performance.eventLoopUtilization();
    setInterval(() => {
      const cur = performance.eventLoopUtilization(), u = performance.eventLoopUtilization(cur, prev).utilization; prev = cur;
      if (!live) { duty = target; return; }
      duty = Math.min(0.99, Math.max(0, duty + 0.5 * (target - u)));
    }, 250).unref();
  }
}

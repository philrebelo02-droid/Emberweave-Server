'use strict';
// test_busy_shed.js preload: while the file named by BURN_ON exists, the server's main thread is kept busy about BURN_PCT % of the time
// (after each idle gap it busy-waits gap x pct / (100 - pct), so the share holds whatever the timer resolution), the way a full
// Server 1 is. Requests are still served in the gaps. Test servers only.
const fs = require('fs');
const on = process.env.BURN_ON, pct = Math.min(99, Math.max(1, +process.env.BURN_PCT || 93));
if (on) {
  let last = Date.now(), live = false, checkedAt = 0;
  const tick = () => {
    const now = Date.now();
    if (now - checkedAt > 200) { checkedAt = now; try { live = fs.existsSync(on); } catch (e) { live = false; } }
    if (live) { const b = Math.min(400, Math.max(1, now - last) * pct / (100 - pct)); while (Date.now() - now < b) {} }
    last = Date.now(); setTimeout(tick, 1).unref();
  };
  setTimeout(tick, 1).unref();
}

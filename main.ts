// V-catcher IV — long-only cbBTC bot for make.fun's btc-race-24h-20261123-0511.
//
// Strategy (re-tuned on THIS race's frozen dev window, 22 Nov 05:11Z - 23 Nov
// 05:11Z: a +3.6% trend day — a steady climb for ~6h, then 18h of flat chop
// between roughly $60.4k and $61.6k):
//   * Enter early on the first sign of a move and then HOLD. On this
//     window every exit-and-rebuy in the chop loses to the ~26 bps round-trip
//     cost, so the exit is a wide 3% trailing stop that only fires on a real
//     reversal, never on chop noise (the deepest post-entry pullback on dev
//     is 1.98%, so 3% clears it with room to spare).
//   * Four entry legs, any one fires while flat:
//       (0) dip-buy — 5-minute return <= -30 bps. Buys the first short-term
//           dip. On this dev window the price drifts down from $58,957 to
//           $58,669 in the first hour before the climb; this leg buys that
//           dip and is what beats the momentum baseline (+$34.94) on dev.
//       (1) momentum burst — 5-minute return >= +20 bps. The rise opens
//           gradually (its first 5-min bars print +20-40 bps), so the
//           65 bps threshold that won the 15/17 Nov windows enters near the
//           top here and loses; +20 bps enters on the first bar of the move.
//       (2) dip-reversal — 60-minute return <= -150 bps AND 5-minute
//           return >= +60 bps (unchanged from the earlier V-catcher legs;
//           fires zero times on this dev window — it is there for race day).
//       (3) Donchian breakout — close clears the prior 90-bar high
//           (margin 0). Catches a slow grind up that never prints a sharp
//           5-minute burst.
//   * Exit: trailing stop 3% below the peak close since entry.
//   * All decisions are BigInt comparisons on raw closes. No floats, no
//     clock, no network, no randomness. One position, full size, long only.

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Entry thresholds, in basis points (10_000 bps = 100%).
const DIP_BUY_BPS = 30n; // 5-min drop that fires the dip-buy leg
const BURST_BPS = 20n; // 5-min return that fires the momentum leg
const DIP_BPS = 150n; // 60-min drop that arms the dip-reversal leg
const REVERSAL_BPS = 60n; // 5-min bounce that fires the dip leg
const DONCHIAN_BARS = 90; // lookback for the breakout leg
const TRAIL_BPS = 300n; // trailing stop below the peak close since entry

const MAX_SLIPPAGE_BPS = 100;
const HISTORY_CAP = 240;

const closes: bigint[] = [];
let peakClose = 0n;

function retBps(now: bigint, then: bigint): bigint {
  return ((now - then) * 10000n) / then;
}

await runBars({
  onBatch(state) {
    if (state.warmingUp) return [];
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    closes.push(close);
    if (closes.length > HISTORY_CAP) closes.shift();

    const held = state.positions.get(SYMBOL)?.qty ?? 0n;
    const n = closes.length;
    // 5-minute return, computed once and shared by the legs that use it.
    const r5 = n >= 6 ? retBps(close, closes[n - 6]!) : null;

    if (held === 0n) {
      let enter = false;

      // Leg 0: dip-buy — a short 5-minute dip is a cheap entry.
      if (r5 !== null && r5 <= -DIP_BUY_BPS) enter = true;

      // Leg 1: momentum burst on the 5-minute return.
      if (!enter && r5 !== null && r5 >= BURST_BPS) enter = true;

      // Leg 2: dip-reversal — deep 60-minute drop, then a sharp bounce.
      if (!enter && n >= 61) {
        const r60 = retBps(close, closes[n - 61]!);
        if (r60 <= -DIP_BPS && r5 !== null && r5 >= REVERSAL_BPS) {
          enter = true;
        }
      }

      // Leg 3: Donchian breakout — close above every close of the prior 90 bars.
      if (!enter && n > DONCHIAN_BARS) {
        let high = 0n;
        for (let i = n - DONCHIAN_BARS - 1; i < n - 1; i++) {
          if (closes[i]! > high) high = closes[i]!;
        }
        if (close >= high) enter = true;
      }

      if (enter && state.cash >= 1000000n) {
        peakClose = close;
        return [
          {
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      return [];
    }

    // Long: update the peak and trail out 3% below it.
    if (close > peakClose) peakClose = close;
    if (close * 10000n <= peakClose * (10000n - TRAIL_BPS)) {
      return [
        {
          side: 'sell',
          symbol: SYMBOL,
          qty: held,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});

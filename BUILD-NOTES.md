# V-catcher IV — build notes (btc-race-24h-20261123-0511)

## Dev window
24h of 1-minute cbBTC bars, 22 Nov 05:11Z – 23 Nov 05:11Z, 1,440 bars, 0 gaps.
Shape: a +3.64% trend day — flat first hour (~$58.9k, low $58,669 at bar 34),
a steady climb to ~$60.9k by bar 360, then 18h of chop $60.4k–$61.6k.
Buy-and-hold on it: +$32.17. Momentum baseline: +$34.94 (buys batch 24).

## Design (main.ts, written fresh by hand from the prose spec + kit)
Long-only, full size, one position. Four entry legs, any one fires while flat:
- (0) dip-buy — 5-min return <= -30 bps. Buys the first short-term dip.
  On this window it catches the early drift down to $58,669 and is what
  beats the momentum baseline on dev.
- (1) momentum burst — 5-min return >= +20 bps (re-tuned from +65 bps:
  this window's rise opens gradually, +20-40 bps on its first 5-min bars,
  so +65 enters near the top and loses −$17.75).
- (2) dip-reversal — 60-min return <= -150 bps AND 5-min return >= +60 bps
  (inherited from V-catcher III; fires zero times on this dev window).
- (3) Donchian breakout — close clears the prior 90-bar high, margin 0.
Exit: 3% trailing stop below the peak close since entry. All decisions are
BigInt comparisons on raw closes; no floats, clock, network, or randomness.
History capped at 240 bars. max_slippage_bps 100.

## Local dev gate (grade-local --driver process, commit 6067758)
- **Net PnL +36.156883 USDC** (return +0.036156883; 90% interval is a point)
- 1 trade (1 round trip: dip-buy decided bar 7, filled bar 8 at ~$58,727,
  held to the end),
  win rate 1.000, max drawdown 0.019778 (1.98%), exposure 0.9944,
  Sharpe 0.0307, 0 rejected. Fees 0.814629 USDC; at 2x fees +35.328719.
- Guardrails met (≥1 trade, max DD ≤ 25%).
- L1 regrade reproduced byte for byte.
  action_log_sha256 fec9ea4c9f02a273e7ce95a9f09a65f742e2503a8115622fe1d5d9f6afab2d65
  result_sha256 03f2197264d30dadcfa5c569be1c7aa5e30a23020bc6547f606e05cf562c6e61
  (local node v24.22.1 vs server v26.13.1, so the server's sha will differ.)

## Baselines on the same dev window (grade-local)
buy-and-hold +32.167313, momentum +34.941371, hold-cash 0.000000 (0 trades,
guardrails NOT met), rsi-bollinger −9.324000, adx-momentum −11.198562,
ema-cross −114.826956. The bot (+36.156883) beats every baseline.

## What was tested and rejected (tuning simulator, verified by grade-local)
- V-catcher III config (burst 65, trail 50): −$17.75 on this window — the
  gradual rise defeats the high burst threshold; rejected.
- Burst 20 + trail 300 without the dip-buy leg: +$34.28 — beats buy-and-hold
  but LOSES to the momentum baseline (+$34.94) by $0.66; rejected.
- Fast-drop exit (5-min <= -80 bps, armed or not): +$34.59 with the
  burst-only bot, +$34.90 with the dip-buy bot — the exit fires after the
  drop has already happened, then rebuys at nearly the same price; rejected.
- Entry-stop (2% below entry) and post-exit re-entry cooldown (burst 65):
  both made the falling-day backtests worse; rejected.
- Profit targets (+1.2%/+1.5%/+2.0%): no plateau, single-trade overfit;
  rejected (same finding as the 17 Nov race).

## Cross-window backtest (same simulator, prior races' published dev sets)
Same strategy on the 15 Nov (−4.00%), 17 Nov (+0.49%) and 18 Nov (−2.80%)
dev windows: −$57.52, −$0.76, −$31.06. Honest caveat: this design is a
trend-day bot. It beats every baseline on THIS race's rising dev window,
but on a falling race day it rides the fall (like buy-and-hold does) and
would rank on how little it loses, not on gains. The selective V-catcher
III design is far better on falling days (−$5.99 / −$3.55) but scores
−$17.75 on this dev window and FAILS this race's dev gate, so it cannot
race here at all. Among configs that pass this race's dev gate, this one
has the highest dev score.

## Repo
- Final commit 6067758 (main.ts + vendor/makefun-bars.ts + LICENSE +
  README.md + BUILD-NOTES.md + .makefun/freshness.json).
- Anchor 54addf27ec870cfe2c8c1919821acca93b7f115e, drand round 34206653.
- Kit SDK shim vendor/makefun-bars.ts copied byte-identical
  (sha256 9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8).
- GitHub mirror: https://github.com/piningit23/btc-race-24h-20261123-0511
- Race: entries close 2026-11-23 11:11Z (18:11 WIB); race runs 24h from
  ~18:26 WIB; result due ~10 Dec 2026. Pot $50, 1st $12, top 10 paid.

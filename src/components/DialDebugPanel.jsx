import { formatMoney } from '../utils/format.js'
import { rampHex, RAMP_STOPS } from '../utils/color.js'
import { MOTION, formatEasing } from '../utils/motion.js'

// DEV TOOL. A spec sheet you can watch.
//
// The scrubber does for the dial what dragging a playhead does in an animation
// editor: it drives the ring through its entire range - including out past the
// limit into overage - without needing to log fake spends to get there. The
// trigger buttons fire each time-based moment on demand, and the speed control
// slows everything down enough to actually see a curve resolve.
//
// The readout is the part that matters: every duration and cubic-bezier below
// is read live from the same MOTION table the running animation uses, so it
// can't drift out of sync with what's on screen, and the numbers can be
// retyped straight into Rive's interpolation panel. The resolved hex updates
// as you scrub, so the exact color at any point on the ramp can be copied out.
//
// Remove alongside the other dev tools before shipping.

const SPEEDS = [1, 0.5, 0.25]

const TRIGGERS = [
  { type: 'entry', label: 'ENTRY', motion: MOTION.entry },
  { type: 'tap', label: 'TAP', motion: MOTION.tapPress },
  { type: 'thresholdPulse', label: 'THRESHOLD PULSE', motion: MOTION.thresholdPulse }
]

const VALUE_DRIVEN = [MOTION.arcSettle, MOTION.colorDrift, MOTION.numberCount]

export default function DialDebugPanel({
  percent,
  onPercentChange,
  overrideActive,
  onToggleOverride,
  speed,
  onSpeedChange,
  onTrigger,
  limit,
  onClose
}) {
  // Kept exact and only rounded at display time, so these figures describe the
  // ring precisely rather than approximately - see the matching note in
  // Dashboard about why the scrub isn't quantised to whole dollars.
  const fraction = percent / 100
  const spent = limit * fraction
  const remaining = limit - spent
  const isOver = spent > limit
  const hex = rampHex(fraction)

  const scaled = (ms) => Math.round(ms / speed)

  return (
    <div className="debug-panel">
      <div className="debug-inner">
        <div className="debug-header">
          <p className="debug-title">◈ MOTION DEBUG</p>
          <button type="button" className="debug-close" onClick={onClose}>
            CLOSE
          </button>
        </div>

        <div className="debug-block">
          <p className="debug-block-title">SCRUB — DRIVES THE DIAL WITHOUT LOGGING ANYTHING</p>
          <div className="debug-scrub-row">
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={percent}
              onChange={(e) => onPercentChange(Number(e.target.value))}
              aria-label="Scrub spend percentage"
            />
            <span className="debug-scrub-value">{percent}% spent</span>
          </div>
          <div className="debug-buttons">
            <button
              type="button"
              className={`debug-button ${overrideActive ? 'debug-button-active' : ''}`}
              onClick={onToggleOverride}
            >
              {overrideActive ? 'OVERRIDE ON' : 'OVERRIDE OFF'}
            </button>
            {[0, 35, 65, 70, 90, 100, 150, 200].map((p) => (
              <button
                key={p}
                type="button"
                className="debug-button"
                onClick={() => onPercentChange(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="debug-block">
          <p className="debug-block-title">RESOLVED AT THIS POSITION</p>
          <div className="debug-readout">
            <div className="debug-readout-row">
              <span className="debug-readout-key">spent / limit</span>
              <span className="debug-readout-value">
                {formatMoney(spent)} / {formatMoney(limit)}
              </span>
            </div>
            <div className="debug-readout-row">
              <span className="debug-readout-key">dial shows</span>
              <span className="debug-readout-value">
                {isOver ? `${formatMoney(spent - limit)} over` : `${formatMoney(remaining)} remaining`}
              </span>
            </div>
            <div className="debug-readout-row">
              <span className="debug-readout-key">arc</span>
              <span className="debug-readout-value">
                {isOver
                  ? `${Math.round(Math.min(1, (spent - limit) / limit) * 100)}% counter-clockwise`
                  : `${Math.round(Math.max(0, 1 - fraction) * 100)}% clockwise`}
              </span>
            </div>
            <div className="debug-readout-row">
              <span className="debug-readout-key">ring color</span>
              <span className="debug-readout-value">
                <span className="debug-swatch-row">
                  <span className="debug-swatch" style={{ background: hex }} />
                  {hex}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="debug-block">
          <p className="debug-block-title">PLAY A MOMENT</p>
          <div className="debug-buttons">
            {TRIGGERS.map((t) => (
              <button
                key={t.type}
                type="button"
                className="debug-button"
                onClick={() => onTrigger(t.type)}
              >
                ▶ {t.label}
              </button>
            ))}
          </div>
          <div className="debug-buttons">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`debug-button ${speed === s ? 'debug-button-active' : ''}`}
                onClick={() => onSpeedChange(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="debug-block">
          <p className="debug-block-title">VALUE-DRIVEN — INTERPOLATED, NOT PLAYED</p>
          <div className="debug-readout">
            {VALUE_DRIVEN.map((m) => (
              <div className="debug-readout-row" key={m.label}>
                <span className="debug-readout-key">{m.label}</span>
                <span className="debug-readout-value">
                  {scaled(m.duration)}ms · {formatEasing(m.easing)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="debug-block">
          <p className="debug-block-title">TIME-DRIVEN — THE ONES WORTH REBUILDING IN RIVE</p>
          <div className="debug-readout">
            {[MOTION.entry, MOTION.idleBreathe, MOTION.tapPress, MOTION.tapRelease, MOTION.thresholdPulse].map(
              (m) => (
                <div className="debug-readout-row" key={m.label}>
                  <span className="debug-readout-key">{m.label}</span>
                  <span className="debug-readout-value">
                    {scaled(m.duration)}ms · {formatEasing(m.easing)}
                    {m.loop ? ' · loops' : ''}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="debug-block">
          <p className="debug-block-title">COLOR RAMP STOPS — OKLCH INTERPOLATED, SHORTEST HUE PATH</p>
          <div className="debug-readout">
            {RAMP_STOPS.map((stop) => (
              <div className="debug-readout-row" key={`${stop.at}-${stop.label}`}>
                <span className="debug-readout-key">{Math.round(stop.at * 100)}% spent</span>
                <span className="debug-readout-value">
                  <span className="debug-swatch-row">
                    <span className="debug-swatch" style={{ background: stop.hex }} />
                    {stop.hex} · {stop.label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

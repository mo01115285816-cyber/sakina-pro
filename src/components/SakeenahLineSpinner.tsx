import React from "react";

type SakeenahLineSpinnerProps = {
  size?: number;
  color?: string;
  duration?: string;
  label?: string;
  className?: string;
};

const BAR_INDICES = Array.from({ length: 12 }, (_, index) => index);

/**
 * Sakeenah's shared iOS-style line spinner.
 * The animation follows the supplied HTML reference: 12 radial bars
 * with staggered opacity rather than a rotating border ring.
 */
export default function SakeenahLineSpinner({
  size = 32,
  color = "#b88a4f",
  duration = "1s",
  label = "جارٍ التحميل",
  className = "",
}: SakeenahLineSpinnerProps) {
  const barHeight = Math.max(4, Math.round(size * 0.16));
  const barWidth = Math.max(1, Math.round(size * 0.045));
  const radius = `calc(${size}px / 2 - ${barHeight}px / 2 - ${Math.max(1, Math.round(size * 0.1))}px)`;

  return (
    <span
      role="status"
      aria-label={label}
      className={`sakeenah-line-spinner ${className}`.trim()}
      style={
        {
          "--sakeenah-spinner-size": `${size}px`,
          "--sakeenah-spinner-color": color,
          "--sakeenah-spinner-duration": duration,
          "--sakeenah-spinner-bar-width": `${barWidth}px`,
          "--sakeenah-spinner-bar-height": `${barHeight}px`,
          "--sakeenah-spinner-radius": radius,
        } as React.CSSProperties
      }
    >
      {BAR_INDICES.map((index) => (
        <span
          key={index}
          className="sakeenah-line-spinner__bar"
          style={{ "--sakeenah-spinner-index": index } as React.CSSProperties}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

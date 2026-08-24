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
  size = 40,
  color = "#555555",
  duration = "1s",
  label = "جارٍ التحميل",
  className = "",
}: SakeenahLineSpinnerProps) {
  // These values intentionally stay identical to the supplied HTML reference.
  // Only the outer diameter, color, and duration are configurable.
  const barWidth = 2;
  const barHeight = 8;
  const barRadius = 1;
  const radius = `calc(${size}px / 2 - ${barHeight}px / 2 - 2px)`;

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
          "--sakeenah-spinner-bar-radius": `${barRadius}px`,
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

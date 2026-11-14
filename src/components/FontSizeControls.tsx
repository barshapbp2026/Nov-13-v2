import React from 'react';
import { useFontSize } from '../context/FontSizeContext';

interface FontSizeControlsProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export const FontSizeControls: React.FC<FontSizeControlsProps> = ({
  variant = 'light',
  className = '',
}) => {
  const { fontPercent, increaseFontSize, decreaseFontSize, canIncrease, canDecrease } = useFontSize();

  const containerStyle =
    variant === 'dark'
      ? 'bg-slate-800/90 border-slate-700 text-slate-200'
      : 'bg-slate-100 border-slate-200 text-slate-700';

  const btnStyle =
    variant === 'dark'
      ? 'hover:bg-slate-700 hover:text-white disabled:opacity-35'
      : 'hover:bg-slate-200 hover:text-slate-900 disabled:opacity-35';

  const dividerStyle = variant === 'dark' ? 'border-slate-700' : 'border-slate-200';

  return (
    <div
      className={`inline-flex items-center rounded-md border overflow-hidden shrink-0 select-none ${containerStyle} ${className}`}
      role="group"
      aria-label="Text size controls"
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          increaseFontSize();
        }}
        disabled={!canIncrease}
        className={`px-1.5 py-1 text-[11px] font-bold leading-none transition-colors cursor-pointer disabled:cursor-not-allowed border-r ${dividerStyle} ${btnStyle}`}
        title={`अक्षर ठूलो बनाउनुहोस् (A+) · ${fontPercent}%`}
        aria-label="Increase font size"
      >
        A+
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          decreaseFontSize();
        }}
        disabled={!canDecrease}
        className={`px-1.5 py-1 text-[11px] font-bold leading-none transition-colors cursor-pointer disabled:cursor-not-allowed ${btnStyle}`}
        title={`अक्षर सानो बनाउनुहोस् (A-) · ${fontPercent}%`}
        aria-label="Decrease font size"
      >
        A-
      </button>
    </div>
  );
};

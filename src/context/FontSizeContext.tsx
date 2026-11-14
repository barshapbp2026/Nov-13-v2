import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nepal_legal_font_percent';
const MIN_FONT_PERCENT = 80;
const MAX_FONT_PERCENT = 170;
const FONT_STEP = 10;
const DEFAULT_FONT_PERCENT = 100;

interface FontSizeContextValue {
  fontPercent: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

const FontSizeContext = createContext<FontSizeContextValue>({
  fontPercent: DEFAULT_FONT_PERCENT,
  increaseFontSize: () => {},
  decreaseFontSize: () => {},
  resetFontSize: () => {},
  canIncrease: true,
  canDecrease: true,
});

function loadInitialFontPercent(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FONT_PERCENT;
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_FONT_PERCENT && parsed <= MAX_FONT_PERCENT) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_FONT_PERCENT;
}

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontPercent, setFontPercent] = useState<number>(loadInitialFontPercent);

  useEffect(() => {
    const rootPx = (fontPercent / 100) * 16;
    document.documentElement.style.fontSize = `${rootPx}px`;
    try {
      localStorage.setItem(STORAGE_KEY, String(fontPercent));
    } catch {
      // ignore storage errors
    }
  }, [fontPercent]);

  const increaseFontSize = useCallback(() => {
    setFontPercent(prev => Math.min(MAX_FONT_PERCENT, prev + FONT_STEP));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontPercent(prev => Math.max(MIN_FONT_PERCENT, prev - FONT_STEP));
  }, []);

  const resetFontSize = useCallback(() => {
    setFontPercent(DEFAULT_FONT_PERCENT);
  }, []);

  return (
    <FontSizeContext.Provider
      value={{
        fontPercent,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        canIncrease: fontPercent < MAX_FONT_PERCENT,
        canDecrease: fontPercent > MIN_FONT_PERCENT,
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
};

export function useFontSize(): FontSizeContextValue {
  return useContext(FontSizeContext);
}

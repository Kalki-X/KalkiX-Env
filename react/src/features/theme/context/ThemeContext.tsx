import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

interface ThemeContextValue {
    /** What the user picked: an explicit mode, or "system" to follow the OS setting. */
    mode: ThemeMode;
    /** What's actually applied right now ("system" resolved against the OS preference). */
    resolvedMode: ResolvedThemeMode;
    setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'gs-theme-mode';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredMode(): ThemeMode {
    if (typeof window === 'undefined') return 'system';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Site-wide light/dark/system theme. "system" (the default for anyone who hasn't
 * picked explicitly) tracks the OS preference live — if the user's system switches
 * theme while the app is open, this follows along without a reload. Applies
 * `data-theme="light"|"dark"` on <html>, which drives both the CSS custom properties
 * in styles/main.css and (via main.tsx) antd's ConfigProvider algorithm.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
    const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const resolvedMode: ResolvedThemeMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedMode);
    }, [resolvedMode]);

    const setMode = (next: ThemeMode) => {
        setModeState(next);
        window.localStorage.setItem(STORAGE_KEY, next);
    };

    const value = useMemo(() => ({ mode, resolvedMode, setMode }), [mode, resolvedMode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider');
    return ctx;
}

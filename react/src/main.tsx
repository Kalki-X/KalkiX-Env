import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import "antd/dist/reset.css";

import { ConfigProvider, theme as antdTheme } from "antd";
import { ThemeProvider, useThemeMode } from "./features/theme/context/ThemeContext";

// Bridges the app's own light/dark/system ThemeContext into antd's ConfigProvider —
// has to be a component (not inline in the render call below) since it needs the
// useThemeMode() hook, which only works inside <ThemeProvider>.
function ThemedApp() {
    const { resolvedMode } = useThemeMode();
    const isDark = resolvedMode === "dark";

    return (
        <ConfigProvider
            theme={{
                algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    colorPrimary: "#2B2E4A",
                    colorInfo: "#5D79BB",
                    borderRadius: 8,
                    colorText: isDark ? "#e2e8f0" : "#1e293b",
                    // NOTE: these must be real color values antd's token-derivation math can
                    // parse (it computes colorBgContainer/colorBgElevated/etc. from this) —
                    // a CSS var() reference can't be resolved here (that only happens later,
                    // in the browser, when the var is used directly in a stylesheet), and
                    // silently breaks every derived background token, which is what made
                    // every Card/Table go solid black. Keep this in sync with
                    // --color-background's light-mode value in styles/main.css.
                    colorBgBase: isDark ? "#0f172a" : "#E7EEF7",
                },
            }}
        >
            <App />
        </ConfigProvider>
    );
}

ReactDOM.createRoot(
    document.getElementById("root")!
).render(
    <React.StrictMode>
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    </React.StrictMode>
);

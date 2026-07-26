import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import "antd/dist/reset.css";


import { ConfigProvider } from "antd";


ReactDOM.createRoot(
    document.getElementById("root")!
).render(
    <React.StrictMode>
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: "#2B2E4A",
                    colorInfo: "#5D79BB",
                    borderRadius: 8,
                    colorText: "#1e293b",
                    colorBgBase: "#E7EEF7",
                },
            }}
        >
            <App />
        </ConfigProvider>
    </React.StrictMode>
);
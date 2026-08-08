import { apiClient } from "../../../services/api/client";

// Infrastructure/system diagnostics — Super Admin only. Mirrors
// nodejs/src/routes/adminSystem.routes.js. The DB password is never part of this
// shape (and never sent by the server at all) — only host/port/database name and a
// masked username, purely for "is this pointed at the right database" sanity checks.

export interface DatabaseInfo {
    host: string | null;
    port: number | null;
    database: string | null;
    username: string | null;
    ssl: boolean;
    parseError?: boolean;
}

export interface SystemInfo {
    database: DatabaseInfo;
    pool: {
        totalCount: number;
        idleCount: number;
        waitingCount: number;
    };
    server: {
        nodeVersion: string;
        platform: string;
        environment: string;
        uptimeSeconds: number;
    };
}

export async function getSystemInfo(): Promise<SystemInfo> {
    const { data } = await apiClient.get("/api/admin/system/info");
    return data.system as SystemInfo;
}

export interface TestConnectionResult {
    ok: boolean;
    latencyMs: number;
    error?: string;
}

export async function testDatabaseConnection(): Promise<TestConnectionResult> {
    const { data } = await apiClient.post("/api/admin/system/test-connection");
    return data as TestConnectionResult;
}

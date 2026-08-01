import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
    AuthUser,
    LoginPayload,
    RegisterPayload,
    fetchCurrentUser,
    loginUser,
    logoutUser,
    registerUser,
} from "../api/authApi";

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    login: (payload: LoginPayload) => Promise<AuthUser>;
    register: (payload: RegisterPayload) => Promise<AuthUser>;
    logout: () => Promise<void>;
    /** Re-reads the current user from the auth cookie — used after a redirect-based
     *  flow (Google sign-in) where we can't get the user back as a direct call result. */
    refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetchCurrentUser().then((u) => {
            if (!cancelled) {
                setUser(u);
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (payload: LoginPayload) => {
        const loggedInUser = await loginUser(payload);
        setUser(loggedInUser);
        return loggedInUser;
    }, []);

    const register = useCallback(async (payload: RegisterPayload) => {
        const newUser = await registerUser(payload);
        setUser(newUser);
        return newUser;
    }, []);

    const logout = useCallback(async () => {
        await logoutUser();
        setUser(null);
    }, []);

    const refresh = useCallback(async () => {
        const refreshedUser = await fetchCurrentUser();
        setUser(refreshedUser);
        return refreshedUser;
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, register, logout, refresh }),
        [user, loading, login, register, logout, refresh]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
}

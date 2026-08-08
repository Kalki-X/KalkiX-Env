import React, { useEffect, useState } from 'react';
import { Alert, Space } from 'antd';
import { getPublicNotices, SiteNotice } from '../../features/siteContent/api/siteContentApi';

// Renders every currently-active site notice as a dismissible banner. Used on both the
// public homepage (logged-out visitors) and inside DashboardLayout (logged-in platform
// users) — the underlying endpoint is public either way, so this is one shared
// component rather than two copies.
//
// Dismissal is per-browser-tab-session (sessionStorage), not permanent: closing one
// clears it for the rest of this session but it comes back on a fresh visit, which
// matches how a real announcement banner should behave (an admin posting an urgent
// notice shouldn't have it stay hidden forever just because someone dismissed a
// different, older one weeks ago).

const SEVERITY_TO_ANTD: Record<SiteNotice['severity'], 'info' | 'warning' | 'error'> = {
    info: 'info',
    warning: 'warning',
    critical: 'error',
};

const DISMISSED_KEY = 'gs-dismissed-notices';

function getDismissedIds(): number[] {
    try {
        const raw = sessionStorage.getItem(DISMISSED_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persistDismissedId(id: number) {
    try {
        const dismissed = getDismissedIds();
        if (!dismissed.includes(id)) {
            sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, id]));
        }
    } catch {
        // sessionStorage unavailable (e.g. private browsing edge cases) — dismissal
        // just won't persist across re-renders; not worth failing over.
    }
}

export default function SiteNoticeBanner({
    style,
    audience,
}: {
    style?: React.CSSProperties;
    // "public" on the logged-out homepage, "platform_users" inside the authenticated
    // dashboard shell — determines which notices are fetched (a notice targeted at
    // "both" always comes back regardless of which one is passed).
    audience: 'public' | 'platform_users';
}) {
    const [notices, setNotices] = useState<SiteNotice[]>([]);
    const [dismissedIds, setDismissedIds] = useState<number[]>([]);

    useEffect(() => {
        setDismissedIds(getDismissedIds());
        getPublicNotices(audience)
            .then(setNotices)
            .catch(() => {});
    }, [audience]);

    const visible = notices.filter((n) => !dismissedIds.includes(n.id));
    if (visible.length === 0) return null;

    return (
        <Space direction="vertical" size={8} style={{ width: '100%', ...style }}>
            {visible.map((notice) => (
                <Alert
                    key={notice.id}
                    type={SEVERITY_TO_ANTD[notice.severity]}
                    message={notice.message}
                    showIcon
                    closable
                    onClose={() => {
                        persistDismissedId(notice.id);
                        setDismissedIds((prev) => [...prev, notice.id]);
                    }}
                />
            ))}
        </Space>
    );
}

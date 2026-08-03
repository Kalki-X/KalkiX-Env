import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Popover, List, Button, Typography, Empty, Spin } from "antd";
import { BellOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
    AppNotification,
    listNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
} from "../../features/notifications/api/notificationsApi";

dayjs.extend(relativeTime);

const { Text } = Typography;

// A background poll, not a live push — good enough for "did something happen since I
// last looked" without adding a websocket/SSE layer for what's still a fairly low-volume
// event stream (booking lifecycle events).
const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const refreshUnreadCount = async () => {
        try {
            setUnreadCount(await getUnreadCount());
        } catch {
            // A failed background poll shouldn't be disruptive — just try again next tick.
        }
    };

    const refreshList = async () => {
        setLoading(true);
        try {
            const res = await listNotifications({ pageSize: 8 });
            setNotifications(res.notifications);
            setUnreadCount(res.unreadCount);
        } catch {
            // silent — the bell just stays at its last-known state
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUnreadCount();
        const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const onOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) refreshList();
    };

    const onClickNotification = (n: AppNotification) => {
        setOpen(false);
        if (!n.readAt) {
            markNotificationRead(n.id).catch(() => {});
            setUnreadCount((c) => Math.max(0, c - 1));
        }
        if (n.link) navigate(n.link);
    };

    const onMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications((list) => list.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
            setUnreadCount(0);
        } catch {
            // silent
        }
    };

    const content = (
        <div style={{ width: 340 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text strong>Notifications</Text>
                {unreadCount > 0 && (
                    <Button type="link" size="small" onClick={onMarkAllRead} style={{ padding: 0 }}>
                        Mark all as read
                    </Button>
                )}
            </div>
            {loading ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                    <Spin size="small" />
                </div>
            ) : notifications.length === 0 ? (
                <Empty description="No notifications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: "16px 0" }} />
            ) : (
                <List
                    size="small"
                    dataSource={notifications}
                    renderItem={(n) => (
                        <List.Item
                            onClick={() => onClickNotification(n)}
                            style={{
                                cursor: "pointer",
                                background: n.readAt ? undefined : "#eef3fb",
                                borderRadius: 6,
                                padding: "8px 10px",
                                marginBottom: 4,
                                border: "none",
                            }}
                        >
                            <div style={{ width: "100%" }}>
                                <Text strong={!n.readAt} style={{ display: "block", fontSize: 13 }}>
                                    {n.title}
                                </Text>
                                {n.body && <Text style={{ display: "block", fontSize: 12, color: "#64748b" }}>{n.body}</Text>}
                                <Text style={{ fontSize: 11, color: "#94a3b8" }}>{dayjs(n.createdAt).fromNow()}</Text>
                            </div>
                        </List.Item>
                    )}
                />
            )}
            <div style={{ borderTop: "1px solid #eef2f7", marginTop: 8, paddingTop: 8, textAlign: "center" }}>
                <Button
                    type="link"
                    size="small"
                    onClick={() => {
                        setOpen(false);
                        navigate("/notifications");
                    }}
                >
                    View all
                </Button>
            </div>
        </div>
    );

    return (
        <Popover content={content} trigger="click" open={open} onOpenChange={onOpenChange} placement="bottomRight">
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
            </Badge>
        </Popover>
    );
}

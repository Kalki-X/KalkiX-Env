import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, List, Button, Space, Alert, Tag, Empty, Pagination } from "antd";
import dayjs from "dayjs";
import {
    AppNotification,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../features/notifications/api/notificationsApi";
import { getApiErrorMessage } from "../services/api/client";

const { Title, Paragraph, Text } = Typography;
const PAGE_SIZE = 20;

export default function Notifications() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const load = async (targetPage = page) => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const res = await listNotifications({ page: targetPage, pageSize: PAGE_SIZE });
            setNotifications(res.notifications);
            setTotal(res.total);
            setUnreadCount(res.unreadCount);
            setPage(res.page);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not load notifications."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onClick = async (n: AppNotification) => {
        if (!n.readAt) {
            try {
                await markNotificationRead(n.id);
                setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
                setUnreadCount((c) => Math.max(0, c - 1));
            } catch {
                // non-fatal — still navigate even if marking read failed
            }
        }
        if (n.link) navigate(n.link);
    };

    const onMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications((list) => list.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
            setUnreadCount(0);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not mark notifications as read."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                    <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                        Notifications
                    </Title>
                    <Paragraph style={{ color: "var(--color-muted)", marginBottom: 0 }}>
                        Booking requests, approvals, rejections, payments, and cancellations — all in one place.
                    </Paragraph>
                </div>
                {unreadCount > 0 && <Button onClick={onMarkAllRead}>Mark all as read ({unreadCount})</Button>}
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            {notifications.length === 0 && !loading ? (
                <Empty description="No notifications yet" />
            ) : (
                <List
                    loading={loading}
                    dataSource={notifications}
                    renderItem={(n) => (
                        <List.Item
                            onClick={() => onClick(n)}
                            style={{
                                cursor: "pointer",
                                background: n.readAt ? "#fff" : "#eef3fb",
                                borderRadius: 8,
                                padding: "12px 16px",
                                marginBottom: 8,
                                border: "1px solid #e2e8f0",
                            }}
                        >
                            <Space direction="vertical" size={2} style={{ width: "100%" }}>
                                <Space>
                                    <Text strong={!n.readAt}>{n.title}</Text>
                                    {!n.readAt && <Tag color="blue">New</Tag>}
                                </Space>
                                {n.body && <Text style={{ color: "var(--color-muted)" }}>{n.body}</Text>}
                                <Text style={{ fontSize: 12, color: "#94a3b8" }}>
                                    {dayjs(n.createdAt).format("DD MMM YYYY, HH:mm")}
                                </Text>
                            </Space>
                        </List.Item>
                    )}
                />
            )}

            {total > PAGE_SIZE && (
                <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={(p) => load(p)} align="center" />
            )}
        </Space>
    );
}

import React, { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Layout, Space, Tag, Typography, Button, Avatar, Menu, Grid, Drawer } from "antd";
import { LogoutOutlined, ShopOutlined, UserOutlined, MenuOutlined, DashboardOutlined, ArrowLeftOutlined, BellOutlined } from "@ant-design/icons";
import { useAuth } from "../features/auth/context/AuthContext";
import { userAvatarUrl } from "../features/auth/api/authApi";
import { resolveHomeRoute } from "../features/auth/utils/resolveHomeRoute";
import NotificationBell from "../components/NotificationBell/NotificationBell";
import SiteLogoBadge from "../components/SiteLogoBadge/SiteLogoBadge";
import ThemeToggle from "../components/ThemeToggle/ThemeToggle";
import SiteNoticeBanner from "../components/SiteNoticeBanner/SiteNoticeBanner";

export interface DashboardNavItem {
    key: string;
    label: string;
    path: string;
}

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

const ROLE_LABEL: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    support: "Support",
    finance: "Finance",
    platform_user: "Platform User",
};

const ROLE_COLOR: Record<string, string> = {
    super_admin: "gold",
    admin: "blue",
    support: "cyan",
    finance: "green",
    platform_user: "default",
};

/**
 * Shared shell for every role dashboard (/admin, /staff, /finance, /lender, /renter).
 * Header (identity + logout) + an optional section nav (once a role has more than
 * one page, e.g. Super Admin's Users/Documents/Audit/Reports/Payments/Errors) + outlet.
 * Below the `lg` breakpoint everything but the title collapses into a burger + side
 * drawer, matching the pattern already used on the public Home page.
 */
export default function DashboardLayout({ title, navItems }: { title: string; navItems?: DashboardNavItem[] }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const screens = useBreakpoint();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const isMobileOrTablet = !screens.lg;

    const handleLogout = async () => {
        setDrawerOpen(false);
        await logout();
        navigate("/login");
    };

    const goTo = (path: string) => {
        setDrawerOpen(false);
        navigate(path);
    };

    const showRoleSwitcher = user?.role === "platform_user" && user.isRenter && user.isLender;
    const selectedNavKey = navItems?.find((item) => item.path === location.pathname)?.key ?? navItems?.[0]?.key;
    // Every page under DashboardLayout needs an obvious way back to the user's own
    // dashboard — pages with no navItems (like /profile) or several hops deep (like
    // editing a single listing) previously only offered "View marketplace", which
    // isn't the same thing and left people stuck.
    const homeRoute = user ? resolveHomeRoute(user) : "/";
    // Same idea, one level down: any sub-page under a role's section nav (Super Admin's
    // User Management, Audit Trail, Sales Reports, etc.) gets an explicit "back to
    // overview" link automatically, instead of relying on people noticing the section
    // nav bar is also clickable.
    const overviewItem = navItems?.[0];
    const onOverviewPage = overviewItem && location.pathname === overviewItem.path;

    const identity = user && (
        <Space
            size="small"
            align="center"
            style={{ cursor: "pointer" }}
            onClick={() => goTo("/profile")}
            title="Edit your profile"
        >
            <Avatar size="small" icon={<UserOutlined />} src={user.hasAvatar ? userAvatarUrl(user.id) : undefined} />
            <Text style={{ color: "var(--gs-heading)" }}>
                {user.firstName} {user.lastName}
            </Text>
            <Tag color={ROLE_COLOR[user.role]}>{ROLE_LABEL[user.role] ?? user.role}</Tag>
        </Space>
    );

    return (
        <Layout style={{ minHeight: "100vh", background: "var(--color-background)" }}>
            <Header
                style={{
                    background: "var(--gs-surface)",
                    borderBottom: "1px solid var(--gs-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isMobileOrTablet ? "0 16px" : "0 24px",
                    height: 64,
                }}
            >
                <Space size="middle" align="center">
                    <SiteLogoBadge size={32} borderRadius={9} fallbackFontSize={13} />
                    <Title level={4} style={{ margin: 0, color: "var(--gs-heading)" }}>
                        GearShare
                    </Title>
                    {!isMobileOrTablet && (
                        <>
                            <Text style={{ color: "#94a3b8" }}>/</Text>
                            <Text style={{ color: "var(--gs-heading)", fontWeight: 600 }}>{title}</Text>
                        </>
                    )}
                </Space>

                {isMobileOrTablet ? (
                    <Space size="small" align="center">
                        <NotificationBell />
                        <Button
                            type="text"
                            icon={<MenuOutlined style={{ fontSize: 22, color: "var(--gs-heading)" }} />}
                            onClick={() => setDrawerOpen(true)}
                        />
                    </Space>
                ) : (
                    <Space size="middle" align="center">
                        {showRoleSwitcher && (
                            <Space.Compact>
                                <Button type={title === "Renter" ? "primary" : "default"} onClick={() => goTo("/renter")}>
                                    Renter view
                                </Button>
                                <Button type={title === "Lender" ? "primary" : "default"} onClick={() => goTo("/lender")}>
                                    Lender view
                                </Button>
                            </Space.Compact>
                        )}

                        <Button type="text" icon={<DashboardOutlined />} onClick={() => goTo(homeRoute)}>
                            Dashboard
                        </Button>

                        <Button type="text" icon={<ShopOutlined />} onClick={() => goTo("/")}>
                            View marketplace
                        </Button>

                        <ThemeToggle />

                        <NotificationBell />

                        {identity}

                        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                            Logout
                        </Button>
                    </Space>
                )}
            </Header>

            {!isMobileOrTablet && navItems && navItems.length > 0 && (
                <Menu
                    mode="horizontal"
                    selectedKeys={selectedNavKey ? [selectedNavKey] : []}
                    style={{ borderBottom: "1px solid var(--gs-border)", paddingLeft: 24 }}
                    items={navItems.map((item) => ({
                        key: item.key,
                        label: <Link to={item.path}>{item.label}</Link>,
                    }))}
                />
            )}

            <Drawer title={title} placement="right" onClose={() => setDrawerOpen(false)} open={drawerOpen} width={300}>
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    {identity}

                    {showRoleSwitcher && (
                        <Space.Compact block>
                            <Button block type={title === "Renter" ? "primary" : "default"} onClick={() => goTo("/renter")}>
                                Renter view
                            </Button>
                            <Button block type={title === "Lender" ? "primary" : "default"} onClick={() => goTo("/lender")}>
                                Lender view
                            </Button>
                        </Space.Compact>
                    )}

                    {navItems && navItems.length > 0 && (
                        <div style={{ borderTop: "1px solid var(--gs-border)", paddingTop: 12 }}>
                            <Space direction="vertical" size="small" style={{ width: "100%" }}>
                                {navItems.map((item) => (
                                    <Button
                                        key={item.key}
                                        type={item.key === selectedNavKey ? "primary" : "text"}
                                        block
                                        style={{ textAlign: "left" }}
                                        onClick={() => goTo(item.path)}
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </Space>
                        </div>
                    )}

                    <div style={{ borderTop: "1px solid var(--gs-border)", paddingTop: 12 }}>
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            <ThemeToggle block />
                            <Button block type="text" style={{ textAlign: "left" }} icon={<DashboardOutlined />} onClick={() => goTo(homeRoute)}>
                                Dashboard
                            </Button>
                            <Button block type="text" style={{ textAlign: "left" }} icon={<BellOutlined />} onClick={() => goTo("/notifications")}>
                                Notifications
                            </Button>
                            <Button block type="text" style={{ textAlign: "left" }} icon={<ShopOutlined />} onClick={() => goTo("/")}>
                                View marketplace
                            </Button>
                            <Button block icon={<LogoutOutlined />} onClick={handleLogout}>
                                Logout
                            </Button>
                        </Space>
                    </div>
                </Space>
            </Drawer>

            <Content style={{ padding: isMobileOrTablet ? 16 : 32 }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <SiteNoticeBanner audience="platform_users" style={{ marginBottom: 20 }} />
                    {overviewItem && !onOverviewPage && (
                        <Button
                            type="link"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => goTo(overviewItem.path)}
                            style={{ paddingLeft: 0, marginBottom: 8 }}
                        >
                            Back to {overviewItem.label}
                        </Button>
                    )}
                    <Outlet />
                </div>
            </Content>
        </Layout>
    );
}

import React, { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Layout, Space, Tag, Typography, Button, Avatar, Menu, Grid, Drawer } from "antd";
import { LogoutOutlined, ShopOutlined, UserOutlined, MenuOutlined } from "@ant-design/icons";
import { useAuth } from "../features/auth/context/AuthContext";

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

    const identity = user && (
        <Space size="small" align="center">
            <Avatar size="small" icon={<UserOutlined />} />
            <Text style={{ color: "#2B2E4A" }}>
                {user.firstName} {user.lastName}
            </Text>
            <Tag color={ROLE_COLOR[user.role]}>{ROLE_LABEL[user.role] ?? user.role}</Tag>
        </Space>
    );

    return (
        <Layout style={{ minHeight: "100vh", background: "#E7EEF7" }}>
            <Header
                style={{
                    background: "#fff",
                    borderBottom: "1px solid #d9e1f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isMobileOrTablet ? "0 16px" : "0 24px",
                    height: 64,
                }}
            >
                <Space size="middle" align="center">
                    <Title level={4} style={{ margin: 0, color: "#2B2E4A" }}>
                        GearShare
                    </Title>
                    {!isMobileOrTablet && (
                        <>
                            <Text style={{ color: "#94a3b8" }}>/</Text>
                            <Text style={{ color: "#2B2E4A", fontWeight: 600 }}>{title}</Text>
                        </>
                    )}
                </Space>

                {isMobileOrTablet ? (
                    <Button
                        type="text"
                        icon={<MenuOutlined style={{ fontSize: 22, color: "#2B2E4A" }} />}
                        onClick={() => setDrawerOpen(true)}
                    />
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

                        <Button type="text" icon={<ShopOutlined />} onClick={() => goTo("/")}>
                            View marketplace
                        </Button>

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
                    style={{ borderBottom: "1px solid #d9e1f2", paddingLeft: 24 }}
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
                        <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
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

                    <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
                        <Space direction="vertical" size="small" style={{ width: "100%" }}>
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
                    <Outlet />
                </div>
            </Content>
        </Layout>
    );
}

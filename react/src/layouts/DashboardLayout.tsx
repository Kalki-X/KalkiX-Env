import React from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Layout, Space, Tag, Typography, Button, Avatar, Menu } from "antd";
import { LogoutOutlined, ShopOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "../features/auth/context/AuthContext";

export interface DashboardNavItem {
    key: string;
    label: string;
    path: string;
}

const { Header, Content } = Layout;
const { Text, Title } = Typography;

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
 */
export default function DashboardLayout({ title, navItems }: { title: string; navItems?: DashboardNavItem[] }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <Layout style={{ minHeight: "100vh", background: "#E7EEF7" }}>
            <Header
                style={{
                    background: "#fff",
                    borderBottom: "1px solid #d9e1f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 24px",
                    height: 64,
                }}
            >
                <Space size="middle" align="center">
                    <Title level={4} style={{ margin: 0, color: "#2B2E4A" }}>
                        GearShare
                    </Title>
                    <Text style={{ color: "#94a3b8" }}>/</Text>
                    <Text style={{ color: "#2B2E4A", fontWeight: 600 }}>{title}</Text>
                </Space>

                <Space size="middle" align="center">
                    {user?.role === "platform_user" && user.isRenter && user.isLender && (
                        <Space.Compact>
                            <Button
                                type={title === "Renter" ? "primary" : "default"}
                                onClick={() => navigate("/renter")}
                            >
                                Renter view
                            </Button>
                            <Button
                                type={title === "Lender" ? "primary" : "default"}
                                onClick={() => navigate("/lender")}
                            >
                                Lender view
                            </Button>
                        </Space.Compact>
                    )}

                    <Button type="text" icon={<ShopOutlined />} onClick={() => navigate("/")}>
                        View marketplace
                    </Button>

                    {user && (
                        <Space size="small" align="center">
                            <Avatar size="small" icon={<UserOutlined />} />
                            <Text style={{ color: "#2B2E4A" }}>
                                {user.firstName} {user.lastName}
                            </Text>
                            <Tag color={ROLE_COLOR[user.role]}>{ROLE_LABEL[user.role] ?? user.role}</Tag>
                        </Space>
                    )}

                    <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                        Logout
                    </Button>
                </Space>
            </Header>

            {navItems && navItems.length > 0 && (
                <Menu
                    mode="horizontal"
                    selectedKeys={[
                        navItems.find((item) => item.path === location.pathname)?.key ?? navItems[0].key,
                    ]}
                    style={{ borderBottom: "1px solid #d9e1f2", paddingLeft: 24 }}
                    items={navItems.map((item) => ({
                        key: item.key,
                        label: <Link to={item.path}>{item.label}</Link>,
                    }))}
                />
            )}

            <Content style={{ padding: 32 }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <Outlet />
                </div>
            </Content>
        </Layout>
    );
}

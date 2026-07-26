import React, { useState } from 'react';
import {
    Layout,
    Input,
    Button,
    Space,
    Badge,
    Typography,
    Grid,
    Drawer,
} from 'antd';
import {
    SearchOutlined,
    ShoppingCartOutlined,
    MenuOutlined,
} from '@ant-design/icons';
import HeaderCSS from './header.module.css';
import logoGS from '../../assets/logo.png';

const { Header } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

const PageHeader = () => {

    const [drawerOpen, setDrawerOpen] = useState(false);
    const screens = useBreakpoint();

    const isMobileOrTablet = !screens.lg;

    return (
        <Layout style={{ minHeight: '100vh', background: '#E7EEF7' }}>
            <Header className={HeaderCSS.header} style={{ padding: isMobileOrTablet ? '0 16px' : '0 32px' }}>

                <div className={HeaderCSS.headerDiv}>

                    {/* Logo */}
                    <div className={HeaderCSS.logoContainer} style={{ minWidth: isMobileOrTablet ? 'auto' : 180 }}>

                        <img src={logoGS} alt="GearShare logo" className={HeaderCSS.logoImage} />

                        <div className={HeaderCSS.logoTextContainer}>

                            <Text className={HeaderCSS.logoText}> GearShare </Text>
                            {!isMobileOrTablet && (
                                <Text className={HeaderCSS.logoTagLine}> Rent smarter </Text>
                            )}

                        </div>

                    </div>

                    {/* Search */}
                    <div className={HeaderCSS.headerSearchContainer} style={{ maxWidth: isMobileOrTablet ? '100%' : 560 }}>
                        <Input
                            size="large"
                            placeholder="Search for cameras, tools, speakers..."
                            prefix={<SearchOutlined style={{ color: '#64748b' }} />}
                            className={HeaderCSS.headerSearch}
                        />
                    </div>

                    {/* Desktop actions */}
                    {!isMobileOrTablet && (
                        <Space size="middle" align="center">
                            <Button type="text" className={HeaderCSS.lenderButton}>
                                Become a lender
                            </Button>

                            <span className={HeaderCSS.spanBar}>|</span>

                            <Button type="primary" shape="round" className={HeaderCSS.renterButton}>
                                Start Renting
                            </Button>

                            <Badge count={2} size="small">
                                <Button shape="circle" icon={<ShoppingCartOutlined />} size="large" />
                            </Badge>
                        </Space>
                    )}

                    {/* Mobile / tablet burger */}
                    {isMobileOrTablet && (
                        <Button
                            type="text"
                            icon={<MenuOutlined style={{ fontSize: 22, color: '#2B2E4A' }} />}
                            onClick={() => setDrawerOpen(true)}
                            className={HeaderCSS.burger}
                        />
                    )}
                </div>
            </Header>

            {/* Drawer for small / medium screens */}
            <Drawer
                title="Menu"
                placement="right"
                onClose={() => setDrawerOpen(false)}
                open={drawerOpen}
                size={320}
            >
                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Button type="text" block style={{ textAlign: 'left', height: 42 }}>
                        Become a lender
                    </Button>

                    <Button
                        type="primary"
                        block
                        shape="round"
                        style={{
                            background: '#2B2E4A',
                            borderColor: '#2B2E4A',
                            fontWeight: 600,
                        }}
                    >
                        Start Renting
                    </Button>

                    <Button
                        block
                        icon={<ShoppingCartOutlined />}
                        style={{ textAlign: 'left', height: 42 }}
                    >
                        Cart
                    </Button>

                    <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 12 }}>
                        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                            <Button type="text" block style={{ textAlign: 'left' }}>
                                Categories
                            </Button>
                            <Button type="text" block style={{ textAlign: 'left' }}>
                                How it works
                            </Button>
                            <Button type="text" block style={{ textAlign: 'left' }}>
                                Pricing
                            </Button>
                            <Button type="text" block style={{ textAlign: 'left' }}>
                                Community
                            </Button>
                        </Space>
                    </div>
                </Space>
            </Drawer>

        </Layout>
    );
};

export default PageHeader;

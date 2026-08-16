import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext';
import { resolveHomeRoute } from '../features/auth/utils/resolveHomeRoute';
import {
    getPublicCategories,
    getPublicCarousel,
    getTrendingItems,
    getPublicSections,
    categoryIconUrl,
    carouselImageUrl,
    sectionImageUrl,
    PublicCategory,
    CarouselSlide,
    TrendingItem,
    HomepageSection,
} from '../features/siteContent/api/siteContentApi';
import { itemImageUrl } from '../features/listings/api/listingsApi';
import SiteLogoBadge from '../components/SiteLogoBadge/SiteLogoBadge';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import SiteNoticeBanner from '../components/SiteNoticeBanner/SiteNoticeBanner';
import {
    Layout,
    Input,
    Button,
    Carousel,
    Row,
    Col,
    Space,
    Typography,
    Card,
    Segmented,
    Rate,
    Grid,
    Drawer,
} from 'antd';
import {
    SearchOutlined,
    CameraOutlined,
    ToolOutlined,
    SkinOutlined,
    HeartOutlined,
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    DollarOutlined,
    CheckCircleOutlined,
    GlobalOutlined,
    MenuOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph, Link } = Typography;
const { useBreakpoint } = Grid;

const renterSteps = [
    {
        id: 1,
        title: 'Explore Items',
        description:
            'Search great listings from people in your community and discover what fits your needs.',
    },
    {
        id: 2,
        title: 'Book your rental',
        description:
            'Select your dates, confirm availability, and message the owner to coordinate pickup or delivery.',
    },
    {
        id: 3,
        title: 'Experience more',
        description:
            'Enjoy your rental and return it when you are done. It is simple, flexible, and affordable.',
    },
];

const ownerSteps = [
    {
        id: 1,
        title: 'List your item',
        description:
            'Create a listing with photos, pricing, availability, and clear rental terms in just a few steps.',
    },
    {
        id: 2,
        title: 'Accept bookings',
        description:
            'Receive requests, review renters, and confirm bookings based on your schedule and preferences.',
    },
    {
        id: 3,
        title: 'Earn with confidence',
        description:
            'Share your unused items, generate extra income, and manage rentals through a smooth workflow.',
    },
];

// Fallback content, shown only until an admin configures real categories/trending
// items/carousel slides via Super Admin > Homepage — so a fresh deployment never
// looks broken or empty.
const DEFAULT_CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'Baby & Kids': <SkinOutlined />,
    Bikes: <ThunderboltOutlined />,
    Medical: <HeartOutlined />,
    Tools: <ToolOutlined />,
    Fitness: <CameraOutlined />,
};
const DEFAULT_CATEGORIES = Object.keys(DEFAULT_CATEGORY_ICONS).map((title) => ({ title, icon: DEFAULT_CATEGORY_ICONS[title] }));

const DEFAULT_TRENDING = [
    { title: 'Sony ZV1', booked: '30 booked this month' },
    { title: 'PS5 Set', booked: '15 booked this month' },
    { title: 'Screwdriver Makita', booked: '10 booked this month' },
];

const confidenceItems = [
    {
        title: 'Fast payouts',
        description:
            'All payments are easy, secure, and automatically deposited into your account.',
        icon: <DollarOutlined />,
    },
    {
        title: 'Verified renters',
        description:
            'Our verification process checks multiple factors to help confirm renter identity and build trust.',
        icon: <SafetyCertificateOutlined />,
    },
    {
        title: 'Hassle-free contracts',
        description:
            'Clear terms and platform rules help make each rental smoother with less paperwork and less stress.',
        icon: <CheckCircleOutlined />,
    },
];

const benefits = [
    {
        title: 'Good for our Planet',
        description:
            'Reduce waste, cut down on landfill, and lower your carbon footprint by renting instead of buying.',
        icon: <GlobalOutlined />,
    },
    {
        title: 'Good for Your Pocket',
        description:
            'Save money by renting when needed and enjoy access to premium products without paying full price.',
        icon: <DollarOutlined />,
    },
    {
        title: 'Good for the Economy',
        description:
            'Support the local market and unlock more value from existing items through smarter shared use.',
        icon: <ThunderboltOutlined />,
    },
];

const Home = () => {
    const [howItWorksMode, setHowItWorksMode] = useState<'renters' | 'owners'>('renters');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const screens = useBreakpoint();
    const navigate = useNavigate();
    const { user } = useAuth();

    const isMobileOrTablet = !screens.lg;

    const [searchValue, setSearchValue] = useState('');
    const [categories, setCategories] = useState<PublicCategory[]>([]);
    const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
    const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
    const [sections, setSections] = useState<HomepageSection[]>([]);

    useEffect(() => {
        document.title = 'GearShare - Home';
        getPublicCategories().then(setCategories).catch(() => {});
        getPublicCarousel().then(setCarouselSlides).catch(() => {});
        getTrendingItems(6).then(setTrendingItems).catch(() => {});
        getPublicSections().then(setSections).catch(() => {});
    }, []);

    // Already signed in -> go straight to their dashboard. Signed out -> log in first.
    // Used by every "Start Renting" / "Become a lender" call-to-action on this page.
    const goToAccount = () => {
        setDrawerOpen(false);
        navigate(user ? resolveHomeRoute(user) : '/login');
    };

    const goToBrowse = (params: { search?: string; category?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set('search', params.search);
        if (params.category) qs.set('category', params.category);
        const query = qs.toString();
        navigate(query ? `/browse?${query}` : '/browse');
    };

    const howItWorksData = howItWorksMode === 'renters' ? renterSteps : ownerSteps;

    return (
        <Layout style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
            <Header
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    background: 'var(--gs-surface)',
                    borderBottom: '1px solid var(--gs-border)',
                    padding: isMobileOrTablet ? '0 16px' : '0 32px',
                    height: '84px',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                    }}
                >
                    {/* Logo */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            minWidth: isMobileOrTablet ? 'auto' : 180,
                            flexShrink: 0,
                        }}
                    >
                        <SiteLogoBadge size={48} borderRadius={14} fallbackFontSize={18} />

                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                            <Text style={{ fontSize: 18, fontWeight: 700, color: 'var(--gs-heading)' }}>
                                GearShare
                            </Text>
                            {!isMobileOrTablet && (
                                <Text style={{ fontSize: 12, color: 'var(--color-muted)' }}>Rent smarter</Text>
                            )}
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ flex: 1, maxWidth: isMobileOrTablet ? '100%' : 560 }}>
                        <Input
                            size="large"
                            placeholder="Search for cameras, tools, speakers..."
                            prefix={<SearchOutlined style={{ color: 'var(--color-muted)' }} />}
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onPressEnter={() => goToBrowse({ search: searchValue })}
                            style={{
                                borderRadius: 999,
                                height: 46,
                            }}
                        />
                    </div>

                    {/* Desktop actions */}
                    {!isMobileOrTablet && (
                        <Space size="middle" align="center">
                            <ThemeToggle />

                            <Button type="text" style={{ fontWeight: 500 }} onClick={goToAccount}>
                                Become a lender
                            </Button>

                            <span style={{ color: '#c7cdd8', fontSize: 18 }}>|</span>

                            <Button
                                type="primary"
                                shape="round"
                                style={{
                                    background: '#2B2E4A',
                                    borderColor: '#2B2E4A',
                                    fontWeight: 600,
                                }}
                                onClick={goToAccount}
                            >
                                Start Renting
                            </Button>
                        </Space>
                    )}

                    {/* Mobile / tablet burger */}
                    {isMobileOrTablet && (
                        <Button
                            type="text"
                            icon={<MenuOutlined style={{ fontSize: 22, color: 'var(--gs-heading)' }} />}
                            onClick={() => setDrawerOpen(true)}
                            style={{
                                width: 44,
                                height: 44,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
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
                width={320}
            >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <ThemeToggle block />

                    <Button type="text" block style={{ textAlign: 'left', height: 42 }} onClick={goToAccount}>
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
                        onClick={goToAccount}
                    >
                        Start Renting
                    </Button>

                    <div style={{ borderTop: '1px solid var(--gs-border)', paddingTop: 12 }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
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

            <Content style={{ padding: '28px 24px 60px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <SiteNoticeBanner audience="public" style={{ marginBottom: 20 }} />

                    {/* Hero */}
                    <div
                        style={{
                            background: '#f7f4ea',
                            border: '1px solid #cfd8ea',
                            borderRadius: 20,
                            padding: 16,
                            marginBottom: 28,
                        }}
                    >
                        {carouselSlides.length > 0 ? (
                            <Carousel autoplay dots>
                                {carouselSlides.map((slide) => (
                                    <div key={slide.id}>
                                        <div
                                            onClick={() => slide.linkUrl && (window.location.href = slide.linkUrl)}
                                            style={{
                                                height: 280,
                                                borderRadius: 16,
                                                backgroundImage: `linear-gradient(rgba(43,46,74,0.45), rgba(43,46,74,0.45)), url(${carouselImageUrl(slide.id)})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                color: '#fff',
                                                textAlign: 'center',
                                                padding: 24,
                                                cursor: slide.linkUrl ? 'pointer' : 'default',
                                            }}
                                        >
                                            {slide.headline && (
                                                <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
                                                    {slide.headline}
                                                </Title>
                                            )}
                                            {slide.subtext && (
                                                <Paragraph style={{ color: '#eef2ff', maxWidth: 700, marginBottom: 0 }}>
                                                    {slide.subtext}
                                                </Paragraph>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </Carousel>
                        ) : (
                            <Carousel autoplay dots>
                                <div>
                                    <div
                                        style={{
                                            height: 280,
                                            borderRadius: 16,
                                            background: 'linear-gradient(135deg, #2B2E4A, #5D79BB)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            color: '#fff',
                                            textAlign: 'center',
                                            padding: 24,
                                        }}
                                    >
                                        <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
                                            Rent what you need, when you need it
                                        </Title>
                                        <Paragraph style={{ color: '#eef2ff', maxWidth: 700, marginBottom: 0 }}>
                                            Discover trusted rentals across tools, electronics, fitness gear, medical
                                            items, and more.
                                        </Paragraph>
                                    </div>
                                </div>

                                <div>
                                    <div
                                        style={{
                                            height: 280,
                                            borderRadius: 16,
                                            background: 'linear-gradient(135deg, #5D79BB, #2B2E4A)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            color: '#fff',
                                            textAlign: 'center',
                                            padding: 24,
                                        }}
                                    >
                                        <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
                                            Turn unused items into income
                                        </Title>
                                        <Paragraph style={{ color: '#eef2ff', maxWidth: 700, marginBottom: 0 }}>
                                            List your gear, accept bookings, and earn from things you already own.
                                        </Paragraph>
                                    </div>
                                </div>

                                <div>
                                    <div
                                        style={{
                                            height: 280,
                                            borderRadius: 16,
                                            background: 'linear-gradient(135deg, #394867, #5D79BB)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            color: '#fff',
                                            textAlign: 'center',
                                            padding: 24,
                                        }}
                                    >
                                        <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
                                            Smarter renting for modern communities
                                        </Title>
                                        <Paragraph style={{ color: '#eef2ff', maxWidth: 700, marginBottom: 0 }}>
                                            GearShare helps people access quality items without the cost of buying.
                                        </Paragraph>
                                    </div>
                                </div>
                            </Carousel>
                        )}
                    </div>

                    {/* Categories */}
                    <div style={{ marginBottom: 36 }}>
                        <Title level={3} style={{ textAlign: 'center', color: 'var(--gs-heading)', marginBottom: 22 }}>
                            Rent by Category
                        </Title>

                        <Row gutter={[20, 20]} justify="center">
                            {(categories.length > 0
                                ? categories.map((c) => ({ key: String(c.id), title: c.name, icon: c.hasIcon ? categoryIconUrl(c.id) : null }))
                                : DEFAULT_CATEGORIES.map((c) => ({ key: c.title, title: c.title, icon: null as string | null, fallbackIcon: c.icon }))
                            ).map((category: any) => (
                                <Col xs={12} sm={8} md={6} lg={4} xl={4} key={category.key}>
                                    <Card
                                        hoverable
                                        onClick={() => goToBrowse({ category: category.title })}
                                        style={{
                                            borderRadius: 18,
                                            borderColor: '#cfd8ea',
                                            textAlign: 'center',
                                            minHeight: 150,
                                        }}
                                        styles={{
                                            body: {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: 14,
                                                height: 150,
                                            },
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: 16,
                                                background: '#eef3fb',
                                                color: 'var(--gs-heading)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 24,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {category.icon ? (
                                                <img src={category.icon} alt={category.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                category.fallbackIcon || <ToolOutlined />
                                            )}
                                        </div>
                                        <Text style={{ fontWeight: 500, color: 'var(--gs-heading)' }}>{category.title}</Text>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </div>

                    {/* Trending */}
                    <div style={{ marginBottom: 42 }}>
                        <Title level={3} style={{ color: 'var(--gs-heading)', marginBottom: 20 }}>
                            <span style={{ color: '#5D79BB' }}>Trending Items</span> people love to rent
                        </Title>

                        <div
                            style={{
                                background: '#f7f4ea',
                                border: '1px solid #cfd8ea',
                                borderRadius: 20,
                                padding: 24,
                            }}
                        >
                            <Row gutter={[24, 24]}>
                                {trendingItems.length > 0
                                    ? trendingItems.map((item) => (
                                          <Col xs={24} sm={12} md={8} key={item.id}>
                                              <Card
                                                  hoverable
                                                  onClick={() => navigate(`/renter/items/${item.id}`)}
                                                  style={{ borderRadius: 18, borderColor: '#d6def0' }}
                                              >
                                                  {item.primaryImageId ? (
                                                      <img
                                                          src={itemImageUrl(item.id, item.primaryImageId)}
                                                          alt={item.title}
                                                          style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 14, marginBottom: 16 }}
                                                      />
                                                  ) : (
                                                      <div style={{ width: '100%', height: 150, borderRadius: 14, background: '#eef3fb', marginBottom: 16 }} />
                                                  )}

                                                  <Text style={{ display: 'block', fontWeight: 600, color: 'var(--gs-heading)', marginBottom: 4 }}>
                                                      {item.title}
                                                  </Text>

                                                  <Text style={{ display: 'block', color: '#2d7a46', marginBottom: 8 }}>
                                                      {item.featuredUntil ? 'Featured' : item.category || 'Available now'}
                                                  </Text>

                                                  <Text strong style={{ color: 'var(--gs-heading)' }}>
                                                      {item.currency} {item.pricePerDay.toFixed(2)} / day
                                                  </Text>
                                              </Card>
                                          </Col>
                                      ))
                                    : DEFAULT_TRENDING.map((item) => (
                                          <Col xs={24} sm={12} md={8} key={item.title}>
                                              <Card hoverable style={{ borderRadius: 18, borderColor: '#d6def0' }}>
                                                  <div style={{ width: '100%', height: 150, borderRadius: 14, background: '#eef3fb', marginBottom: 16 }} />
                                                  <Text style={{ display: 'block', fontWeight: 600, color: 'var(--gs-heading)', marginBottom: 4 }}>
                                                      {item.title}
                                                  </Text>
                                                  <Text style={{ display: 'block', color: '#2d7a46', marginBottom: 8 }}>{item.booked}</Text>
                                                  <Rate disabled defaultValue={3} style={{ fontSize: 14, color: 'var(--gs-heading)' }} />
                                              </Card>
                                          </Col>
                                      ))}
                            </Row>
                        </div>
                    </div>

                    {/* How it works */}
                    <div style={{ marginBottom: 42 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                flexWrap: 'wrap',
                                marginBottom: 24,
                            }}
                        >
                            <Title level={3} style={{ color: '#5D79BB', margin: 0 }}>
                                How it works
                            </Title>

                            <Segmented
                                value={howItWorksMode}
                                onChange={(value) => setHowItWorksMode(value as 'renters' | 'owners')}
                                options={[
                                    { label: 'For renters', value: 'renters' },
                                    { label: 'For owners', value: 'owners' },
                                ]}
                                style={{
                                    background: '#f2efe7',
                                    padding: 4,
                                    borderRadius: 999,
                                }}
                            />
                        </div>

                        <Row gutter={[24, 24]}>
                            {howItWorksData.map((step) => (
                                <Col xs={24} md={8} key={step.id}>
                                    <div style={{ display: 'flex', gap: 14 }}>
                                        <div
                                            style={{
                                                minWidth: 34,
                                                fontSize: 42,
                                                lineHeight: 1,
                                                fontWeight: 700,
                                                color: 'var(--gs-heading)',
                                            }}
                                        >
                                            {step.id}
                                        </div>

                                        <div>
                                            <Text
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 700,
                                                    color: '#111827',
                                                    marginBottom: 8,
                                                }}
                                            >
                                                {step.title}
                                            </Text>
                                            <Paragraph style={{ color: '#334155', marginBottom: 0 }}>
                                                {step.description}
                                            </Paragraph>
                                        </div>
                                    </div>
                                </Col>
                            ))}
                        </Row>
                    </div>

                    {/* Confidence */}
                    <div style={{ marginBottom: 42 }}>
                        <Title level={3} style={{ color: 'var(--gs-heading)', marginBottom: 10 }}>
                            <span style={{ color: '#5D79BB' }}>We&apos;ve got your back</span> - Everything you
                            need to rent your stuff with confidence.
                        </Title>

                        <Row gutter={[24, 24]} style={{ marginTop: 26 }}>
                            {confidenceItems.map((item) => (
                                <Col xs={24} md={12} lg={8} key={item.title}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 16,
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 16,
                                                background: '#eef3fb',
                                                border: '1px solid #d6def0',
                                                color: 'var(--gs-heading)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 22,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {item.icon}
                                        </div>

                                        <div>
                                            <Text
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 700,
                                                    color: '#111827',
                                                    marginBottom: 8,
                                                }}
                                            >
                                                {item.title}
                                            </Text>
                                            <Paragraph style={{ color: '#334155', marginBottom: 0 }}>
                                                {item.description}
                                            </Paragraph>
                                        </div>
                                    </div>
                                </Col>
                            ))}
                        </Row>

                        <div style={{ textAlign: 'center', marginTop: 28 }}>
                            <Text style={{ color: '#475569' }}>Terms, conditions, exclusions apply.</Text>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div style={{ marginBottom: 30 }}>
                        <Title level={3} style={{ color: '#5D79BB', marginBottom: 20 }}>
                            Why Renting Is Better
                        </Title>

                        <div
                            style={{
                                background: '#f7f4ea',
                                border: '1px solid #cfd8ea',
                                borderRadius: 20,
                                padding: 28,
                            }}
                        >
                            <Row gutter={[28, 28]}>
                                {benefits.map((item) => (
                                    <Col xs={24} md={12} lg={8} key={item.title}>
                                        <Card
                                            bordered={false}
                                            style={{
                                                borderRadius: 18,
                                                minHeight: 220,
                                                background: 'transparent',
                                                boxShadow: 'none',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 54,
                                                    height: 54,
                                                    borderRadius: 16,
                                                    background: '#eef3fb',
                                                    color: 'var(--gs-heading)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 24,
                                                    marginBottom: 16,
                                                }}
                                            >
                                                {item.icon}
                                            </div>

                                            <Text
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 700,
                                                    color: '#111827',
                                                    marginBottom: 10,
                                                }}
                                            >
                                                {item.title}
                                            </Text>

                                            <Paragraph style={{ color: '#334155', marginBottom: 0 }}>
                                                {item.description}
                                            </Paragraph>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </div>

                    {/* Admin-managed content sections (Super Admin > Homepage > Sections) */}
                    {sections.length > 0 && (
                        <Space direction="vertical" size={28} style={{ width: '100%', marginBottom: 30 }}>
                            {sections.map((section) => (
                                <div
                                    key={section.id}
                                    style={{
                                        background: '#f7f4ea',
                                        border: '1px solid #cfd8ea',
                                        borderRadius: 20,
                                        padding: 28,
                                    }}
                                >
                                    <Row gutter={[28, 20]} align="middle">
                                        {(section.hasImage || section.videoUrl) && (
                                            <Col xs={24} md={10}>
                                                {section.videoUrl ? (
                                                    <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 14, overflow: 'hidden' }}>
                                                        <iframe
                                                            src={section.videoUrl}
                                                            title={section.title}
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={sectionImageUrl(section.id)}
                                                        alt={section.title}
                                                        style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 14 }}
                                                    />
                                                )}
                                            </Col>
                                        )}
                                        <Col xs={24} md={section.hasImage || section.videoUrl ? 14 : 24}>
                                            <Title level={3} style={{ color: 'var(--gs-heading)', marginBottom: 12 }}>
                                                {section.title}
                                            </Title>
                                            {section.body && (
                                                <Paragraph style={{ color: '#334155', marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                                                    {section.body}
                                                </Paragraph>
                                            )}
                                        </Col>
                                    </Row>
                                </div>
                            ))}
                        </Space>
                    )}
                </div>
            </Content>

            <Footer
                style={{
                    background: 'var(--gs-surface)',
                    borderTop: '1px solid var(--gs-border)',
                    padding: '32px 24px',
                }}
            >
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <Row gutter={[24, 24]} justify="space-between">
                        <Col xs={24} md={10}>
                            <Text style={{ display: 'block', fontSize: 18, fontWeight: 700, color: 'var(--gs-heading)' }}>
                                GearShare
                            </Text>
                            <Paragraph style={{ color: 'var(--color-muted)', marginTop: 8, marginBottom: 0 }}>
                                Rent smarter. Share more. Access the things you need without the full cost of
                                ownership.
                            </Paragraph>
                        </Col>

                        <Col xs={24} md={12}>
                            <Row gutter={[16, 16]}>
                                <Col xs={12} sm={6}>
                                    <Space direction="vertical" size="small">
                                        <Link>About</Link>
                                        <Link>How it works</Link>
                                        <Link>Categories</Link>
                                    </Space>
                                </Col>
                                <Col xs={12} sm={6}>
                                    <Space direction="vertical" size="small">
                                        <Link>Trust & Safety</Link>
                                        <Link>Pricing</Link>
                                        <Link>Community</Link>
                                    </Space>
                                </Col>
                                <Col xs={12} sm={6}>
                                    <Space direction="vertical" size="small">
                                        <Link>Terms</Link>
                                        <Link>Privacy</Link>
                                        <Link>Support</Link>
                                    </Space>
                                </Col>
                                <Col xs={12} sm={6}>
                                    <Space direction="vertical" size="small">
                                        <Link>Contact</Link>
                                        <Link>FAQ</Link>
                                        <Link>Help Centre</Link>
                                    </Space>
                                </Col>
                            </Row>
                        </Col>
                    </Row>

                    <div
                        style={{
                            marginTop: 24,
                            paddingTop: 16,
                            borderTop: '1px solid #eef2f7',
                            textAlign: 'center',
                        }}
                    >
                        <Text style={{ color: 'var(--color-muted)' }}>© 2026 GearShare. All rights reserved.</Text>
                    </div>
                </div>
            </Footer>
        </Layout>
    );
};

export default Home;
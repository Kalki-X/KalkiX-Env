import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Layout, Typography, Input, Select, Row, Col, Card, Space, Alert, Empty, Tag, Spin, Button } from 'antd';
import { InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Item, listActiveItems, itemImageUrl } from '../features/listings/api/listingsApi';
import { getPublicCategories } from '../features/siteContent/api/siteContentApi';
import { getApiErrorMessage } from '../services/api/client';

const { Header, Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

/**
 * Public, unauthenticated marketplace browse/search page. This is what the homepage
 * search bar and "Rent by Category" tiles link to — anyone can search and see what's
 * available. Booking still requires an account: clicking an item navigates to the
 * (gated) item detail route, which bounces a logged-out visitor to /login and brings
 * them right back here afterwards via ProtectedRoute's from-redirect.
 */
export default function PublicBrowse() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [category, setCategory] = useState<string | undefined>(searchParams.get('category') || undefined);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        document.title = 'GearShare - Browse';
        getPublicCategories()
            .then((cats) => setCategories(cats.map((c) => c.name)))
            .catch(() => {});
    }, []);

    const load = async (searchValue = search, categoryValue = category) => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setItems(await listActiveItems({ search: searchValue || undefined, category: categoryValue }));
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Could not load listings.'));
        } finally {
            setLoading(false);
        }
    };

    // Re-run whenever the URL's own query params change (covers first mount, plus
    // clicking a category tile on the homepage again while already on this page).
    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        const urlCategory = searchParams.get('category') || undefined;
        setSearch(urlSearch);
        setCategory(urlCategory);
        load(urlSearch, urlCategory);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const onSearch = (value: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set('search', value);
            else next.delete('search');
            return next;
        });
    };

    const onCategoryChange = (value: string | undefined) => {
        setCategory(value);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set('category', value);
            else next.delete('category');
            return next;
        });
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#E7EEF7' }}>
            <Header
                style={{
                    background: '#ffffff',
                    borderBottom: '1px solid #d9e1f2',
                    padding: '0 24px',
                    height: 72,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#2B2E4A' }}>
                        GearShare
                    </Button>
                </Link>
                <Space>
                    <Button onClick={() => navigate('/login')}>Log in</Button>
                    <Button type="primary" style={{ background: '#2B2E4A', borderColor: '#2B2E4A' }} onClick={() => navigate('/register')}>
                        Sign up
                    </Button>
                </Space>
            </Header>

            <Content style={{ padding: '28px 24px 60px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                            <Title level={2} style={{ color: '#2B2E4A', marginBottom: 4 }}>
                                Browse GearShare
                            </Title>
                            <Paragraph style={{ color: '#64748b' }}>
                                Search everything currently available to rent. Sign in to book an item.
                            </Paragraph>
                        </div>

                        <Space wrap>
                            <Input.Search
                                placeholder="Search by title or description"
                                allowClear
                                style={{ width: 320 }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onSearch={onSearch}
                            />
                            <Select allowClear placeholder="Category" style={{ width: 200 }} value={category} onChange={onCategoryChange}>
                                {categories.map((c) => (
                                    <Option key={c} value={c}>
                                        {c}
                                    </Option>
                                ))}
                            </Select>
                        </Space>

                        {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <Spin />
                            </div>
                        ) : items.length === 0 ? (
                            <Empty description="No listings match your search." />
                        ) : (
                            <Row gutter={[16, 16]}>
                                {items.map((item) => (
                                    <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                                        <Card
                                            hoverable
                                            onClick={() => navigate(`/renter/items/${item.id}`)}
                                            cover={
                                                item.primaryImageId ? (
                                                    <img
                                                        src={itemImageUrl(item.id, item.primaryImageId)}
                                                        alt={item.title}
                                                        style={{ height: 160, objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            height: 160,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background: '#eef3fb',
                                                            color: '#94a3b8',
                                                            fontSize: 32,
                                                        }}
                                                    >
                                                        <InboxOutlined />
                                                    </div>
                                                )
                                            }
                                        >
                                            <Card.Meta
                                                title={item.title}
                                                description={
                                                    <Space direction="vertical" size={4}>
                                                        {item.category && <Tag>{item.category}</Tag>}
                                                        <Text strong style={{ color: '#2B2E4A' }}>
                                                            {item.currency} {item.pricePerDay.toFixed(2)} / day
                                                        </Text>
                                                    </Space>
                                                }
                                            />
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </Space>
                </div>
            </Content>
        </Layout>
    );
}

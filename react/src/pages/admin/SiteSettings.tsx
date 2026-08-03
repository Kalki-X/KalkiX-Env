import React, { useEffect, useState } from 'react';
import {
    Typography,
    Tabs,
    Card,
    Form,
    InputNumber,
    Select,
    Button,
    Upload,
    Space,
    Alert,
    Table,
    Switch,
    Input,
    Popconfirm,
    Tag,
    message,
    Empty,
} from 'antd';
import { UploadOutlined, DeleteOutlined, PictureOutlined, PlusOutlined, TagOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    getSiteSettings,
    updateSiteSettings,
    uploadSiteLogo,
    removeSiteLogo,
    listAdminCategories,
    createCategory,
    updateCategory,
    uploadCategoryIcon,
    deleteCategory,
    listAdminCarousel,
    createCarouselSlide,
    updateCarouselSlide,
    replaceCarouselSlideImage,
    deleteCarouselSlide,
    listFeaturedListings,
    cancelFeaturedListing,
    SiteSettings as SiteSettingsType,
    ImageSpec,
    AdminCategory,
    AdminCarouselSlide,
    AdminFeaturedListing,
} from '../../features/admin/api/siteAdminApi';
import { siteLogoUrl, categoryIconUrl, carouselImageUrl } from '../../features/siteContent/api/siteContentApi';
import { CURRENCIES } from '../../features/listings/constants';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

// A tiny cache-busting counter, bumped after every upload/remove, appended as a query
// param so the browser re-fetches the image instead of showing a stale cached one at
// the same URL.
function useCacheBust() {
    const [v, setV] = useState(0);
    return [v, () => setV((x) => x + 1)] as const;
}

function SpecHint({ spec }: { spec?: ImageSpec }) {
    if (!spec) return null;
    return (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {spec.recommendation}
        </Text>
    );
}

function BrandingAndFeesTab() {
    const [settings, setSettings] = useState<SiteSettingsType | null>(null);
    const [specs, setSpecs] = useState<Record<string, ImageSpec>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [form] = Form.useForm();
    const [cacheBust, bumpCacheBust] = useCacheBust();

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const { settings, imageSpecs } = await getSiteSettings();
            setSettings(settings);
            setSpecs(imageSpecs);
            form.setFieldsValue(settings);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Couldn't load site settings."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSave = async (values: { platformFeePercent: number; featuredListingPricePerDay: number; featuredListingCurrency: string }) => {
        setSaving(true);
        try {
            const updated = await updateSiteSettings(values);
            setSettings(updated);
            message.success('Settings saved.');
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't save settings."));
        } finally {
            setSaving(false);
        }
    };

    const onLogoSelected = async (file: File) => {
        setUploadingLogo(true);
        try {
            const updated = await uploadSiteLogo(file);
            setSettings(updated);
            bumpCacheBust();
            message.success('Logo updated.');
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't upload logo."));
        } finally {
            setUploadingLogo(false);
        }
        return false; // prevent antd Upload's default auto-upload behavior
    };

    const onRemoveLogo = async () => {
        try {
            const updated = await removeSiteLogo();
            setSettings(updated);
            bumpCacheBust();
            message.success('Logo removed.');
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't remove logo."));
        }
    };

    if (errorMessage) return <Alert type="error" showIcon message={errorMessage} />;

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card title="Site logo" loading={loading}>
                <Space direction="vertical" size="middle">
                    {settings?.hasLogo ? (
                        <img
                            src={`${siteLogoUrl()}?v=${cacheBust}`}
                            alt="Site logo"
                            style={{ width: 96, height: 96, objectFit: 'contain', border: '1px solid var(--gs-border)', borderRadius: 12, background: '#fff' }}
                        />
                    ) : (
                        <div
                            style={{
                                width: 96,
                                height: 96,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px dashed var(--gs-border)',
                                borderRadius: 12,
                                color: '#94a3b8',
                            }}
                        >
                            <PictureOutlined style={{ fontSize: 28 }} />
                        </div>
                    )}
                    <SpecHint spec={specs.logo} />
                    <Space>
                        <Upload accept="image/png" showUploadList={false} beforeUpload={onLogoSelected}>
                            <Button icon={<UploadOutlined />} loading={uploadingLogo}>
                                {settings?.hasLogo ? 'Replace logo' : 'Upload logo'}
                            </Button>
                        </Upload>
                        {settings?.hasLogo && (
                            <Popconfirm title="Remove the site logo?" onConfirm={onRemoveLogo}>
                                <Button danger icon={<DeleteOutlined />}>
                                    Remove
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                </Space>
            </Card>

            <Card title="Platform fee &amp; featured-listing pricing" loading={loading}>
                <Paragraph style={{ color: 'var(--color-muted)' }}>
                    The platform fee is deducted from what the lender is paid out — renters are always charged exactly
                    the listed price, so this never changes what appears on a renter's invoice.
                </Paragraph>
                <Form form={form} layout="vertical" onFinish={onSave} style={{ maxWidth: 420 }}>
                    <Form.Item label="Platform fee (%)" name="platformFeePercent" rules={[{ required: true }]}>
                        <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} addonAfter="%" />
                    </Form.Item>
                    <Form.Item label="Featured-listing price per day" name="featuredListingPricePerDay" rules={[{ required: true }]}>
                        <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="Currency" name="featuredListingCurrency" rules={[{ required: true }]}>
                        <Select style={{ width: '100%' }}>
                            {CURRENCIES.map((c) => (
                                <Option key={c} value={c}>
                                    {c}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={saving}>
                        Save
                    </Button>
                </Form>
            </Card>
        </Space>
    );
}

function CategoriesTab() {
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [specs, setSpecs] = useState<ImageSpec | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [cacheBust, bumpCacheBust] = useCacheBust();

    const load = async () => {
        setLoading(true);
        try {
            const [cats, { imageSpecs }] = await Promise.all([listAdminCategories(), getSiteSettings()]);
            setCategories(cats);
            setSpecs(imageSpecs.categoryIcon);
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't load categories."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await createCategory({ name: newName.trim() });
            setNewName('');
            message.success('Category added.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't create category."));
        } finally {
            setCreating(false);
        }
    };

    const onToggleActive = async (cat: AdminCategory) => {
        try {
            await updateCategory(cat.id, { active: !cat.active });
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't update category."));
        }
    };

    const onIconSelected = async (cat: AdminCategory, file: File) => {
        try {
            await uploadCategoryIcon(cat.id, file);
            bumpCacheBust();
            message.success('Icon updated.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't upload icon."));
        }
        return false;
    };

    const onDelete = async (cat: AdminCategory) => {
        try {
            await deleteCategory(cat.id);
            message.success('Category deleted.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't delete category."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Paragraph style={{ color: 'var(--color-muted)', marginBottom: 0 }}>
                These drive the "Rent by Category" tiles on the homepage and the category picker when listing/browsing
                items. <SpecHint spec={specs} />
            </Paragraph>

            <Space>
                <Input
                    placeholder="New category name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onPressEnter={onCreate}
                    style={{ width: 240 }}
                />
                <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={onCreate}>
                    Add category
                </Button>
            </Space>

            <Table<AdminCategory>
                rowKey="id"
                loading={loading}
                dataSource={categories}
                pagination={false}
                columns={[
                    {
                        title: 'Icon',
                        key: 'icon',
                        width: 72,
                        render: (_, cat) =>
                            cat.hasIcon ? (
                                <img
                                    src={`${categoryIconUrl(cat.id)}?v=${cacheBust}`}
                                    alt={cat.name}
                                    style={{ width: 32, height: 32, objectFit: 'contain' }}
                                />
                            ) : (
                                <TagOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                            ),
                    },
                    { title: 'Name', dataIndex: 'name' },
                    { title: 'Sort order', dataIndex: 'sortOrder' },
                    {
                        title: 'Active',
                        key: 'active',
                        render: (_, cat) => <Switch checked={cat.active} onChange={() => onToggleActive(cat)} />,
                    },
                    {
                        title: '',
                        key: 'actions',
                        render: (_, cat) => (
                            <Space>
                                <Upload accept="image/png" showUploadList={false} beforeUpload={(file) => onIconSelected(cat, file)}>
                                    <Button size="small" icon={<UploadOutlined />}>
                                        Icon
                                    </Button>
                                </Upload>
                                <Popconfirm title="Delete this category?" description="Only possible if no listing currently uses it." onConfirm={() => onDelete(cat)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]}
            />
        </Space>
    );
}

function CarouselTab() {
    const [slides, setSlides] = useState<AdminCarouselSlide[]>([]);
    const [specs, setSpecs] = useState<ImageSpec | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [cacheBust, bumpCacheBust] = useCacheBust();
    const [newHeadline, setNewHeadline] = useState('');
    const [newSubtext, setNewSubtext] = useState('');
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [s, { imageSpecs }] = await Promise.all([listAdminCarousel(), getSiteSettings()]);
            setSlides(s);
            setSpecs(imageSpecs.carouselSlide);
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't load carousel slides."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onCreate = async (file: File) => {
        setCreating(true);
        try {
            await createCarouselSlide(file, { headline: newHeadline || undefined, subtext: newSubtext || undefined });
            setNewHeadline('');
            setNewSubtext('');
            message.success('Slide added.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't add slide."));
        } finally {
            setCreating(false);
        }
        return false;
    };

    const onToggleActive = async (slide: AdminCarouselSlide) => {
        try {
            await updateCarouselSlide(slide.id, { active: !slide.active });
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't update slide."));
        }
    };

    const onReplaceImage = async (slide: AdminCarouselSlide, file: File) => {
        try {
            await replaceCarouselSlideImage(slide.id, file);
            bumpCacheBust();
            message.success('Image replaced.');
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't replace image."));
        }
        return false;
    };

    const onDelete = async (slide: AdminCarouselSlide) => {
        try {
            await deleteCarouselSlide(slide.id);
            message.success('Slide deleted.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't delete slide."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Paragraph style={{ color: 'var(--color-muted)', marginBottom: 0 }}>
                Manages the homepage hero carousel. If no slides are configured here, the homepage falls back to its
                built-in default slides. <SpecHint spec={specs} />
            </Paragraph>

            <Card size="small" title="Add a slide">
                <Space direction="vertical" style={{ width: '100%', maxWidth: 420 }}>
                    <Input placeholder="Headline (optional)" value={newHeadline} onChange={(e) => setNewHeadline(e.target.value)} />
                    <Input placeholder="Subtext (optional)" value={newSubtext} onChange={(e) => setNewSubtext(e.target.value)} />
                    <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={onCreate}>
                        <Button icon={<UploadOutlined />} loading={creating}>
                            Upload image &amp; add slide
                        </Button>
                    </Upload>
                </Space>
            </Card>

            {slides.length === 0 && !loading ? (
                <Empty description="No custom slides yet — showing the default homepage carousel." />
            ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {slides.map((slide) => (
                        <Card key={slide.id} size="small">
                            <Space align="start" size="middle" wrap>
                                <img
                                    src={`${carouselImageUrl(slide.id)}?v=${cacheBust}`}
                                    alt={slide.headline || 'Slide'}
                                    style={{ width: 160, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gs-border)' }}
                                />
                                <div>
                                    <Text strong>{slide.headline || <em>No headline</em>}</Text>
                                    <br />
                                    <Text type="secondary">{slide.subtext}</Text>
                                    <br />
                                    <Tag color={slide.active ? 'success' : 'default'} style={{ marginTop: 4 }}>
                                        {slide.active ? 'Active' : 'Hidden'}
                                    </Tag>
                                </div>
                                <Space direction="vertical">
                                    <Switch checked={slide.active} onChange={() => onToggleActive(slide)} checkedChildren="Active" unCheckedChildren="Hidden" />
                                    <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={(file) => onReplaceImage(slide, file)}>
                                        <Button size="small" icon={<UploadOutlined />}>
                                            Replace image
                                        </Button>
                                    </Upload>
                                    <Popconfirm title="Delete this slide?" onConfirm={() => onDelete(slide)}>
                                        <Button size="small" danger icon={<DeleteOutlined />}>
                                            Delete
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            </Space>
                        </Card>
                    ))}
                </Space>
            )}
        </Space>
    );
}

function FeaturedListingsTab() {
    const [featured, setFeatured] = useState<AdminFeaturedListing[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            setFeatured(await listFeaturedListings());
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't load featured listings."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const onCancel = async (f: AdminFeaturedListing) => {
        try {
            await cancelFeaturedListing(f.id);
            message.success('Featured slot cancelled.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't cancel this slot."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Paragraph style={{ color: 'var(--color-muted)', marginBottom: 0 }}>
                Every paid placement in the homepage "Trending" rail. Lenders purchase their own slot from their
                listing management screen; use Cancel here to pull one early.
            </Paragraph>
            <Table<AdminFeaturedListing>
                rowKey="id"
                loading={loading}
                dataSource={featured}
                columns={[
                    { title: 'Item', dataIndex: 'itemTitle' },
                    {
                        title: 'Window',
                        key: 'window',
                        render: (_, f) => `${dayjs(f.startsAt).format('DD MMM')} – ${dayjs(f.endsAt).format('DD MMM YYYY')}`,
                    },
                    { title: 'Fee', key: 'fee', render: (_, f) => `${f.currency} ${f.feeAmount.toFixed(2)}` },
                    {
                        title: 'Status',
                        key: 'status',
                        render: (_, f) => {
                            const expired = f.status === 'active' && dayjs(f.endsAt).isBefore(dayjs());
                            const label = f.status === 'cancelled' ? 'cancelled' : expired ? 'expired' : 'active';
                            const color = label === 'active' ? 'success' : label === 'expired' ? 'default' : 'error';
                            return <Tag color={color}>{label}</Tag>;
                        },
                    },
                    {
                        title: '',
                        key: 'actions',
                        render: (_, f) =>
                            f.status === 'active' && !dayjs(f.endsAt).isBefore(dayjs()) ? (
                                <Popconfirm title="Cancel this featured slot?" onConfirm={() => onCancel(f)}>
                                    <Button size="small" danger>
                                        Cancel
                                    </Button>
                                </Popconfirm>
                            ) : null,
                    },
                ]}
            />
        </Space>
    );
}

export default function SiteSettingsPage() {
    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: 'var(--gs-heading)', marginBottom: 4 }}>
                    Marketplace homepage
                </Title>
                <Paragraph style={{ color: 'var(--color-muted)' }}>
                    Manage what visitors see on the public homepage, plus the platform fee and featured-listing
                    pricing.
                </Paragraph>
            </div>

            <Tabs
                items={[
                    { key: 'branding', label: 'Branding & Fees', children: <BrandingAndFeesTab /> },
                    { key: 'categories', label: 'Categories', children: <CategoriesTab /> },
                    { key: 'carousel', label: 'Carousel', children: <CarouselTab /> },
                    { key: 'featured', label: 'Featured Listings', children: <FeaturedListingsTab /> },
                ]}
            />
        </Space>
    );
}

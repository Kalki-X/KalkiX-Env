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
    Row,
    Col,
} from 'antd';
import { UploadOutlined, DeleteOutlined, PictureOutlined, PlusOutlined, TagOutlined, SaveOutlined, NotificationOutlined } from '@ant-design/icons';
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
    listAdminSections,
    createSection,
    updateSection,
    uploadSectionImage,
    removeSectionImage,
    deleteSection,
    listAdminNotices,
    createNotice,
    updateNotice,
    deleteNotice,
    SiteSettings as SiteSettingsType,
    ImageSpec,
    AdminCategory,
    AdminCarouselSlide,
    AdminFeaturedListing,
    AdminSection,
    AdminNotice,
} from '../../features/admin/api/siteAdminApi';
import { siteLogoUrl, categoryIconUrl, carouselImageUrl, sectionImageUrl } from '../../features/siteContent/api/siteContentApi';
import { CURRENCIES } from '../../features/listings/constants';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

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

    const onSave = async (values: {
        platformFeePercent: number;
        featuredListingPricePerDay: number;
        featuredListingCurrency: string;
        companyLegalName?: string;
        companyAddressLine1?: string;
        companyAddressLine2?: string;
        companyCity?: string;
        companyState?: string;
        companyPostalCode?: string;
        companyCountry?: string;
        companyVatNumber?: string;
        companyEmail?: string;
        companyPhone?: string;
    }) => {
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

            <Form form={form} layout="vertical" onFinish={onSave}>
                <Card title="Platform fee &amp; featured-listing pricing" loading={loading}>
                    <Paragraph style={{ color: 'var(--color-muted)' }}>
                        The platform fee is deducted from what the lender is paid out — renters are always charged
                        exactly the listed price, so this never changes what appears on a renter's invoice.
                    </Paragraph>
                    <Row gutter={16} style={{ maxWidth: 640 }}>
                        <Col xs={24} sm={8}>
                            <Form.Item label="Platform fee (%)" name="platformFeePercent" rules={[{ required: true }]}>
                                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} addonAfter="%" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item label="Featured-listing price per day" name="featuredListingPricePerDay" rules={[{ required: true }]}>
                                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item label="Currency" name="featuredListingCurrency" rules={[{ required: true }]}>
                                <Select style={{ width: '100%' }}>
                                    {CURRENCIES.map((c) => (
                                        <Option key={c} value={c}>
                                            {c}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card title="Company / invoice details" loading={loading} style={{ marginTop: 24 }}>
                    <Paragraph style={{ color: 'var(--color-muted)' }}>
                        Shown on every proforma invoice, invoice, and credit note PDF — on the right-hand "issued by"
                        block and repeated in the footer. The lender's own details are pulled automatically from
                        their profile and shown on the left of each document.
                    </Paragraph>
                    <Row gutter={16} style={{ maxWidth: 640 }}>
                        <Col xs={24} sm={12}>
                            <Form.Item label="Legal company name" name="companyLegalName" rules={[{ required: true, message: 'Company name is required' }]}>
                                <Input placeholder="GearShare Inc." />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item label="VAT / Tax number" name="companyVatNumber">
                                <Input placeholder="e.g. US123456789" />
                            </Form.Item>
                        </Col>
                        <Col xs={24}>
                            <Form.Item label="Address line 1" name="companyAddressLine1">
                                <Input placeholder="Street address" />
                            </Form.Item>
                        </Col>
                        <Col xs={24}>
                            <Form.Item label="Address line 2" name="companyAddressLine2">
                                <Input placeholder="Suite / floor (optional)" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item label="City" name="companyCity">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item label="State / Province" name="companyState">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item label="Postal / pin code" name="companyPostalCode">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item label="Country" name="companyCountry">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={6}>
                            <Form.Item label="Support email" name="companyEmail" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
                                <Input placeholder="billing@gearshare.example" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={6}>
                            <Form.Item label="Phone" name="companyPhone">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" loading={saving}>
                        Save
                    </Button>
                </Form.Item>
            </Form>
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

function SectionsTab() {
    const [sections, setSections] = useState<AdminSection[]>([]);
    const [drafts, setDrafts] = useState<Record<number, { title: string; body: string; videoUrl: string }>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [cacheBust, bumpCacheBust] = useCacheBust();

    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const list = await listAdminSections();
            setSections(list);
            setDrafts(Object.fromEntries(list.map((s) => [s.id, { title: s.title, body: s.body || '', videoUrl: s.videoUrl || '' }])));
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't load homepage sections."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onCreate = async () => {
        if (!newTitle.trim()) return;
        setCreating(true);
        try {
            await createSection({ title: newTitle.trim(), body: newBody || undefined, videoUrl: newVideoUrl || undefined });
            setNewTitle('');
            setNewBody('');
            setNewVideoUrl('');
            message.success('Section added.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't create section."));
        } finally {
            setCreating(false);
        }
    };

    const onSaveDraft = async (id: number) => {
        const draft = drafts[id];
        if (!draft || !draft.title.trim()) {
            message.error('Title cannot be empty.');
            return;
        }
        setSaving(id);
        try {
            await updateSection(id, { title: draft.title.trim(), body: draft.body, videoUrl: draft.videoUrl });
            message.success('Section saved.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't save section."));
        } finally {
            setSaving(null);
        }
    };

    const onToggleActive = async (section: AdminSection) => {
        try {
            await updateSection(section.id, { active: !section.active });
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't update section."));
        }
    };

    const onImageSelected = async (section: AdminSection, file: File) => {
        try {
            await uploadSectionImage(section.id, file);
            bumpCacheBust();
            message.success('Image uploaded.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't upload image."));
        }
        return false;
    };

    const onRemoveImage = async (section: AdminSection) => {
        try {
            await removeSectionImage(section.id);
            bumpCacheBust();
            message.success('Image removed.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't remove image."));
        }
    };

    const onDelete = async (section: AdminSection) => {
        try {
            await deleteSection(section.id);
            message.success('Section deleted.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't delete section."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Paragraph style={{ color: 'var(--color-muted)', marginBottom: 0 }}>
                Freeform blocks (title + text + an image or an external video embed) rendered on the public homepage
                below the existing marketplace areas, in the order shown here. For video, paste a shareable embed URL
                (e.g. a YouTube "Embed" link, a Vimeo player link, or a direct .mp4 link).
            </Paragraph>

            <Card size="small" title="Add a section">
                <Space direction="vertical" style={{ width: '100%', maxWidth: 520 }}>
                    <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <TextArea placeholder="Body text (optional)" value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={3} />
                    <Input placeholder="Video embed URL (optional)" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} />
                    <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={onCreate} disabled={!newTitle.trim()}>
                        Add section
                    </Button>
                </Space>
            </Card>

            {sections.length === 0 && !loading ? (
                <Empty description="No homepage sections yet." />
            ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {sections.map((section) => {
                        const draft = drafts[section.id] || { title: section.title, body: section.body || '', videoUrl: section.videoUrl || '' };
                        return (
                            <Card key={section.id} size="small">
                                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                    <Space align="center" wrap>
                                        <Tag color={section.active ? 'success' : 'default'}>{section.active ? 'Active' : 'Hidden'}</Tag>
                                        <Switch checked={section.active} onChange={() => onToggleActive(section)} size="small" />
                                        <Popconfirm title="Delete this section?" onConfirm={() => onDelete(section)}>
                                            <Button size="small" danger icon={<DeleteOutlined />}>
                                                Delete
                                            </Button>
                                        </Popconfirm>
                                    </Space>

                                    <Row gutter={16}>
                                        <Col xs={24} md={section.hasImage ? 16 : 24}>
                                            <Input
                                                placeholder="Title"
                                                value={draft.title}
                                                onChange={(e) => setDrafts((prev) => ({ ...prev, [section.id]: { ...draft, title: e.target.value } }))}
                                                style={{ marginBottom: 8 }}
                                            />
                                            <TextArea
                                                placeholder="Body text"
                                                value={draft.body}
                                                onChange={(e) => setDrafts((prev) => ({ ...prev, [section.id]: { ...draft, body: e.target.value } }))}
                                                rows={2}
                                                style={{ marginBottom: 8 }}
                                            />
                                            <Input
                                                placeholder="Video embed URL"
                                                value={draft.videoUrl}
                                                onChange={(e) => setDrafts((prev) => ({ ...prev, [section.id]: { ...draft, videoUrl: e.target.value } }))}
                                            />
                                        </Col>
                                        {section.hasImage && (
                                            <Col xs={24} md={8}>
                                                <img
                                                    src={`${sectionImageUrl(section.id)}?v=${cacheBust}`}
                                                    alt={section.title}
                                                    style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--gs-border)' }}
                                                />
                                            </Col>
                                        )}
                                    </Row>

                                    <Space wrap>
                                        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving === section.id} onClick={() => onSaveDraft(section.id)}>
                                            Save
                                        </Button>
                                        <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={(file) => onImageSelected(section, file)}>
                                            <Button size="small" icon={<UploadOutlined />}>
                                                {section.hasImage ? 'Replace image' : 'Add image'}
                                            </Button>
                                        </Upload>
                                        {section.hasImage && (
                                            <Button size="small" danger onClick={() => onRemoveImage(section)}>
                                                Remove image
                                            </Button>
                                        )}
                                    </Space>
                                </Space>
                            </Card>
                        );
                    })}
                </Space>
            )}
        </Space>
    );
}

const SEVERITY_COLOR: Record<AdminNotice['severity'], string> = {
    info: 'blue',
    warning: 'gold',
    critical: 'red',
};

function NoticesTab() {
    const [notices, setNotices] = useState<AdminNotice[]>([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [newSeverity, setNewSeverity] = useState<AdminNotice['severity']>('info');
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setNotices(await listAdminNotices());
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't load site notices."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const onCreate = async () => {
        if (!newMessage.trim()) return;
        setCreating(true);
        try {
            await createNotice({ message: newMessage.trim(), severity: newSeverity });
            setNewMessage('');
            setNewSeverity('info');
            message.success('Notice posted.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't post notice."));
        } finally {
            setCreating(false);
        }
    };

    const onToggleActive = async (notice: AdminNotice) => {
        try {
            await updateNotice(notice.id, { active: !notice.active });
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't update notice."));
        }
    };

    const onDelete = async (notice: AdminNotice) => {
        try {
            await deleteNotice(notice.id);
            message.success('Notice deleted.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Couldn't delete notice."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Paragraph style={{ color: 'var(--color-muted)', marginBottom: 0 }}>
                Banner announcements shown to both public visitors (homepage) and logged-in platform users
                (dashboard). Anyone can dismiss one for their current browser session — it reappears on their next
                visit as long as it's still active.
            </Paragraph>

            <Card size="small" title="Post a notice">
                <Space direction="vertical" style={{ width: '100%', maxWidth: 520 }}>
                    <TextArea placeholder="Notice message" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={2} />
                    <Select value={newSeverity} onChange={setNewSeverity} style={{ width: 200 }}>
                        <Option value="info">Info</Option>
                        <Option value="warning">Warning</Option>
                        <Option value="critical">Critical</Option>
                    </Select>
                    <Button type="primary" icon={<NotificationOutlined />} loading={creating} onClick={onCreate} disabled={!newMessage.trim()}>
                        Post notice
                    </Button>
                </Space>
            </Card>

            <Table<AdminNotice>
                rowKey="id"
                loading={loading}
                dataSource={notices}
                pagination={false}
                columns={[
                    { title: 'Message', dataIndex: 'message' },
                    {
                        title: 'Severity',
                        key: 'severity',
                        width: 110,
                        render: (_, n) => <Tag color={SEVERITY_COLOR[n.severity]}>{n.severity}</Tag>,
                    },
                    {
                        title: 'Active',
                        key: 'active',
                        width: 90,
                        render: (_, n) => <Switch checked={n.active} onChange={() => onToggleActive(n)} />,
                    },
                    {
                        title: '',
                        key: 'actions',
                        width: 80,
                        render: (_, n) => (
                            <Popconfirm title="Delete this notice?" onConfirm={() => onDelete(n)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        ),
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
                    { key: 'sections', label: 'Sections', children: <SectionsTab /> },
                    { key: 'notices', label: 'Site Notices', children: <NoticesTab /> },
                    { key: 'featured', label: 'Featured Listings', children: <FeaturedListingsTab /> },
                ]}
            />
        </Space>
    );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Table, Tag, Button, Space, Alert, Popconfirm, message, Avatar, Select, Input, Modal, InputNumber } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined, StarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    Item,
    ItemStatus,
    listMyItems,
    updateItemStatus,
    deleteItem,
    itemImageUrl,
    listMyFeatured,
    featureItem,
    FeaturedListing,
} from "../../features/listings/api/listingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const STATUS_COLOR: Record<ItemStatus, string> = {
    draft: "default",
    active: "success",
    paused: "warning",
    archived: "error",
};

export default function LenderListings() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Item[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [featured, setFeatured] = useState<FeaturedListing[]>([]);
    const [featureModalItem, setFeatureModalItem] = useState<Item | null>(null);
    const [featureDays, setFeatureDays] = useState(7);
    const [featuring, setFeaturing] = useState(false);

    const load = async (searchValue = search) => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setItems(await listMyItems({ search: searchValue || undefined }));
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not load your listings."));
        } finally {
            setLoading(false);
        }
    };

    const loadFeatured = async () => {
        try {
            setFeatured(await listMyFeatured());
        } catch {
            // non-critical — the "Feature" button just won't show current status if this fails
        }
    };

    useEffect(() => {
        load();
        loadFeatured();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activeFeaturedFor = (itemId: number) =>
        featured.find((f) => f.itemId === itemId && f.status === "active" && dayjs(f.endsAt).isAfter(dayjs()));

    const onPurchaseFeature = async () => {
        if (!featureModalItem) return;
        setFeaturing(true);
        try {
            await featureItem(featureModalItem.id, featureDays);
            message.success(`"${featureModalItem.title}" is now featured on the homepage.`);
            setFeatureModalItem(null);
            loadFeatured();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not feature this item."));
        } finally {
            setFeaturing(false);
        }
    };

    const onStatusChange = async (item: Item, status: ItemStatus) => {
        try {
            await updateItemStatus(item.id, status);
            message.success(`"${item.title}" is now ${status}.`);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not update status."));
        }
    };

    const onDelete = async (item: Item) => {
        try {
            await deleteItem(item.id);
            message.success(`"${item.title}" deleted.`);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not delete this listing."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
                <div>
                    <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                        My listings
                    </Title>
                    <Paragraph style={{ color: "#64748b", marginBottom: 0 }}>
                        Add, edit, pause, or archive the items you're lending out.
                    </Paragraph>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/lender/listings/new")}>
                    Add listing
                </Button>
            </Space>

            <Input.Search
                placeholder="Search your listings by title or description"
                allowClear
                style={{ maxWidth: 360 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={(value) => load(value)}
            />

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<Item>
                rowKey="id"
                loading={loading}
                dataSource={items}
                scroll={{ x: "max-content" }}
                columns={[
                    {
                        title: "",
                        key: "thumb",
                        width: 56,
                        render: (_, item) =>
                            item.primaryImageId ? (
                                <Avatar shape="square" size={40} src={itemImageUrl(item.id, item.primaryImageId)} />
                            ) : (
                                <Avatar shape="square" size={40} icon={<InboxOutlined />} />
                            ),
                    },
                    { title: "Title", dataIndex: "title" },
                    { title: "Category", dataIndex: "category", render: (c: string | null) => c || "—" },
                    {
                        title: "Price/day",
                        key: "price",
                        render: (_, item) => `${item.currency} ${item.pricePerDay.toFixed(2)}`,
                    },
                    {
                        title: "Status",
                        key: "status",
                        render: (_, item) => (
                            <Select
                                size="small"
                                value={item.status}
                                style={{ width: 120 }}
                                onChange={(status) => onStatusChange(item, status)}
                            >
                                <Option value="active">
                                    <Tag color={STATUS_COLOR.active}>active</Tag>
                                </Option>
                                <Option value="paused">
                                    <Tag color={STATUS_COLOR.paused}>paused</Tag>
                                </Option>
                                <Option value="archived">
                                    <Tag color={STATUS_COLOR.archived}>archived</Tag>
                                </Option>
                            </Select>
                        ),
                    },
                    {
                        title: "Trending",
                        key: "featured",
                        render: (_, item) => {
                            const active = activeFeaturedFor(item.id);
                            if (active) {
                                return <Tag color="gold">Featured until {dayjs(active.endsAt).format("DD MMM")}</Tag>;
                            }
                            return (
                                <Button
                                    size="small"
                                    icon={<StarOutlined />}
                                    disabled={item.status !== "active"}
                                    onClick={() => {
                                        setFeatureModalItem(item);
                                        setFeatureDays(7);
                                    }}
                                >
                                    Feature
                                </Button>
                            );
                        },
                    },
                    {
                        title: "",
                        key: "actions",
                        render: (_, item) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/lender/listings/${item.id}/edit`)}>
                                    Edit
                                </Button>
                                <Popconfirm
                                    title="Delete this listing?"
                                    description="Only possible if it has no bookings on record — otherwise archive it instead."
                                    onConfirm={() => onDelete(item)}
                                >
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]}
            />

            <Modal
                title={`Feature "${featureModalItem?.title ?? ''}" on the homepage`}
                open={!!featureModalItem}
                onCancel={() => setFeatureModalItem(null)}
                onOk={onPurchaseFeature}
                confirmLoading={featuring}
                okText="Pay & feature"
            >
                <Paragraph style={{ color: "#64748b" }}>
                    Paid placements appear in the "Trending" rail on the GearShare homepage. Payment is processed
                    immediately (simulated, same as booking payments).
                </Paragraph>
                <Space align="center">
                    <Text>Number of days:</Text>
                    <InputNumber min={1} max={90} value={featureDays} onChange={(v) => setFeatureDays(v ?? 1)} />
                </Space>
            </Modal>
        </Space>
    );
}

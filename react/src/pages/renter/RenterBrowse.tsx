import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Input, Select, Row, Col, Card, Space, Alert, Empty, Tag, Spin } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { Item, listActiveItems, itemImageUrl } from "../../features/listings/api/listingsApi";
import { getPublicCategories } from "../../features/siteContent/api/siteContentApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

export default function RenterBrowse() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Item[]>([]);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string | undefined>(undefined);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
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
            setErrorMessage(getApiErrorMessage(err, "Could not load listings."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]);

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    Browse
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
                    Search everything currently available to rent.
                </Paragraph>
            </div>

            <Space wrap>
                <Input.Search
                    placeholder="Search by title or description"
                    allowClear
                    style={{ width: 320 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onSearch={(value) => load(value)}
                />
                <Select
                    allowClear
                    placeholder="Category"
                    style={{ width: 200 }}
                    value={category}
                    onChange={(v) => setCategory(v)}
                >
                    {categories.map((c) => (
                        <Option key={c} value={c}>
                            {c}
                        </Option>
                    ))}
                </Select>
            </Space>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            {loading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
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
                                            style={{ height: 160, objectFit: "cover" }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                height: 160,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background: "#eef3fb",
                                                color: "#94a3b8",
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
                                            <Text strong style={{ color: "#2B2E4A" }}>
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
    );
}

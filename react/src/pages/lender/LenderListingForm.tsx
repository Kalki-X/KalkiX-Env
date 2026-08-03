import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Typography,
    Form,
    Input,
    InputNumber,
    Select,
    Button,
    Card,
    Space,
    Alert,
    Spin,
    Divider,
    Switch,
    message,
} from "antd";
import { EnvironmentOutlined, SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import {
    Item,
    ItemFormPayload,
    getItem,
    createItem,
    updateItem,
} from "../../features/listings/api/listingsApi";
import { ITEM_CATEGORIES, CURRENCIES } from "../../features/listings/constants";
import { getApiErrorMessage } from "../../services/api/client";
import ItemImageManager from "../../components/ItemImageManager/ItemImageManager";
import ItemAvailabilityManager from "../../components/ItemAvailabilityManager/ItemAvailabilityManager";

// Leaflet (~330KB) only needs to load for pages that actually render a map — lazy-load
// it into its own chunk instead of pulling it into the main bundle for every visitor.
const LocationPicker = React.lazy(() => import("../../components/LocationPicker/LocationPicker"));

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface FormValues {
    title: string;
    description?: string;
    category?: string;
    pricePerDay: number;
    currency: string;
    pickupAddress?: string;
    cancellationFreeDays?: number;
    cancellationFeePercent?: number;
}

export default function LenderListingForm() {
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;
    const navigate = useNavigate();
    const [form] = Form.useForm<FormValues>();

    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pin, setPin] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
    const [policyEnabled, setPolicyEnabled] = useState(false);

    useEffect(() => {
        if (!isEdit) return;
        setLoading(true);
        getItem(Number(id))
            .then((loaded) => {
                setItem(loaded);
                setPin({ lat: loaded.pickupLat, lng: loaded.pickupLng });
                const hasPolicy = loaded.cancellationFreeDays !== null && loaded.cancellationFeePercent !== null;
                setPolicyEnabled(hasPolicy);
                form.setFieldsValue({
                    title: loaded.title,
                    description: loaded.description || undefined,
                    category: loaded.category || undefined,
                    pricePerDay: loaded.pricePerDay,
                    currency: loaded.currency,
                    pickupAddress: loaded.pickupAddress || undefined,
                    cancellationFreeDays: loaded.cancellationFreeDays ?? undefined,
                    cancellationFeePercent: loaded.cancellationFeePercent ?? undefined,
                });
            })
            .catch((err) => setErrorMessage(getApiErrorMessage(err, "Could not load this listing.")))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const useMyLocation = () => {
        if (!navigator.geolocation) {
            message.warning("Your browser doesn't support geolocation — drop a pin on the map instead.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => message.warning("Couldn't get your location — drop a pin on the map instead.")
        );
    };

    const onFinish = async (values: FormValues) => {
        setSaving(true);
        setErrorMessage(null);
        const payload: ItemFormPayload = {
            title: values.title,
            description: values.description,
            category: values.category,
            pricePerDay: values.pricePerDay,
            currency: values.currency,
            pickupAddress: values.pickupAddress,
            pickupLat: pin.lat ?? undefined,
            pickupLng: pin.lng ?? undefined,
            // Explicit null (not undefined) when the toggle is off, so an edit actually
            // clears a previously-set policy instead of leaving it untouched.
            cancellationFreeDays: policyEnabled ? values.cancellationFreeDays : null,
            cancellationFeePercent: policyEnabled ? values.cancellationFeePercent : null,
        };
        try {
            if (isEdit) {
                const updated = await updateItem(Number(id), payload);
                setItem(updated);
                message.success("Listing updated.");
            } else {
                const created = await createItem(payload);
                message.success("Listing created — now add photos and availability below.");
                navigate(`/lender/listings/${created.id}/edit`, { replace: true });
            }
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not save this listing."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
            </div>
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate("/lender/listings")}
                    style={{ paddingLeft: 0, marginBottom: 4 }}
                >
                    Back to my listings
                </Button>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    {isEdit ? `Edit "${item?.title ?? ""}"` : "Add a listing"}
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
                    {isEdit
                        ? "Update details, photos, and availability for this item."
                        : "Fill in the basics first — you can add photos and set availability once it's created."}
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Card title="Details">
                <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
                    <Form.Item label="Title" name="title" rules={[{ required: true, message: "Title is required" }]}>
                        <Input size="large" placeholder="e.g. Cordless drill" />
                    </Form.Item>
                    <Form.Item label="Description" name="description">
                        <TextArea rows={4} placeholder="Condition, what's included, any usage notes..." />
                    </Form.Item>
                    <Space size="large" style={{ display: "flex" }} wrap>
                        <Form.Item label="Category" name="category" style={{ minWidth: 220 }}>
                            <Select placeholder="Select a category" allowClear>
                                {ITEM_CATEGORIES.map((c) => (
                                    <Option key={c} value={c}>
                                        {c}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            label="Price per day"
                            name="pricePerDay"
                            rules={[{ required: true, message: "Price is required" }]}
                        >
                            <InputNumber min={0} precision={2} style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item label="Currency" name="currency" initialValue="USD">
                            <Select style={{ width: 100 }}>
                                {CURRENCIES.map((c) => (
                                    <Option key={c} value={c}>
                                        {c}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Space>

                    <Divider />

                    <Form.Item label="Pickup address" name="pickupAddress">
                        <Input size="large" placeholder="e.g. 123 Main St, Springfield" />
                    </Form.Item>
                    <Form.Item label={<Space><EnvironmentOutlined /> Pin the pickup location on the map (optional)</Space>}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                            <Button size="small" onClick={useMyLocation}>
                                Use my current location
                            </Button>
                            <React.Suspense fallback={<Spin />}>
                                <LocationPicker lat={pin.lat} lng={pin.lng} onChange={(lat, lng) => setPin({ lat, lng })} />
                            </React.Suspense>
                            {pin.lat !== null && (
                                <Button size="small" type="link" onClick={() => setPin({ lat: null, lng: null })}>
                                    Clear pin
                                </Button>
                            )}
                        </Space>
                    </Form.Item>

                    <Divider />

                    <Form.Item label="Cancellation policy (optional)">
                        <Space direction="vertical" style={{ width: "100%" }}>
                            <Switch
                                checked={policyEnabled}
                                onChange={setPolicyEnabled}
                                checkedChildren="Policy set"
                                unCheckedChildren="No policy"
                            />
                            {!policyEnabled && (
                                <Paragraph style={{ color: "#94a3b8", fontSize: 13, marginBottom: 0 }}>
                                    Without a policy, cancelling a paid booking always issues a full refund (credit note).
                                </Paragraph>
                            )}
                            {policyEnabled && (
                                <Space size="large" wrap>
                                    <Form.Item
                                        label="Free cancellation up to (days before start)"
                                        name="cancellationFreeDays"
                                        rules={[{ required: policyEnabled, message: "Required when a policy is set" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <InputNumber min={0} precision={0} style={{ width: 140 }} />
                                    </Form.Item>
                                    <Form.Item
                                        label="Fee after that (%)"
                                        name="cancellationFeePercent"
                                        rules={[{ required: policyEnabled, message: "Required when a policy is set" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <InputNumber min={0} max={100} precision={2} style={{ width: 140 }} />
                                    </Form.Item>
                                </Space>
                            )}
                        </Space>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                            {isEdit ? "Save changes" : "Create listing"}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {isEdit && item && (
                <>
                    <Card title="Photos">
                        <ItemImageManager itemId={item.id} />
                    </Card>
                    <Card title="Availability">
                        <ItemAvailabilityManager itemId={item.id} />
                    </Card>
                </>
            )}
        </Space>
    );
}

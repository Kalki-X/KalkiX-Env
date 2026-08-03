import React, { useEffect, useState } from "react";
import { Upload, Button, Image, Space, Popconfirm, message, Spin } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { UploadRequestOption } from "@rc-component/upload/lib/interface";
import {
    ItemImage,
    itemImageUrl,
    listItemImages,
    uploadItemImage,
    deleteItemImage,
} from "../../features/listings/api/listingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const MAX_IMAGES = 8;

// Manages photos for one listing. Only usable once the listing exists (image endpoints
// are scoped under /api/items/:id/images), so this only ever renders for an item that's
// already been created.
export default function ItemImageManager({ itemId }: { itemId: number }) {
    const [images, setImages] = useState<ItemImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setImages(await listItemImages(itemId));
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not load images."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    const customRequest = async (options: UploadRequestOption) => {
        setUploading(true);
        try {
            await uploadItemImage(itemId, options.file as File);
            options.onSuccess?.({});
            load();
        } catch (err) {
            options.onError?.(err as Error);
            message.error(getApiErrorMessage(err, "Could not upload that image."));
        } finally {
            setUploading(false);
        }
    };

    const onDelete = async (imageId: number) => {
        try {
            await deleteItemImage(itemId, imageId);
            message.success("Image removed.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not remove that image."));
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 24 }}>
                <Spin />
            </div>
        );
    }

    return (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Space wrap size="middle">
                {images.map((img) => (
                    <div key={img.id} style={{ position: "relative" }}>
                        <Image
                            src={itemImageUrl(itemId, img.id)}
                            width={100}
                            height={100}
                            style={{ objectFit: "cover", borderRadius: 8 }}
                        />
                        <Popconfirm title="Remove this photo?" onConfirm={() => onDelete(img.id)}>
                            <Button
                                danger
                                size="small"
                                shape="circle"
                                icon={<DeleteOutlined />}
                                style={{ position: "absolute", top: -8, right: -8 }}
                            />
                        </Popconfirm>
                    </div>
                ))}
                {images.length < MAX_IMAGES && (
                    <Upload
                        accept="image/*"
                        showUploadList={false}
                        customRequest={customRequest}
                        disabled={uploading}
                    >
                        <Button
                            icon={<PlusOutlined />}
                            loading={uploading}
                            style={{ width: 100, height: 100 }}
                        >
                            Add photo
                        </Button>
                    </Upload>
                )}
            </Space>
            <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
                {images.length}/{MAX_IMAGES} photos. The first photo is used as the listing's thumbnail.
            </span>
        </Space>
    );
}

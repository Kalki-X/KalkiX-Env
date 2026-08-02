import React, { useState } from "react";
import { Dropdown, Button, message } from "antd";
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { ExportColumn, ExportFormat, runExport } from "../../utils/exportTable";

interface ExportButtonProps<T> {
    // Fetches every row matching the currently active filters (not just the current
    // page) at export time, so the file reflects the full filtered result set.
    fetchAll: () => Promise<T[]>;
    columns: ExportColumn<T>[];
    baseName: string;
    title: string;
    disabled?: boolean;
}

export default function ExportButton<T>({ fetchAll, columns, baseName, title, disabled }: ExportButtonProps<T>) {
    const [loading, setLoading] = useState<ExportFormat | null>(null);

    const handleExport = async (format: ExportFormat) => {
        setLoading(format);
        try {
            const rows = await fetchAll();
            if (rows.length === 0) {
                message.warning("No rows match the current filters — nothing to export.");
                return;
            }
            await runExport(format, baseName, title, columns, rows);
        } catch (err) {
            message.error("Export failed. Please try again.");
        } finally {
            setLoading(null);
        }
    };

    const items: MenuProps["items"] = [
        { key: "csv", label: "Export as CSV", icon: <FileTextOutlined /> },
        { key: "excel", label: "Export as Excel", icon: <FileExcelOutlined /> },
        { key: "pdf", label: "Export as PDF", icon: <FilePdfOutlined /> },
    ];

    return (
        <Dropdown
            disabled={disabled}
            menu={{ items, onClick: ({ key }) => handleExport(key as ExportFormat) }}
            trigger={["click"]}
        >
            <Button icon={<DownloadOutlined />} loading={!!loading}>
                Export
            </Button>
        </Dropdown>
    );
}

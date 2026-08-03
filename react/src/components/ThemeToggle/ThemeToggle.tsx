import React from 'react';
import { Segmented } from 'antd';
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useThemeMode, ThemeMode } from '../../features/theme/context/ThemeContext';

/**
 * Light / Dark / System switch. "System" (default) follows the OS preference and
 * updates live if it changes; picking Light or Dark pins it explicitly and is
 * remembered (localStorage) across visits.
 */
export default function ThemeToggle({ block = false }: { block?: boolean }) {
    const { mode, setMode } = useThemeMode();

    return (
        <Segmented
            value={mode}
            onChange={(value) => setMode(value as ThemeMode)}
            block={block}
            options={[
                { label: <SunOutlined />, value: 'light', title: 'Light' },
                { label: <MoonOutlined />, value: 'dark', title: 'Dark' },
                { label: <DesktopOutlined />, value: 'system', title: 'Match system' },
            ]}
        />
    );
}

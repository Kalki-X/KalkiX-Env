import React, { useState } from 'react';
import { siteLogoUrl } from '../../features/siteContent/api/siteContentApi';

interface SiteLogoBadgeProps {
    size?: number;
    borderRadius?: number;
    // Styling for the "GS" fallback badge, shown until an admin uploads a real logo
    // (see Super Admin/Admin > Homepage > Branding & Fees) or if the logo fails to load.
    fallbackBackground?: string;
    fallbackColor?: string;
    fallbackFontSize?: number;
}

/**
 * Wherever the app previously hardcoded a "GS" text badge as a stand-in logo, this
 * renders the admin-uploaded site logo instead (falling back to the same "GS" badge,
 * styled per the props, if none has been uploaded yet or it fails to load). One
 * component so every spot in the app that shows a logo updates the moment an admin
 * uploads one — nothing to keep in sync by hand.
 */
export default function SiteLogoBadge({
    size = 48,
    borderRadius = 14,
    fallbackBackground = '#2B2E4A',
    fallbackColor = '#fff',
    fallbackFontSize,
}: SiteLogoBadgeProps) {
    const [logoOk, setLogoOk] = useState(true);

    if (logoOk) {
        return (
            <img
                src={siteLogoUrl()}
                alt="GearShare"
                onError={() => setLogoOk(false)}
                style={{ width: size, height: size, borderRadius, objectFit: 'contain' }}
            />
        );
    }

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius,
                background: fallbackBackground,
                color: fallbackColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: fallbackFontSize ?? Math.round(size * 0.375),
                flexShrink: 0,
            }}
        >
            GS
        </div>
    );
}

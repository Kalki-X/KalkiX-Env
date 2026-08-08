const { getImageDimensions } = require('./imageDimensions');

// Every image-upload slot the admin UI offers, with its required exact pixel size,
// accepted formats, and max file size. Centralized here so the requirement ("exact
// image size and format") is enforced identically server-side no matter which admin
// screen (branding, categories, carousel) the upload comes from — the frontend also
// shows this same spec as inline help text before the admin picks a file.
const IMAGE_SPECS = {
    logo: {
        label: 'Site logo',
        width: 512,
        height: 512,
        maxBytes: 1 * 1024 * 1024,
        formats: ['image/png'],
        recommendation: 'Square PNG, exactly 512×512px, under 1MB. Transparent background recommended.',
    },
    categoryIcon: {
        label: 'Category icon',
        width: 128,
        height: 128,
        maxBytes: 512 * 1024,
        formats: ['image/png'],
        recommendation: 'Square PNG, exactly 128×128px, under 500KB. Transparent background recommended.',
    },
    carouselSlide: {
        label: 'Carousel image',
        width: 1600,
        height: 600,
        maxBytes: 3 * 1024 * 1024,
        formats: ['image/jpeg', 'image/png'],
        recommendation: 'JPEG or PNG, exactly 1600×600px (8:3 ratio), under 3MB.',
    },
    // Unlike the fixed UI slots above (logo/icon/hero carousel), a homepage content
    // section is freeform CMS-style content — deliberately no exact-pixel requirement
    // here (see validateImageUpload below, which only enforces dimensions when a spec
    // actually defines width/height). The frontend renders it with object-fit: cover
    // inside a fixed-height box, so any reasonable landscape image works.
    homepageSection: {
        label: 'Section image',
        maxBytes: 3 * 1024 * 1024,
        formats: ['image/jpeg', 'image/png'],
        recommendation: 'JPEG or PNG, under 3MB. Landscape images around 1200×630px work best — any size is accepted and will be cropped to fit.',
    },
};

function formatBytes(bytes) {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

// Returns an error message string if the upload doesn't satisfy the spec, or null if
// it's valid. Dimension checks are skipped (not failed) if the format can't be
// parsed by getImageDimensions (shouldn't happen given `formats` is restricted to
// png/jpeg, both of which are parseable).
function validateImageUpload(file, specKey) {
    const spec = IMAGE_SPECS[specKey];
    if (!spec) throw new Error(`Unknown image spec: ${specKey}`);

    if (!spec.formats.includes(file.mimetype)) {
        return `${spec.label} must be ${spec.formats.join(' or ')} (got ${file.mimetype}). ${spec.recommendation}`;
    }
    if (file.size > spec.maxBytes) {
        return `${spec.label} must be under ${formatBytes(spec.maxBytes)} (got ${formatBytes(file.size)}).`;
    }
    // Only enforced when the spec actually pins an exact width/height (logo, category
    // icon, hero carousel) — a spec like homepageSection that omits these skips this
    // check entirely, allowing any dimensions.
    if (spec.width && spec.height) {
        const dims = getImageDimensions(file.buffer, file.mimetype);
        if (dims && (dims.width !== spec.width || dims.height !== spec.height)) {
            return `${spec.label} must be exactly ${spec.width}×${spec.height}px (got ${dims.width}×${dims.height}px).`;
        }
    }
    return null;
}

module.exports = { IMAGE_SPECS, validateImageUpload };

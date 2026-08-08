const express = require('express');
const multer = require('multer');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { validateImageUpload, IMAGE_SPECS } = require('../utils/imageSpecs');
const {
    getSettings,
    updateSettings,
    setLogo,
    clearLogo,
} = require('../models/siteSettingsModel');
const {
    listCategories,
    findCategoryById,
    createCategory,
    updateCategory,
    setCategoryIcon,
    countItemsUsingCategory,
    deleteCategory,
} = require('../models/categoryModel');
const {
    listSlides,
    findSlideById,
    createSlide,
    updateSlide,
    replaceSlideImage,
    deleteSlide,
} = require('../models/carouselModel');
const { listAllFeatured, findFeaturedById, cancelFeaturedSlot } = require('../models/featuredListingModel');

const router = express.Router();

// Site branding/marketplace-homepage management. Per the feature request, both Super
// Admin and Admin can do all of this (unlike most of admin.routes.js, which is Super
// Admin only) — matching the same RBAC precedent as email templates.
router.use(attachUser, requireAuth, requireRole('super_admin', 'admin'));

// Images live as bytea rows in Postgres (same pattern as item photos/avatars) — multer
// just needs to hand us the raw buffer, no disk staging. The 3MB cap here is the
// largest of the three specs (carousel); each route re-validates against its own exact
// spec via validateImageUpload.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
        cb(null, true);
    },
});

// ---------- Settings (logo, platform fee, featured-listing price) ----------

router.get('/settings', async (_req, res) => {
    res.json({ ok: true, settings: await getSettings(), imageSpecs: IMAGE_SPECS });
});

// Company/invoice fields shown on every generated PDF document (Phase 11) — the
// right-hand "issued by" block plus the repeating footer. Everything here is optional
// free text except companyLegalName, which the DB column requires (NOT NULL, so an
// admin clearing it out entirely would otherwise surface as a raw 500 from the
// constraint instead of a friendly validation message).
const COMPANY_FIELDS = [
    'companyLegalName',
    'companyAddressLine1',
    'companyAddressLine2',
    'companyCity',
    'companyState',
    'companyPostalCode',
    'companyCountry',
    'companyVatNumber',
    'companyEmail',
    'companyPhone',
];

router.put('/settings', async (req, res) => {
    const { platformFeePercent, featuredListingPricePerDay, featuredListingCurrency } = req.body || {};
    if (platformFeePercent !== undefined && (Number(platformFeePercent) < 0 || Number(platformFeePercent) > 100)) {
        return res.status(400).json({ ok: false, error: 'platformFeePercent must be between 0 and 100' });
    }
    if (featuredListingPricePerDay !== undefined && Number(featuredListingPricePerDay) < 0) {
        return res.status(400).json({ ok: false, error: 'featuredListingPricePerDay must be >= 0' });
    }
    if (req.body?.companyLegalName !== undefined && !String(req.body.companyLegalName).trim()) {
        return res.status(400).json({ ok: false, error: 'companyLegalName cannot be empty' });
    }

    const companyFields = {};
    for (const field of COMPANY_FIELDS) {
        if (req.body?.[field] !== undefined) companyFields[field] = req.body[field];
    }

    const updated = await updateSettings(
        { platformFeePercent, featuredListingPricePerDay, featuredListingCurrency, ...companyFields },
        req.user.id
    );

    await logAudit({
        userId: req.user.id,
        action: 'site_settings.updated',
        entityType: 'site_settings',
        metadata: { platformFeePercent, featuredListingPricePerDay, featuredListingCurrency, ...companyFields },
        ip: clientIp(req),
    });

    res.json({ ok: true, settings: updated });
});

router.post('/settings/logo', upload.single('logo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "logo")' });

    const error = validateImageUpload(req.file, 'logo');
    if (error) return res.status(400).json({ ok: false, error });

    const updated = await setLogo({ mimeType: req.file.mimetype, data: req.file.buffer }, req.user.id);

    await logAudit({ userId: req.user.id, action: 'site_settings.logo_updated', entityType: 'site_settings', ip: clientIp(req) });

    res.json({ ok: true, settings: updated });
});

router.delete('/settings/logo', async (req, res) => {
    const updated = await clearLogo(req.user.id);
    await logAudit({ userId: req.user.id, action: 'site_settings.logo_removed', entityType: 'site_settings', ip: clientIp(req) });
    res.json({ ok: true, settings: updated });
});

// ---------- Categories ----------

router.get('/categories', async (_req, res) => {
    res.json({ ok: true, categories: await listCategories({ activeOnly: false }) });
});

router.post('/categories', async (req, res) => {
    const { name, sortOrder } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' });

    let category;
    try {
        category = await createCategory({ name: name.trim(), sortOrder }, req.user.id);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ ok: false, error: 'A category with this name already exists' });
        throw err;
    }

    await logAudit({ userId: req.user.id, action: 'category.created', entityType: 'category', entityId: category.id, metadata: { name: category.name }, ip: clientIp(req) });
    res.status(201).json({ ok: true, category });
});

router.patch('/categories/:id', async (req, res) => {
    const existing = await findCategoryById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Category not found' });

    const { name, sortOrder, active } = req.body || {};
    if (name !== undefined && !name.trim()) return res.status(400).json({ ok: false, error: 'name cannot be empty' });

    let category;
    try {
        category = await updateCategory(req.params.id, { name: name?.trim(), sortOrder, active }, req.user.id);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ ok: false, error: 'A category with this name already exists' });
        throw err;
    }

    await logAudit({ userId: req.user.id, action: 'category.updated', entityType: 'category', entityId: category.id, metadata: { name, sortOrder, active }, ip: clientIp(req) });
    res.json({ ok: true, category });
});

router.post('/categories/:id/icon', upload.single('icon'), async (req, res) => {
    const existing = await findCategoryById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Category not found' });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "icon")' });

    const error = validateImageUpload(req.file, 'categoryIcon');
    if (error) return res.status(400).json({ ok: false, error });

    const category = await setCategoryIcon(req.params.id, { mimeType: req.file.mimetype, data: req.file.buffer }, req.user.id);

    await logAudit({ userId: req.user.id, action: 'category.icon_updated', entityType: 'category', entityId: category.id, ip: clientIp(req) });
    res.json({ ok: true, category });
});

// Categories in active use by at least one listing are only ever soft-deactivated
// (PATCH active=false) so existing listings never point at a vanished category — hard
// delete is only offered here when nothing references it.
router.delete('/categories/:id', async (req, res) => {
    const existing = await findCategoryById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Category not found' });

    const inUse = await countItemsUsingCategory(existing.name);
    if (inUse > 0) {
        return res.status(409).json({
            ok: false,
            error: `${inUse} listing(s) currently use this category. Deactivate it instead of deleting.`,
        });
    }

    await deleteCategory(req.params.id);
    await logAudit({ userId: req.user.id, action: 'category.deleted', entityType: 'category', entityId: Number(req.params.id), metadata: { name: existing.name }, ip: clientIp(req) });
    res.json({ ok: true });
});

// ---------- Carousel ----------

router.get('/carousel', async (_req, res) => {
    res.json({ ok: true, slides: await listSlides({ activeOnly: false }) });
});

router.post('/carousel', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "image")' });

    const error = validateImageUpload(req.file, 'carouselSlide');
    if (error) return res.status(400).json({ ok: false, error });

    const { headline, subtext, linkUrl, sortOrder } = req.body || {};
    const slide = await createSlide(
        { headline, subtext, linkUrl, sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined, mimeType: req.file.mimetype, data: req.file.buffer },
        req.user.id
    );

    await logAudit({ userId: req.user.id, action: 'carousel_slide.created', entityType: 'carousel_slide', entityId: slide.id, ip: clientIp(req) });
    res.status(201).json({ ok: true, slide });
});

router.patch('/carousel/:id', async (req, res) => {
    const existing = await findSlideById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Slide not found' });

    const { headline, subtext, linkUrl, sortOrder, active } = req.body || {};
    const slide = await updateSlide(
        req.params.id,
        { headline, subtext, linkUrl, sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined, active },
        req.user.id
    );

    await logAudit({ userId: req.user.id, action: 'carousel_slide.updated', entityType: 'carousel_slide', entityId: slide.id, ip: clientIp(req) });
    res.json({ ok: true, slide });
});

router.post('/carousel/:id/image', upload.single('image'), async (req, res) => {
    const existing = await findSlideById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Slide not found' });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "image")' });

    const error = validateImageUpload(req.file, 'carouselSlide');
    if (error) return res.status(400).json({ ok: false, error });

    const slide = await replaceSlideImage(req.params.id, { mimeType: req.file.mimetype, data: req.file.buffer }, req.user.id);

    await logAudit({ userId: req.user.id, action: 'carousel_slide.image_replaced', entityType: 'carousel_slide', entityId: slide.id, ip: clientIp(req) });
    res.json({ ok: true, slide });
});

router.delete('/carousel/:id', async (req, res) => {
    const existing = await findSlideById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Slide not found' });

    await deleteSlide(req.params.id);
    await logAudit({ userId: req.user.id, action: 'carousel_slide.deleted', entityType: 'carousel_slide', entityId: Number(req.params.id), ip: clientIp(req) });
    res.json({ ok: true });
});

// ---------- Featured listings (oversight / manual unfeature) ----------
// Lenders purchase their own featured slot from POST /api/items/:id/feature
// (listings.routes.js) — this is the admin-side view + the ability to pull a slot
// early without waiting for it to expire naturally.

router.get('/featured', async (req, res) => {
    const activeOnly = req.query.activeOnly === '1' || req.query.activeOnly === 'true';
    res.json({ ok: true, featured: await listAllFeatured({ activeOnly }) });
});

router.delete('/featured/:id', async (req, res) => {
    const existing = await findFeaturedById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Featured slot not found' });

    const cancelled = await cancelFeaturedSlot(req.params.id);
    await logAudit({ userId: req.user.id, action: 'featured_listing.cancelled', entityType: 'featured_listing', entityId: cancelled.id, metadata: { itemId: cancelled.itemId }, ip: clientIp(req) });
    res.json({ ok: true, featured: cancelled });
});

// Multer errors (oversized file, wrong mimetype) reach here as regular thrown errors.
router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError || (err && /image files/i.test(err.message))) {
        return res.status(400).json({ ok: false, error: err.message });
    }
    next(err);
});

module.exports = router;

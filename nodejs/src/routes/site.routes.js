const express = require('express');
const { getLogoWithData } = require('../models/siteSettingsModel');
const { listCategories, getCategoryIconWithData } = require('../models/categoryModel');
const { listSlides, getSlideImageWithData } = require('../models/carouselModel');
const { listActiveFeaturedItems } = require('../models/featuredListingModel');
const { listActiveItems } = require('../models/itemModel');
const { listSections, getSectionImageWithData } = require('../models/homepageSectionModel');
const { listNotices } = require('../models/siteNoticeModel');

const router = express.Router();

// Everything under here is PUBLIC — this is what powers the unauthenticated marketplace
// homepage (logo, category tiles, hero carousel, trending rail), so none of it requires
// a login. Admin-only writes live in adminSite.routes.js instead.

router.get('/logo', async (_req, res) => {
    const logo = await getLogoWithData();
    if (!logo) return res.status(404).end();
    res.set('Content-Type', logo.mimeType);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(logo.data);
});

router.get('/categories', async (_req, res) => {
    const categories = await listCategories({ activeOnly: true });
    res.json({ ok: true, categories });
});

router.get('/categories/:id/icon', async (req, res) => {
    const icon = await getCategoryIconWithData(req.params.id);
    if (!icon) return res.status(404).end();
    res.set('Content-Type', icon.mimeType);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(icon.data);
});

router.get('/carousel', async (_req, res) => {
    const slides = await listSlides({ activeOnly: true });
    res.json({ ok: true, slides });
});

router.get('/carousel/:id/image', async (req, res) => {
    const image = await getSlideImageWithData(req.params.id);
    if (!image) return res.status(404).end();
    res.set('Content-Type', image.mimeType);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(image.data);
});

// Trending rail: paid-featured items first; if there are fewer than `limit`, backfill
// with the most recently listed active items so the homepage section never looks empty
// just because nobody has purchased a featured slot yet.
router.get('/trending', async (req, res) => {
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const featured = await listActiveFeaturedItems(limit);
    let items = featured;
    if (items.length < limit) {
        const featuredIds = new Set(items.map((i) => i.id));
        const recent = await listActiveItems({});
        const backfill = recent.filter((i) => !featuredIds.has(i.id)).slice(0, limit - items.length);
        items = [...items, ...backfill.map((i) => ({ ...i, featuredUntil: null }))];
    }
    res.json({ ok: true, items });
});

// Freeform homepage content sections (Phase 12) — active only, in display order.
router.get('/sections', async (_req, res) => {
    const sections = await listSections({ activeOnly: true });
    res.json({ ok: true, sections });
});

router.get('/sections/:id/image', async (req, res) => {
    const image = await getSectionImageWithData(req.params.id);
    if (!image) return res.status(404).end();
    res.set('Content-Type', image.mimeType);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(image.data);
});

// Site notices (Phase 12) — active only, filtered to whichever audience the caller
// says it's rendering for. `?audience=public` (the logged-out homepage) only gets
// notices targeted at 'public' or 'both'; `?audience=platform_users` (the logged-in
// dashboard) only gets 'platform_users' or 'both'. Omitting it returns every active
// notice regardless of audience. This lives on the public router (not behind auth)
// since both the homepage and the dashboard need it, and the dashboard's own auth is
// handled separately by whatever page embeds the banner.
router.get('/notices', async (req, res) => {
    const { audience } = req.query;
    const notices = await listNotices({ activeOnly: true, audience: typeof audience === 'string' ? audience : undefined });
    res.json({ ok: true, notices });
});

module.exports = router;

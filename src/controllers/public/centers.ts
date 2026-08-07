import { Request, Response } from 'express';
import { query } from '../../config/database';

/**
 * GET /api/centers/:slug/info
 * Public endpoint — no auth required.
 * Returns center display info for branded login pages.
 */
export const getCenterInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const result = await query(
      'SELECT name, logo_url, slug FROM centers WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    const center = result.rows[0];

    res.status(200).json({
      name: center.name,
      logoUrl: center.logo_url,
      slug: center.slug,
    });
  } catch (error) {
    console.error('[PUBLIC/CENTERS] Error fetching center info:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

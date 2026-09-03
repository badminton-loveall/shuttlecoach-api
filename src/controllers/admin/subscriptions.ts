import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import {
  activateSubscription,
  deactivateSubscription,
  getActiveSubscriptions,
  hasActiveSubscription,
} from '../../services/subscriptionService';

/**
 * GET /api/admin/centers/:id/subscriptions
 * A center's active marketplace subscriptions.
 */
export const listCenterSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const subscriptions = await getActiveSubscriptions(id);
    res.status(200).json(subscriptions);
  } catch (error) {
    console.error('List center subscriptions error:', error);
    res.status(500).json({ error: 'An error occurred while listing subscriptions' });
  }
};

/**
 * POST /api/admin/centers/:id/subscriptions
 * Admin-assisted activation: the center paid offline, admin records it here.
 * Same shape as toggleCenterActivation — one admin action, no payment gateway.
 */
export const activateCenterSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.params.id as string;
    const { marketplaceItemId, priceOverride, expiresAt } = req.body;

    if (!marketplaceItemId) {
      res.status(400).json({ error: 'marketplaceItemId is required' });
      return;
    }

    const itemResult = await query('SELECT id, is_enabled FROM marketplace_items WHERE id = $1', [
      marketplaceItemId,
    ]);
    if (itemResult.rowCount === 0) {
      res.status(404).json({ error: 'Marketplace item not found' });
      return;
    }
    if (!itemResult.rows[0].is_enabled) {
      res.status(409).json({ error: 'This item is not currently available for sale' });
      return;
    }

    if (await hasActiveSubscription(centerId, marketplaceItemId)) {
      res.status(409).json({ error: 'This center already has an active subscription to this item' });
      return;
    }

    const subscription = await activateSubscription(centerId, marketplaceItemId, req.user!.id, {
      priceOverride,
      expiresAt,
    });

    // Clean up a stale request — the item is active now via this direct path,
    // so any pending request for the same item would otherwise sit orphaned.
    await query(
      `UPDATE center_subscriptions SET status = 'REJECTED', updated_at = NOW()
       WHERE center_id = $1 AND marketplace_item_id = $2 AND status = 'PENDING'`,
      [centerId, marketplaceItemId]
    );

    res.status(201).json(subscription);
  } catch (error) {
    console.error('Activate center subscription error:', error);
    res.status(500).json({ error: 'An error occurred while activating the subscription' });
  }
};

/**
 * PATCH /api/admin/centers/:id/subscriptions/:marketplaceItemId/cancel
 * Admin cancels a center's active subscription to one item. Soft — the
 * record stays for history, drill content and copies are untouched.
 */
export const cancelCenterSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.params.id as string;
    const marketplaceItemId = req.params.marketplaceItemId as string;

    const subscription = await deactivateSubscription(centerId, marketplaceItemId);

    if (!subscription) {
      res.status(404).json({ error: 'Active subscription not found' });
      return;
    }

    res.status(200).json(subscription);
  } catch (error) {
    console.error('Cancel center subscription error:', error);
    res.status(500).json({ error: 'An error occurred while cancelling the subscription' });
  }
};

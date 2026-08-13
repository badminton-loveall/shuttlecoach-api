import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * POST /api/drills
 * Create a new drill
 * Requires: HEAD_COACH role
 */
export const createDrill = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, category, sport } = req.body;
    const drillSport = sport || 'badminton';

    const result = await query(
      `INSERT INTO drills (name, description, category, sport, center_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, category, sport, is_archived, created_at, updated_at`,
      [name, description, category, drillSport, req.tenantCenterId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create drill error:', error);
    res.status(500).json({
      error: 'An error occurred while creating drill',
    });
  }
};

/**
 * GET /api/drills
 * List non-archived drills with optional category filter and name search
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listDrills = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { category, search } = req.query;
    const conditions: string[] = ['is_archived = false'];
    const params: any[] = [];
    let paramIndex = 1;

    // Tenant scoping: always filter by center_id to exclude global drills (center_id IS NULL)
    conditions.push(`center_id = $${paramIndex}`);
    params.push(req.tenantCenterId);
    paramIndex++;

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (search) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT id, name, description, category, sport, created_at, updated_at
       FROM drills
       WHERE ${conditions.join(' AND ')}
       ORDER BY category, name`,
      params
    );

    res.status(200).json({ drills: result.rows });
  } catch (error) {
    console.error('List drills error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching drills',
    });
  }
};

/**
 * PATCH /api/drills/:id
 * Update a drill with partial data
 * Requires: HEAD_COACH role
 */
export const updateDrill = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const allowedFields: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
      sport: 'sport',
    };

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(allowedFields).forEach(([bodyKey, dbColumn]) => {
      if (req.body[bodyKey] !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        params.push(req.body[bodyKey]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    params.push(id);

    // Build WHERE clause with tenant scoping (always enforced to exclude global drills)
    const whereConditions = [`id = $${paramIndex}`, 'is_archived = false'];
    paramIndex++;

    whereConditions.push(`center_id = $${paramIndex}`);
    params.push(req.tenantCenterId);
    paramIndex++;

    const result = await query(
      `UPDATE drills
       SET ${updates.join(', ')}
       WHERE ${whereConditions.join(' AND ')}
       RETURNING id, name, description, category, sport, is_archived, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Drill not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update drill error:', error);
    res.status(500).json({
      error: 'An error occurred while updating drill',
    });
  }
};

/**
 * DELETE /api/drills/:id
 * Archive a drill (soft-delete)
 * Requires: HEAD_COACH role
 */
export const archiveDrill = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Build WHERE clause with tenant scoping (always enforced to exclude global drills)
    const conditions = ['id = $1', 'is_archived = false', 'center_id = $2'];
    const params: any[] = [id, req.tenantCenterId];

    const result = await query(
      `UPDATE drills SET is_archived = true
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Drill not found' });
      return;
    }

    res.status(200).json({ message: 'Drill archived successfully' });
  } catch (error) {
    console.error('Archive drill error:', error);
    res.status(500).json({
      error: 'An error occurred while archiving drill',
    });
  }
};

/**
 * POST /api/drills/adopt
 * Adopt a global drill into the center's library
 * Requires: HEAD_COACH role
 */
export const adoptDrill = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { drillId } = req.body;
    const centerId = req.tenantCenterId;

    // 1. Verify the global drill exists and is not archived
    const globalDrillResult = await query(
      `SELECT * FROM drills WHERE id = $1 AND center_id IS NULL AND is_archived = false`,
      [drillId]
    );

    if (globalDrillResult.rowCount === 0) {
      res.status(404).json({ error: 'Drill not found or is no longer available' });
      return;
    }

    const globalDrill = globalDrillResult.rows[0];

    // 2. Check if already adopted by this center
    const existingAdoption = await query(
      `SELECT id FROM drills WHERE center_id = $1 AND source_drill_id = $2`,
      [centerId, drillId]
    );

    if (existingAdoption.rowCount! > 0) {
      res.status(409).json({ error: 'This drill has already been adopted by your center' });
      return;
    }

    // 3. Create the center drill copy with lineage reference
    const result = await query(
      `INSERT INTO drills (name, description, category, sport, center_id, source_drill_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, category, sport, source_drill_id, created_at, updated_at`,
      [globalDrill.name, globalDrill.description, globalDrill.category, globalDrill.sport, centerId, drillId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Adopt drill error:', error);
    res.status(500).json({
      error: 'An error occurred while adopting drill',
    });
  }
};

/**
 * GET /api/drills/marketplace
 * Browse global drills filtered by the requesting center's sport.
 * Excludes drills already adopted by the center.
 * Supports optional category and search (name) filters.
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listMarketplaceDrills = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;

    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    // 1. Look up the center's configured sport
    const centerResult = await query(
      'SELECT sport FROM centers WHERE id = $1',
      [centerId]
    );

    if (centerResult.rows.length === 0) {
      res.status(500).json({ error: 'Failed to resolve center configuration' });
      return;
    }

    const centerSport: string | null = centerResult.rows[0].sport;

    // 2. Build marketplace query for global drills
    const conditions: string[] = [
      'center_id IS NULL',
      'is_archived = false',
    ];
    const params: any[] = [];
    let paramIndex = 1;

    // 3. Filter by center's sport (if configured)
    if (centerSport) {
      conditions.push(`sport = $${paramIndex}`);
      params.push(centerSport);
      paramIndex++;
    }

    // 4. Exclude already-adopted drills
    conditions.push(
      `id NOT IN (SELECT source_drill_id FROM drills WHERE center_id = $${paramIndex} AND source_drill_id IS NOT NULL)`
    );
    params.push(centerId);
    paramIndex++;

    // 5. Apply optional category filter
    const { category, search } = req.query;

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // 6. Apply optional search filter (name ILIKE)
    if (search) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // 7. Execute query ordered by category, name
    const result = await query(
      `SELECT id, name, description, category, sport, created_at, updated_at
       FROM drills
       WHERE ${conditions.join(' AND ')}
       ORDER BY category, name`,
      params
    );

    res.status(200).json({ drills: result.rows });
  } catch (error) {
    console.error('List marketplace drills error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching marketplace drills',
    });
  }
};

/**
 * POST /api/drills/adopt-all
 * Adopt all available global drills for the center's sport in one go.
 * Skips drills already adopted by the center.
 * Requires: HEAD_COACH role
 */
export const adoptAllDrills = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;

    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    // 1. Look up center's sport
    const centerResult = await query(
      'SELECT sport FROM centers WHERE id = $1',
      [centerId]
    );

    if (centerResult.rows.length === 0) {
      res.status(500).json({ error: 'Failed to resolve center configuration' });
      return;
    }

    const centerSport: string | null = centerResult.rows[0].sport;

    // 2. Find all global drills matching sport that haven't been adopted yet
    const conditions: string[] = [
      'center_id IS NULL',
      'is_archived = false',
    ];
    const params: any[] = [];
    let paramIndex = 1;

    if (centerSport) {
      conditions.push(`sport = $${paramIndex}`);
      params.push(centerSport);
      paramIndex++;
    }

    // Exclude already adopted
    conditions.push(
      `id NOT IN (SELECT source_drill_id FROM drills WHERE center_id = $${paramIndex} AND source_drill_id IS NOT NULL)`
    );
    params.push(centerId);
    paramIndex++;

    const availableResult = await query(
      `SELECT id, name, description, category, sport
       FROM drills
       WHERE ${conditions.join(' AND ')}
       ORDER BY category, name`,
      params
    );

    if (availableResult.rows.length === 0) {
      res.status(200).json({ adopted: 0, message: 'All drills have already been adopted' });
      return;
    }

    // 3. Bulk insert all drills as center drills
    const values: string[] = [];
    const insertParams: any[] = [];
    let insertIndex = 1;

    for (const drill of availableResult.rows) {
      values.push(`($${insertIndex}, $${insertIndex + 1}, $${insertIndex + 2}, $${insertIndex + 3}, $${insertIndex + 4}, $${insertIndex + 5})`);
      insertParams.push(drill.name, drill.description, drill.category, drill.sport, centerId, drill.id);
      insertIndex += 6;
    }

    const insertResult = await query(
      `INSERT INTO drills (name, description, category, sport, center_id, source_drill_id)
       VALUES ${values.join(', ')}
       RETURNING id, name, category, sport`,
      insertParams
    );

    res.status(201).json({
      adopted: insertResult.rowCount,
      message: `Successfully adopted ${insertResult.rowCount} drills into your library`,
      drills: insertResult.rows,
    });
  } catch (error) {
    console.error('Adopt all drills error:', error);
    res.status(500).json({
      error: 'An error occurred while adopting drills',
    });
  }
};

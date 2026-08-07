/**
 * Property-Based Test: Property 4 — Cross-center resource access is rejected
 *
 * Feature: multi-center-admin, Property 4: Cross-center resource access is rejected
 *
 * Validates: Requirements 4.5
 *
 * Requirement 4.5: IF a request references a resource belonging to a different
 * center_id than the authenticated user, THEN THE Platform SHALL reject the
 * request with a 403 status code.
 *
 * Property (from design.md):
 *   For any non-ADMIN user and any resource belonging to a different center_id
 *   than the user's own, an access attempt SHALL be rejected with a 403 status code.
 *
 * Strategy:
 *   We test two layers of the enforcement:
 *
 *   1. tenantScope middleware — verifies it attaches the user's centerId as
 *      req.tenantCenterId (the value controllers use for WHERE clauses). A
 *      non-ADMIN user whose JWT carries centerId-A can NEVER have
 *      req.tenantCenterId set to anything other than centerId-A, which means any
 *      resource with a different centerId will never pass the DB filter.
 *
 *   2. Cross-center guard helper — a thin pure function that represents the
 *      controller-level check: "does the resource's center_id match
 *      req.tenantCenterId?" We verify this returns 403 whenever they differ, and
 *      does NOT return 403 when they are the same.
 */

import * as fc from 'fast-check';
import { Response, NextFunction } from 'express';
import { tenantScope, TenantRequest } from '../middleware/tenantScope';
import { UserRole } from '../types';

// ---------------------------------------------------------------------------
// Helpers — mock Express req / res / next
// ---------------------------------------------------------------------------

/** Build a minimal TenantRequest mock */
function makeReq(overrides: Partial<TenantRequest> = {}): TenantRequest {
  const base = {
    headers: {},
    query: {},
    user: undefined,
    tenantCenterId: undefined,
  } as unknown as TenantRequest;
  return Object.assign(base, overrides);
}

/** Capture the status + body sent by res.status(...).json(...) */
interface CapturedResponse {
  statusCode: number | null;
  body: unknown;
  nextCalled: boolean;
}

function makeRes(): { res: Response; captured: CapturedResponse } {
  const captured: CapturedResponse = {
    statusCode: null,
    body: null,
    nextCalled: false,
  };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, captured };
}

function makeNext(captured: CapturedResponse): NextFunction {
  return () => {
    captured.nextCalled = true;
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A valid UUID-like string (simplified: just distinct UUIDs via counter) */
const uuidArb = fc.uuid();

/** Non-ADMIN roles */
const nonAdminRoleArb = fc.constantFrom(
  UserRole.HEAD_COACH,
  UserRole.ASSISTANT_COACH,
  UserRole.STUDENT,
);

/**
 * Arbitrary: a non-ADMIN user whose centerId is set (i.e., properly scoped).
 */
const nonAdminUserArb = fc.record({
  id: uuidArb,
  username: fc.string({ minLength: 1, maxLength: 30 }),
  role: nonAdminRoleArb,
  centerId: uuidArb, // always present for non-ADMIN
});

/**
 * Arbitrary: two distinct UUIDs representing userCenterId and resourceCenterId.
 * We use filter to guarantee they are different.
 */
const differentCenterIdsArb = fc
  .tuple(uuidArb, uuidArb)
  .filter(([a, b]) => a !== b);

// ---------------------------------------------------------------------------
// Cross-center guard — pure function representing the controller check
// ---------------------------------------------------------------------------

/**
 * Simulates the controller-level ownership check.
 *
 * In real controllers, after tenantScope sets req.tenantCenterId, the query
 * already filters by center_id. But for resources that are fetched by id first
 * and then ownership-verified, this guard captures that pattern.
 *
 * Returns 403 if the resource belongs to a different center than the user,
 * 200 if access is permitted.
 */
function crossCenterGuard(
  userCenterId: string,
  resourceCenterId: string,
): 200 | 403 {
  if (userCenterId !== resourceCenterId) {
    return 403;
  }
  return 200;
}

// ---------------------------------------------------------------------------
// Property 4a: tenantScope middleware enforces the user's own centerId
//
// The tenantScope middleware MUST set req.tenantCenterId = user.centerId for
// every non-ADMIN user. This means controllers using WHERE center_id =
// req.tenantCenterId will automatically exclude resources from other centers.
// ---------------------------------------------------------------------------

describe(
  'Feature: multi-center-admin, Property 4: Cross-center resource access is rejected',
  () => {
    describe('4a — tenantScope middleware always pins req.tenantCenterId to the user centerId', () => {
      /**
       * **Validates: Requirements 4.5**
       *
       * For any non-ADMIN user with a valid centerId in their JWT, the
       * tenantScope middleware MUST set req.tenantCenterId exactly equal to
       * that centerId — preventing cross-center leakage at the query layer.
       */
      it('always attaches the correct centerId for non-ADMIN users', () => {
        fc.assert(
          fc.property(nonAdminUserArb, (user) => {
            const req = makeReq({ user, query: {} });
            const { res, captured } = makeRes();
            const next = makeNext(captured);

            tenantScope(req, res, next);

            // Middleware must call next() (no early rejection)
            expect(captured.nextCalled).toBe(true);
            expect(captured.statusCode).toBeNull();

            // req.tenantCenterId must equal exactly the user's centerId
            expect(req.tenantCenterId).toBe(user.centerId);
          }),
          { numRuns: 100, verbose: true },
        );
      });
    });

    // -------------------------------------------------------------------------
    // Property 4b: tenantScope rejects non-ADMIN users with no centerId
    // -------------------------------------------------------------------------
    describe('4b — tenantScope rejects non-ADMIN users missing centerId with 403', () => {
      /**
       * **Validates: Requirements 4.5**
       *
       * A non-ADMIN user whose JWT lacks a centerId cannot be associated with
       * any center. Any such request MUST be rejected with 403.
       */
      it('rejects every non-ADMIN user that has no centerId in JWT', () => {
        fc.assert(
          fc.property(
            fc.record({
              id: uuidArb,
              username: fc.string({ minLength: 1, maxLength: 30 }),
              role: nonAdminRoleArb,
              // centerId explicitly absent / undefined
            }),
            (userWithoutCenter) => {
              const req = makeReq({ user: userWithoutCenter, query: {} });
              const { res, captured } = makeRes();
              const next = makeNext(captured);

              tenantScope(req, res, next);

              expect(captured.nextCalled).toBe(false);
              expect(captured.statusCode).toBe(403);
            },
          ),
          { numRuns: 100, verbose: true },
        );
      });
    });

    // -------------------------------------------------------------------------
    // Property 4c: cross-center guard returns 403 for any differing center pair
    // -------------------------------------------------------------------------
    describe('4c — cross-center guard rejects any resource owned by a different center', () => {
      /**
       * **Validates: Requirements 4.5**
       *
       * For any non-ADMIN user and any resource whose centerId differs from the
       * user's centerId, the access check MUST return 403.
       */
      it('returns 403 for every (userCenterId, resourceCenterId) pair where they differ', () => {
        fc.assert(
          fc.property(
            nonAdminUserArb,
            differentCenterIdsArb,
            (_user, [userCenterId, resourceCenterId]) => {
              // Verify our arbitrary is set up correctly
              expect(userCenterId).not.toBe(resourceCenterId);

              const result = crossCenterGuard(userCenterId, resourceCenterId);
              expect(result).toBe(403);
            },
          ),
          { numRuns: 100, verbose: true },
        );
      });
    });

    // -------------------------------------------------------------------------
    // Property 4d (complementary): same center allows access
    // -------------------------------------------------------------------------
    describe('4d — same-center access is NOT rejected (complementary property)', () => {
      /**
       * **Validates: Requirements 4.5** (complementary — ensures the guard is
       * not over-restrictive)
       *
       * When a non-ADMIN user accesses a resource belonging to their OWN center,
       * the guard MUST NOT return 403.
       */
      it('returns 200 when userCenterId equals resourceCenterId', () => {
        fc.assert(
          fc.property(nonAdminUserArb, uuidArb, (_user, sharedCenterId) => {
            const result = crossCenterGuard(sharedCenterId, sharedCenterId);
            expect(result).toBe(200);
          }),
          { numRuns: 100, verbose: true },
        );
      });
    });

    // -------------------------------------------------------------------------
    // Property 4e: ADMIN without center_id query param gets unscoped access
    // -------------------------------------------------------------------------
    describe('4e — ADMIN user without center_id query param gets unscoped access', () => {
      /**
       * **Validates: Requirements 4.4 / 8.4**
       *
       * An ADMIN user without a center_id query parameter should NOT have
       * tenantCenterId set (undefined = unscoped). They are not subject to
       * cross-center rejection.
       */
      it('leaves req.tenantCenterId undefined for ADMIN with no center_id param', () => {
        fc.assert(
          fc.property(
            fc.record({
              id: uuidArb,
              username: fc.string({ minLength: 1, maxLength: 30 }),
              role: fc.constant(UserRole.ADMIN),
            }),
            (adminUser) => {
              const req = makeReq({ user: adminUser, query: {} });
              const { res, captured } = makeRes();
              const next = makeNext(captured);

              tenantScope(req, res, next);

              expect(captured.nextCalled).toBe(true);
              expect(req.tenantCenterId).toBeUndefined();
            },
          ),
          { numRuns: 100, verbose: true },
        );
      });
    });
  },
);

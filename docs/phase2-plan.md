# DealersOS Phase 2 Implementation Plan

## Goals
- Extend the existing multi-tenant SaaS foundation with higher-value dealership operating workflows.
- Build on the current Prisma model, route handlers, RBAC system, and dashboard shell rather than replacing them.
- Introduce workflow automation, richer analytics, and a more complete admin/vendor surface.

## Phase 2 Pillars
1. Opportunity intelligence
   - Add a dealership opportunity score to each vehicle/VIN analysis record.
   - Provide a reusable scoring service that combines VIN analysis, mileage, status, and confidence.

2. Workflow automation
   - Add a lightweight `workflow` state for vehicles and analyses.
   - Allow routes and UI to update workflow states without introducing new infrastructure.

3. Admin observability
   - Expose recent audit and activity summaries in the admin dashboard.
   - Add dedicated service endpoints for operational health and system insights.

4. Vendor collaboration surface
   - Expand the vendor workspace with seeded quote/job summaries and a simple activity feed.

## Implementation sequence
- Add a scoring utility and service layer.
- Extend vehicle and VIN analysis data flow with computed opportunity metrics.
- Add API endpoints and UI surfaces for opportunity insights.
- Add admin/vendor enhancements and supporting tests.
- Verify via the repository test suite where the environment allows it.

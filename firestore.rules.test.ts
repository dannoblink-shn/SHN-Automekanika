/**
 * Phase 0: Dirty Dozen Security Rule Verification Spec
 * Targets: DRAFT_firestore.rules / firestore.rules
 *
 * Designed to verify with @firebase/rules-unit-testing against Firestore Emulator:
 *   1. Unauthenticated read/write -> PERMISSION_DENIED
 *   2. Unverified email_verified=false admin spoof -> PERMISSION_DENIED
 *   3. Cross-tenant get/list by uid_B on /shops/uid_A/customers -> PERMISSION_DENIED
 *   4. Identity spoofing (ownerId != auth.uid) on create -> PERMISSION_DENIED
 *   5. Shadow field injection (extra unknown key) -> PERMISSION_DENIED
 *   6. ID poisoning (>128 chars or invalid chars) -> PERMISSION_DENIED
 *   7. Orphaned vehicle (missing customerId) -> PERMISSION_DENIED
 *   8. Orphaned workOrderItem (missing orderId) -> PERMISSION_DENIED
 *   9. Immutable field tampering (changing createdAt / ownerId / orderNumber) -> PERMISSION_DENIED
 *  10. Client clock forgery (createdAt != request.time) -> PERMISSION_DENIED
 *  11. Terminal state mutation on Entregado work order (non-admin) -> PERMISSION_DENIED
 *  12. Value poisoning (negative stock or oversized symptom > 500 chars) -> PERMISSION_DENIED
 */

export const DIRTY_DOZEN_PAYLOADS = [
  {
    id: 'unauthenticated-read',
    path: '/shops/userA/customers/c1',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'unverified-email-spoof',
    path: '/shops/userA/customers/c1',
    operation: 'get',
    auth: { uid: 'attacker', token: { email: 'DannoBlink@gmail.com', email_verified: false } },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'cross-tenant-list',
    path: '/shops/userA/customers',
    operation: 'list',
    auth: { uid: 'userB', token: { email: 'b@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'identity-spoofing-create',
    path: '/shops/userB/customers/c1',
    operation: 'create',
    auth: { uid: 'userB', token: { email: 'b@example.com', email_verified: true } },
    payload: { ownerId: 'userA', name: 'Carlos', phone: '5551234', email: '', taxId: '', notes: '' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'shadow-field-injection',
    path: '/shops/userA/parts/p1',
    operation: 'create',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { ownerId: 'userA', sku: 'FLT-01', name: 'Filtro', category: 'Filtros', stock: 5, minStock: 2, costPrice: 10, salePrice: 20, location: 'A1', isPaidOverride: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'id-poisoning',
    path: `/shops/userA/parts/${'x'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'orphaned-vehicle',
    path: '/shops/userA/vehicles/v1',
    operation: 'create',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { ownerId: 'userA', customerId: 'nonexistent', customerName: 'Ghost', plate: 'ABC-123', make: 'Toyota', model: 'Corolla', year: 2022, vin: '', color: 'Gris', fuelType: 'Gasolina', mileage: 12000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'orphaned-work-order-item',
    path: '/shops/userA/workOrders/missingOrder/items/i1',
    operation: 'create',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { ownerId: 'userA', orderId: 'missingOrder', type: 'Mano de Obra', partId: '', description: 'Cambio aceite', quantity: 1, unitPrice: 50, subtotal: 50 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'immutable-field-tamper',
    path: '/shops/userA/workOrders/wo1',
    operation: 'update',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { orderNumber: 'OT-9999' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'client-clock-forgery',
    path: '/shops/userA/parts/p2',
    operation: 'create',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { ownerId: 'userA', sku: 'BRK-02', name: 'Pastillas', category: 'Frenos', stock: 4, minStock: 2, costPrice: 20, salePrice: 40, location: 'B2', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'terminal-state-mutation',
    path: '/shops/userA/workOrders/wo_delivered',
    operation: 'update',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { status: 'En Reparación' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'value-poisoning',
    path: '/shops/userA/parts/p1',
    operation: 'update',
    auth: { uid: 'userA', token: { email: 'a@example.com', email_verified: true } },
    payload: { stock: -9999 },
    expected: 'PERMISSION_DENIED',
  },
] as const;

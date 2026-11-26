# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Shop Ownership (Master Source of Truth)**: Every sub-resource (`customers`, `vehicles`, `mechanics`, `parts`, `workOrders`, `items`, `appointments`) belongs to a `/shops/{shopId}` document whose `ownerId` matches `request.auth.uid`.
2. **Email Verification**: Every authenticated read/write requires `request.auth.token.email_verified == true`.
3. **Identity Integrity**: Every document stores `ownerId == request.auth.uid` on creation, and `ownerId` + `createdAt` are immutable on update.
4. **Relational Existence**: A `Vehicle` must reference an existing `customerId`; a `WorkOrder` must reference an existing `customerId` and `vehicleId`; a `WorkOrderItem` must reference an existing parent `WorkOrder` (`exists` or `existsAfter` in batch writes).
5. **Terminal State Locking**: Once a `WorkOrder` reaches `'Entregado'` or `'Cancelado'`, or an `Appointment` reaches `'Completada'` or `'Cancelada'`, subsequent client updates are rejected (unless overridden by `isAdmin()`).
6. **Strict Timestamp & Boundary Guards**: `createdAt == request.time` on create, `updatedAt == request.time` on update, all document IDs match `^[a-zA-Z0-9_-]{1,128}$`, and all strings/numbers enforce explicit upper/lower bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `request.auth == null` attempting to read `/shops/userA/customers/c1`. -> `PERMISSION_DENIED`
2. **Unverified Email Spoof**: `request.auth.token.email == 'DannoBlink@gmail.com'` with `email_verified == false`. -> `PERMISSION_DENIED`
3. **Cross-Tenant Shop Access**: User B (`uid_B`) attempting to `get` or `list` `/shops/uid_A/customers`. -> `PERMISSION_DENIED`
4. **Identity Spoofing on Create**: User B creating a customer under `/shops/uid_B/customers/c1` with `ownerId: 'uid_A'`. -> `PERMISSION_DENIED`
5. **Shadow Field Injection**: Creating a `WorkOrder` with an unexpected `"isPaidOverride": true` ghost field. -> `PERMISSION_DENIED`
6. **ID Poisoning**: Creating a document with ID `"../../../../etc/passwd"` or a 500-char string. -> `PERMISSION_DENIED`
7. **Orphaned Vehicle**: Creating a `Vehicle` referencing a non-existent `customerId: 'ghost_cust'`. -> `PERMISSION_DENIED`
8. **Orphaned WorkOrderItem**: Creating a `WorkOrderItem` under a non-existent `orderId`. -> `PERMISSION_DENIED`
9. **Immutable Field Tampering**: Updating a `WorkOrder` to alter `createdAt` or `ownerId`. -> `PERMISSION_DENIED`
10. **Client Clock Forgery**: Creating a `Part` with a backdated `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`
11. **Terminal State Mutation**: Attempting to update `totalAmount` or `status` on a `WorkOrder` already marked `'Entregado'` (non-admin). -> `PERMISSION_DENIED`
12. **Denial of Wallet / Value Poisoning**: Updating `Part.stock` to `-9999` or injecting a 50KB string into `symptom`. -> `PERMISSION_DENIED`

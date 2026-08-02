# Best Bottles Reconciliation Backfill Review Report

**Generated:** 2026-07-11T07:53:57.541Z  
**Organization:** `4ab1ac72-cd7e-4faf-9152-5aa5f2862411`  
**Mode:** Read-only; no production writes performed

## Summary

- Shared images requiring eligibility confirmation: **4**
- Explicitly rejected assignments excluded from backfill: **7**
- Remaining unreviewed assignments: **7**
- Every historical image remains flagged for measured-geometry review.
- Every proposed assignment remains pending Shopify and Convex read-back verification.

## Shared images

Each image below is linked to more than one exact SKU job. Confirm that reusing the same image across every listed Grace/website SKU is intentional.

### 1. Image `1ba6d970-c499-44de-a15c-12496fa30238`

**Image URL:** https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1778803254854-ef7b6c62-7418-43b3-8f18-e6ce9067f770.png

| Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |
|---|---|---|---|---|---|
| `f213e26b-363e-4c49-895b-f34d45cfceeb` | `GB-EMP-CLR-50ML-RDC-MSLV` | `GBEmp50RdcrMtSl` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |
| `46d3dea7-2bba-48d7-8c9f-72f5f6192e76` | `GB-EMP-CLR-50ML-RDC-MSLV-01` | `GBEmp50RdcrMtSl` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |

### 2. Image `3c8acc66-73ac-4c70-b7bd-bd925625ede1`

**Image URL:** https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_corrected_1779340552297_0safy9.png

| Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |
|---|---|---|---|---|---|
| `b21eb132-0c4e-4e98-a79f-ad49318b7149` | `GB-EMP-CLR-100ML-RDC-SBLK` | `GBEmp100RdcrShnBlk` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |
| `d275117a-5bfe-4ffb-8698-102bff6b4449` | `GB-EMP-CLR-100ML-RDC-SBLK-01` | `GBEmp100RdcrShnBlk` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |

### 3. Image `66bcb944-30e3-4df5-9fd0-c00d1db8aaba`

**Image URL:** https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_corrected_1779340326554_2588y4.png

| Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |
|---|---|---|---|---|---|
| `c86f6116-ccca-44a2-89e2-172daddc4dfc` | `GB-EMP-CLR-100ML-RDC-MSLV` | `GBEmp100RdcrMtSl` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |
| `04324108-f57c-4801-85a2-3204095a689b` | `GB-EMP-CLR-100ML-RDC-MSLV-01` | `GBEmp100RdcrMtSl` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |

### 4. Image `6a1631e1-a17e-418d-b5ae-e4cd40050f78`

**Image URL:** https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1778802844917-fee7983c-4cc2-477a-9035-007b4f63f051.png

| Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |
|---|---|---|---|---|---|
| `e6e86c07-e34f-4f4f-b01c-ce2abc3393a2` | `GB-EMP-CLR-50ML-RDC-SBLK` | `GBEmp50RdcrShnBlk` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |
| `ad25be7e-a394-4459-88a3-3c35d071ec48` | `GB-EMP-CLR-50ML-RDC-SBLK-01` | `GBEmp50RdcrShnBlk` | synced | approved-keep | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |

## Rejected assignments

These images were explicitly rejected and are excluded from the production backfill candidate set.

| Image ID | Image URL | Job ID | Grace SKU | Website SKU | Job status | Decision | Reason |
|---|---|---|---|---|---|---|---|
| `ca87201a-4f91-41d3-8246-e38292dfe089` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782190314581_wr4ieq.png | `bb0a0876-c3c3-409c-8db8-adc2126d523f` | `GB-CYL-BLK-9ML-SPR-BLK` | `GBCylSwrl9SpryBlk` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |
| `2b8a4f59-5925-48af-b2cf-e48911ea116f` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782204770259_2iow6i.png | `3b48454f-9b6f-4de6-b5d8-e2c6970da82e` | `GB-CYL-CLR-9ML-SPR-GLD` | `GBCylSwrl9SpryGl` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |
| `3945628f-aa5d-493e-9366-a771d68ac452` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782189971148_oy8q98.png | `675d01a9-5e88-422b-903d-8ca61d08c33c` | `GB-CYL-CLR-9ML-SPR-MSLV-01` | `GBCylSwrl9SpryMattSl` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |
| `28a50eba-0e39-4b5a-bb1a-3792be702a51` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782190120099_wxwk47.png | `9bdc97d0-b346-4ef1-a5d5-94d47b0b42b5` | `GB-CYL-CLR-9ML-SPR-RED` | `GBCylSwrl9SpryRd` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |
| `ad3fb5c5-252e-47a1-aee7-6d4adfa6ebce` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782190037980_uco7uu.png | `d12060e0-7d1e-40f5-b6f8-d46e7330f37b` | `GB-CYL-CLR-9ML-SPR-SSLV-01` | `GBCylSwrl9SpryShSl` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |
| `f1f93858-f6bf-4d11-b08a-8ffda56587c1` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782190241939_2f5vlu.png | `fa87d192-a17c-4509-adbd-a980584be05c` | `GB-CYL-CLR-9ML-T-27` | `GBCylSwrl9SpryTur` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |
| `de7da60d-6001-460a-a138-1c0c9c3ee6f5` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e/paper-doll/master_rigged_1782198759440_04nfw5.png | `d59b634b-e0a3-481c-ab5d-acb6f2be2493` | `LB-CYL-CLR-9ML-LPM-MSLV` | `LBCylSwrl9LtnMtSl` | generated | rejected | Rejected by Jordan: obsolete post-generation paint-on workflow produced destructive masking/paint artifacts. |

## Remaining unreviewed assignments

These generated images are not the exact image recorded as approved for their SKU job. They remain excluded from approval until a human confirms their historical role.

| Image ID | Image URL | Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |
|---|---|---|---|---|---|---|---|
| `dfd9927a-4b6d-4ed7-b60a-c91223f87fa3` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263570847-2c7e20ea-2156-4e2a-8292-87a7b3011322.png | `f4573824-c161-445e-a568-711b155f2126` | `AB-ALU-CLR-100ML-SPR-BLK` | `Alu100mlSprayBlack` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |
| `d14626f5-1a98-493d-b2c0-6d2ba9579db1` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263636108-9e5b6e2e-88a1-4d39-bfd1-75a2a398a84d.png | `e278a805-c372-454c-85c9-da21f3b0f2d1` | `AB-ALU-CLR-120ML-LPM-BLK` | `Alu120mlLotionPumpBlack` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |
| `250b520b-be07-4c78-abd7-7ab63933c495` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263694090-3b7e67d4-0119-44ae-8d27-2fbef350116c.png | `9535cc59-87dd-4cd4-b92e-b072b8f18920` | `AB-ALU-CLR-120ML-LPM-WHT` | `Alu120mlLotionPumpWhite` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |
| `786107e6-0ecf-4292-90f1-f92467d862dc` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263753602-a62a4b27-dd0f-4fe9-99ee-aa4c1661a3c1.png | `bb23ccac-2030-448c-a90a-088678d837e3` | `AB-ALU-CLR-250ML-SPR-BLK` | `Alu250mlSprayBlack` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |
| `73af0441-099d-439f-bcbd-1a10bbf3f827` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263813900-0804ad3b-7bec-4f83-ae4f-ab5e709abebb.png | `263add14-157e-432a-882d-f8dcbdb4bd5f` | `AB-ALU-CLR-500ML` | `Alu500` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |
| `56d94056-f678-4939-a891-d4272b03a66e` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263461660-01bc6bea-f39e-4d3e-99e8-091bdba093d5.png | `8b02ac0f-3421-45a7-b212-a0ba1ef277d3` | `AB-ALU-CLR-65ML-LPM-BLK` | `Alu65mlLotionPumpBlack` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |
| `fdfdd81b-617a-46c5-a26a-899b72f80f0f` | https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263516415-7ad37324-fc5d-476c-8a00-a483f26d66cf.png | `0e173e24-cd02-4d67-8389-779e91885329` | `AB-CYL-WHT-65ML-LPM-WHT` | `Alu65mlLotionPumpWhite` | synced | unreviewed | No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded. |

## Decision gate

Do not run the production backfill with `--execute` until the four shared-image groups and seven remaining unreviewed assignments have been accepted or excluded. The seven rejected paint-on images are already excluded from the candidate set. Executing the backfill will not invent geometry or destination verification; those states remain pending after insertion.


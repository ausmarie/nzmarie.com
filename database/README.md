# Database Setup - Admin System

## ✅ Migration Completed Successfully

All required tables have been created in Marie DB (Singapore cluster).

## 📊 Tables Created

| Table Name | Purpose | Status |
|------------|---------|--------|
| `admin_users` | Admin user roles (Louis/Marie) | ✅ Existing |
| `appraisal_leads` | Appraisal requests (updated with suburb) | ✅ Updated |
| `report_downloads` | PDF download tracking (5/month limit) | ✅ Created |
| `direct_mail_campaigns` | Marketing campaigns metadata | ✅ Created |
| `direct_mail_addresses` | Mailed addresses with tracking | ✅ Created |
| `outreach_tasks` | Mail queue (Pending/Sent workflow) | ✅ Created |
| `suburb_reports` | Quarterly PDF reports | ✅ Created |

## 📁 Files

### SQL Files

- **`schema.sql`** - Complete database schema with documentation (reference only)
- **`migrate-admin-system.sql`** - Safe migration script (adds new tables, updates existing ones)

### TypeScript Scripts

- **`scripts/run-migrations.ts`** - Run migration script
- **`scripts/check-tables.ts`** - Verify tables exist
- **`scripts/test-create-table.ts`** - Test individual table creation

## 🔧 How to Use

### Run Migration

```bash
npm run db:migrate
```

### Verify Tables

```bash
npx tsx scripts/check-tables.ts
```

### Test Database Connection

```bash
npm run test:db
```

## 🗄️ Database Architecture

### Dual Database Setup

```
Marie DB (Singapore) - Read/Write
├─ Admin system tables (this migration)
├─ User management
├─ Campaign tracking
└─ Download records

Louis DB (Jakarta) - Read Only
└─ properties (100,000+ records)
```

### Connection Configuration

```typescript
// lib/db.ts
export const marieDB = new Pool({
  connectionString: process.env.DATABASE_URL,  // Marie DB
  ssl: { rejectUnauthorized: false },
  max: 20,
});

export const louisDB = new Pool({
  connectionString: process.env.LOUIS_DATABASE_URL,  // Louis DB
  ssl: { rejectUnauthorized: false },
  max: 10,
});
```

## 📋 Database Schema

### Tables Relationship

```
appraisal_leads (existing - updated)
  └─ Added: suburb, property_type, priority, contact_status

report_downloads (new)
  └─ Tracks PDF downloads with 5/month limit per email+suburb

direct_mail_campaigns (new)
  ├─> direct_mail_addresses
  │   └─ Individual mailed addresses with tracking
  └─> outreach_tasks
      └─ Mail queue management (PENDING/SENT)

suburb_reports (new)
  └─ Quarterly market reports (Cloudflare R2)
```

### Key Features

1. **Download Limit Enforcement**
   - 5 downloads per month per email+suburb combination
   - Implemented in application layer (see `lib/download-limit.ts`)

2. **Automatic Tracking** (Application Layer)
   - Download tracking updates `direct_mail_addresses` and `outreach_tasks`
   - Appraisal requests update engagement flags
   - Campaign stats auto-recalculated

3. **Role-Based Data Access**
   - Louis (super_admin): All data including financials
   - Marie (admin): Business data only (no costs/revenue)

## 🚨 Important Notes

### CockroachDB Compatibility

- ✅ Simple triggers work (e.g., `updated_at`)
- ❌ Complex PL/pgSQL triggers removed - implemented in application layer instead
- ❌ Custom functions with complex logic - moved to TypeScript utilities

### Tracking Implementation

**Originally planned (triggers):**
```sql
-- Trigger to auto-update on download
CREATE TRIGGER trg_update_download_tracking...
```

**Current implementation (application layer):**
```typescript
// app/api/download-report/route.ts
await updateDownloadTracking(email, suburb, trackingCode);
```

See `/lib/tracking.ts` for implementation details.

## 🔍 Verification Queries

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check admin users
SELECT email, role, name FROM admin_users;

-- Check appraisal_leads has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'appraisal_leads' 
ORDER BY ordinal_position;

-- Count records in new tables
SELECT 
  (SELECT COUNT(*) FROM report_downloads) AS downloads,
  (SELECT COUNT(*) FROM direct_mail_campaigns) AS campaigns,
  (SELECT COUNT(*) FROM direct_mail_addresses) AS addresses,
  (SELECT COUNT(*) FROM outreach_tasks) AS tasks,
  (SELECT COUNT(*) FROM suburb_reports) AS reports;
```

## 📞 Next Steps

1. ✅ Database tables created
2. ⏳ Create API endpoints (see `tasks/admin/02_开发实施指南.md`)
3. ⏳ Build admin UI pages
4. ⏳ Implement tracking logic in application layer
5. ⏳ Add permissions middleware

## 📚 Documentation

- **Design Specs**: `tasks/admin/01_系统设计与规范.md`
- **Implementation Guide**: `tasks/admin/02_开发实施指南.md`
- **Project README**: `tasks/admin/README.md`

## 🔐 Environment Variables

```env
# Marie DB (Admin System) - Read/Write
DATABASE_URL=postgresql://nzmarie:...@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full

# Louis DB (Properties) - Read Only
LOUIS_DATABASE_URL=postgresql://nz-property:...@jazzed-buzzard-25204.j77.aws-ap-southeast-3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
```

---

**Last Updated**: 2026-06-30  
**Status**: ✅ Database migration completed successfully  
**Next**: Proceed with API and UI development

# OPERATIONS_RUNBOOK_SINGLE_ORG.md

## 1. Purpose

This runbook defines operational safeguards for the single-org web-facing OpsScheduler deployment:

- backup scheduling
- restore procedure and drill evidence
- incident owner and escalation path
- patching cadence for application dependencies and host/container images

---

## 2. Scope and Assumptions

- One production instance
- PostgreSQL runs in Docker
- Reverse proxy is nginx
- App runs on Node.js 24 LTS
- Database service name is environment-specific (examples use `opsscheduler-postgres`)

---

## 3. Backup Schedule

### Backup type

- PostgreSQL logical dump (`pg_dump`, custom format `-Fc`)

### Schedule

- Daily at `02:15` local server time

### Retention

- Keep 14 daily backups
- Keep 8 weekly backups (Sunday snapshots)
- Keep 6 monthly backups (first day of month)

### Destination

- Store outside repo working directory, for example:
  - Linux: `/var/backups/opsscheduler/postgres`
  - Windows host path mounted to secure volume

### Backup command template

```bash
docker exec <postgres-container> sh -lc \
  "PGPASSWORD=<db-password> pg_dump -U <db-user> -d <db-name> -Fc -f /tmp/<backup-file>.dump"
docker cp <postgres-container>:/tmp/<backup-file>.dump <secure-backup-path>/<backup-file>.dump
```

### Verification after backup

- Verify dump file exists and size is non-zero
- Keep checksum with each backup file (`sha256`)

---

## 4. Restore Procedure (Non-Production Drill)

### Restore target naming

- `opsscheduler_restore_drill_<YYYYMMDD>`

### Restore commands (example)

```bash
docker exec opsscheduler-postgres sh -lc \
  "PGPASSWORD=postgres pg_dump -U postgres -d opsscheduler -Fc -f /tmp/opsscheduler_restore_drill_20260331.dump"

docker exec opsscheduler-postgres sh -lc \
  "PGPASSWORD=postgres psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS opsscheduler_restore_drill_20260331;'"

docker exec opsscheduler-postgres sh -lc \
  "PGPASSWORD=postgres psql -U postgres -d postgres -c 'CREATE DATABASE opsscheduler_restore_drill_20260331;'"

docker exec opsscheduler-postgres sh -lc \
  "PGPASSWORD=postgres pg_restore -U postgres -d opsscheduler_restore_drill_20260331 --no-owner --no-privileges /tmp/opsscheduler_restore_drill_20260331.dump"
```

### Post-restore validation

- Compare row counts for key tables between source and restored DB:
  - `User`
  - `WorkItem`
  - `Organization`
  - `AuditEvent`

---

## 5. Restore Drill Record

### Drill date

- March 31, 2026

### Environment

- Non-production local Docker PostgreSQL container: `opsscheduler-postgres`

### Result

- Restore completed successfully
- Source and restored counts matched:
  - `User`: `2`
  - `WorkItem`: `16`
  - `Organization`: `2`
  - `AuditEvent`: `0`

### Pass criteria

- Dump created successfully
- Restore DB created and loaded without errors
- Key table counts matched source

---

## 6. Incident Response Ownership and Contact Path

### Ownership

- Primary incident owner: OpsScheduler service owner (role), mapped to current deployment administrator
- Secondary owner: platform/infrastructure owner for host, Docker, and nginx

### Contact path

1. Raise incident in operations channel and ticketing system immediately
2. Notify primary owner directly
3. If no acknowledgement within 15 minutes, escalate to secondary owner
4. If data integrity risk exists, freeze write access and begin restore assessment

### Severity guide

- Sev 1: full outage, data loss, or auth bypass risk
- Sev 2: major feature outage, no confirmed data loss
- Sev 3: degraded behavior with workaround

---

## 7. Patching Cadence

### Application dependencies

- Weekly:
  - `pnpm audit --prod`
  - `pnpm outdated`
- Patch window: every Wednesday
- Critical security advisories: patch and deploy within 48 hours

### Base images and host OS

- Monthly patch window (second Tuesday cycle)
- Rebuild and redeploy PostgreSQL and app runtime images after security updates
- Node.js 24 LTS patch updates applied within 7 days of release unless blocked by compatibility issues

### Verification after patching

- `pnpm verify:hardening`
- smoke test login + create/edit/drag flows

---

## 8. Monitoring Baseline

- Monitor application process uptime and restart failures
- Monitor nginx `5xx` error rate and authentication denial spikes
- Alert thresholds:
  - sustained `5xx` rate above 2% for 5 minutes
  - unusual `429` surge indicating abuse or misconfiguration

---

## 9. Operational Checklist

- [x] Backup schedule defined
- [x] Restore procedure documented
- [x] Restore drill executed in non-production
- [x] Incident owner and escalation path defined
- [x] Patching cadence for dependencies and base images defined

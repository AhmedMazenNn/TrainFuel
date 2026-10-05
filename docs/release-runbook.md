# Website deployment and recovery

## Deploy

1. Provision a host with Docker Compose, a domain, and an HTTPS reverse proxy/load balancer. Terminate TLS there and forward `X-Forwarded-Proto: https`; the proxy must not expose the database, API, or media volume directly.
2. Copy `.env.production.example` to `.env`, generate a new Django secret and database password, and configure the production host, HTTPS CSRF origin, SMTP relay, and optional Google client. Keep `.env` and all encryption identities out of Git and image layers.
3. Review Compose resource limits, disk monitoring, firewall rules, SMTP delivery, and storage capacity for the target host. Start with `docker compose up --build -d`; API startup applies migrations and collects static assets. Check `/api/health/` and exercise account, export, deletion, private-media, offline recovery, and RTL journeys on staging before release.
4. Configure an S3-compatible private bucket by setting `MEDIA_STORAGE_BACKEND=s3`, `MEDIA_S3_BUCKET`, optional endpoint/region, and the platform's private bucket credentials. Keep public ACLs disabled. The default Compose media is private to the mounted volume.

Compose binds only the web container to the host. The PostgreSQL service, API, and privacy worker share an internal Compose network; persistent database and private media volumes are separate. Put a rate-limited HTTPS proxy in front of the web port and set an explicit host firewall.

## Backups and restore

Install PostgreSQL client tools and `age` on a separate backup runner. Provision `BACKUP_AGE_RECIPIENT` from an offline-held key, and store `BACKUP_DIR` on a private durable volume with monitoring and access controls. Run `scripts/backup-postgres.sh` daily through the host scheduler. The script encrypts custom-format `pg_dump` output before writing and prunes database archives after 30 days. Back up private media separately using encrypted storage snapshots with the same 30-day maximum retention; never put photo bytes in a database dump.

For routine archive integrity checks, run `scripts/restore-check-postgres.sh` with the backup path and a protected decryption identity. For a demonstrated restore, decrypt to a protected temporary file and restore to an isolated PostgreSQL instance with `pg_restore --clean --if-exists --no-owner --no-acl`; run migrations/checks and representative account/domain reads, then remove the temporary database and file. Never test restoration over the live database. Record the run date, backup identifier, restored migration version, and validation outcome without recording user data.

Account deletion removes live rows and queues private object cleanup. Database and media backups may retain deleted records until their documented 30-day expiry; constrain restore access and replay deletion receipts before making a restored service available. Deletion receipts expire after 30 days. Browser caches on disconnected devices cannot be remotely erased; the web client clears its local owner partition as soon as it learns that the account was erased. The app does not promise removal from offline copies on devices that never reconnect.

## Release gates still requiring deployment evidence

Use a staging environment to measure route and shell budgets on an agreed device/network, review logs/telemetry for private payloads, test authenticated and cross-account media access, resolve catalog media rights, perform the isolated restore, and validate deliverability and HTTPS headers. This repository provides the deployment and CI path; it does not certify a live hosting setup or a restore that has not been executed against provisioned production-like infrastructure.

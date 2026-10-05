# Private media foundation

Development uses ignored `.private-media/private` and `.private-media/catalog` directories. No web-server route exposes these directories. Production may use an S3-compatible private bucket: set `MEDIA_STORAGE_BACKEND=s3`, `MEDIA_S3_BUCKET`, optional endpoint/region, and credentials through the standard AWS environment/provider chain. Keep bucket public access blocked; application endpoints deliver content. S3 deployment and credentials remain environment-specific and were not exercised against a live provider.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/media/uploads/` | Initiate `{purpose: exercise|progress, visibility: private|public}`; pending upload expires after 2 hours |
| POST | `/api/media/uploads/{upload_id}/content/` | Multipart `file`, up to 10 MiB; stage bytes only |
| POST | `/api/media/uploads/{upload_id}/finalize/` | Decode, orient, strip embedded metadata, create processed original and thumbnail; repeat is idempotent |
| GET / DELETE | `/api/media/assets/{asset_id}/` | Owner metadata / soft-delete unattached private asset and queue object cleanup |
| POST | `/api/media/assets/{asset_id}/access/` | `{variant: original|thumbnail}` → 120-second grant and content path |
| GET | `/api/media/assets/{asset_id}/content/` | Owner session plus `X-Media-Access` header grant; `Cache-Control: private, no-store` |
| GET | `/api/media/catalog/{asset_id}/content/` | Separate delivery route for ready public catalog assets; never exposes a private asset |

Every write requires CSRF. Another owner, including a catalog admin, receives 404 for private asset metadata/files and upload IDs. Access grants are owner/asset/variant bound, and are not query-string URLs. Metadata omits object keys. Files are read from storage and delivered by the application, rather than making private bucket objects publicly readable.

Supported: JPEG, PNG, WebP and animated exercise GIF. Progress animation and HEIF are rejected. Defaults: 10 MiB original, 20 MP, 10,000 px maximum edge; animation ≤120 frames and ≤80 million aggregate decoded pixels. Processed static originals and thumbnails use JPEG; animations are re-encoded GIF. Fresh pixel images discard EXIF/device/location metadata. Originals here mean processed full-size images, not retained unstripped upload bytes. Failed uploads preserve the caller's durable local blob; retry with a new upload. Future tested HEIF conversion can extend this contract.

Public exercise uploads require catalog-admin permission plus HTTPS `source_url`, `license`, and `rights_confirmed: true`. This records a sourcing declaration; release still requires verifying rights to selected media.

An asset reaching `ready` accepts **no domain photo slot**. Exercise/photo domain services must call the transactional attachment helper described in [integration guidance](integration/milestone-2.md). Weekly four-photo enforcement belongs in the progress-photo acceptance transaction in Milestone 5, not byte upload. The browser retains staged sources until domain acceptance. Private photo caching stays off until the explicit F17 opt-in is built.

Run periodically:

```bash
backend/.venv/bin/python backend/manage.py cleanup_media
backend/.venv/bin/python backend/manage.py scan_media_orphans
```

Cleanup expires pending uploads and retries queued object deletion; it logs counts without filenames or account payloads. Orphan scanning is a dry run for unreferenced objects in dedicated `staging/` and `processed/` prefixes older than 24 hours. Add `--delete` after reviewing the dry run to remove them. Scanning never deletes recent uploads or referenced assets. Configure equivalent storage lifecycle/monitoring in production, with appropriate object-list limits for large buckets.

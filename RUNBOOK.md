# Tofu Alert Operational Runbook

## Emergency Procedures

### Immediately Mute All Alerts

If inappropriate content slips through:

**Option 1: Admin Panel**
1. Navigate to `/admin`
2. Toggle "Mute Alerts" switch

**Option 2: Chat Command**
```
!alerts off
```

**Option 3: Database Direct**
```sql
UPDATE "Settings" SET "alertsMuted" = true WHERE id = 1;
```

### Remove Approved Alert

If an approved alert needs immediate removal:

```bash
# Connect to database
psql $DATABASE_URL

# Find and deny the alert
UPDATE "Alert" SET status = 'denied', "denialReason" = 'Policy violation detected post-approval' WHERE id = 'ALERT_ID';

# Clear any pending triggers
DELETE FROM "Trigger" WHERE "alertId" = 'ALERT_ID' AND "triggeredAt" > NOW() - INTERVAL '1 hour';
```

Then remove from CDN:

```bash
# Using AWS CLI
aws s3 rm s3://your-bucket/approved/ALERT_ID.mp4

# Or via admin panel: manually deny and purge
```

## Regular Maintenance

### Daily Tasks

1. **Review Denied Alerts**
   - Check for false positives
   - Refine moderation policy if needed

2. **Monitor Moderation Queue**
   - Ensure pipeline is processing within SLA (< 5 minutes)
   - Check for stuck jobs

3. **Check Error Logs**
   ```bash
   docker-compose logs --tail=100 app | grep ERROR
   docker-compose logs --tail=100 worker | grep ERROR
   ```

### Weekly Tasks

1. **Audit Recent Triggers**
   ```sql
   SELECT u.login, a.id, t."triggeredAt"
   FROM "Trigger" t
   JOIN "User" u ON t."userId" = u.id
   JOIN "Alert" a ON t."alertId" = a.id
   WHERE t."triggeredAt" > NOW() - INTERVAL '7 days'
   ORDER BY t."triggeredAt" DESC
   LIMIT 100;
   ```

2. **Check Subscription Status**
   - Verify Tier 3 subscribers still have active alerts
   - Prune alerts for users who downgraded

3. **Review Moderation Policy**
   - Update blocklists based on new patterns
   - Adjust LLM prompt if needed

### Monthly Tasks

1. **Rotate Secrets**
   - Generate new `JWT_SECRET`
   - Generate new `EVENTSUB_SECRET`
   - Update in production

2. **Database Cleanup**
   ```sql
   -- Archive old denied alerts (older than 90 days)
   DELETE FROM "Alert"
   WHERE status = 'denied'
   AND "reviewedAt" < NOW() - INTERVAL '90 days';

   -- Archive old triggers (older than 30 days)
   DELETE FROM "Trigger"
   WHERE "triggeredAt" < NOW() - INTERVAL '30 days';
   ```

3. **Check Storage Usage**
   ```bash
   # S3 bucket size
   aws s3 ls s3://your-bucket --recursive --human-readable --summarize

   # Database size
   SELECT pg_size_pretty(pg_database_size('tofu_alert'));
   ```

4. **Refresh OAuth Tokens**
   ```bash
   # Check token expiration
   curl -H "Authorization: OAuth YOUR_TOKEN" https://id.twitch.tv/oauth2/validate

   # Refresh if needed (automated via cron recommended)
   ```

## Incident Response

### Alert Contains ToS Violation

1. Immediately mute alerts (`!alerts off`)
2. Deny the alert via admin panel
3. Record incident:
   ```sql
   INSERT INTO "Review" ("alertId", stage, verdict, details)
   VALUES ('ALERT_ID', 'manual', 'fail', '{"incident": "ToS violation detected", "action": "immediate removal", "timestamp": "2025-11-11T12:00:00Z"}');
   ```
4. Export last 200 triggers for review
5. Update moderation policy
6. Re-train or adjust LLM prompt
7. Unmute alerts once policy updated

### Moderation Pipeline Down

**Symptoms**: Alerts stuck in "pending" status for > 10 minutes

**Diagnosis**:
```bash
# Check worker status
docker-compose ps worker

# Check worker logs
docker-compose logs --tail=50 worker

# Check Redis connection
redis-cli ping

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

**Resolution**:
```bash
# Restart worker
docker-compose restart worker

# If FFmpeg/Tesseract issues
docker-compose exec worker ffmpeg -version
docker-compose exec worker tesseract --version

# If LLM endpoint issues
curl $VLLM_ENDPOINT/health
```

### Chat Commands Not Working

**Diagnosis**:
```bash
# Check EventSub subscriptions
curl -H "Authorization: Bearer $TWITCH_BROADCASTER_ACCESS_TOKEN" \
     -H "Client-Id: $TWITCH_CLIENT_ID" \
     https://api.twitch.tv/helix/eventsub/subscriptions

# Check bot token validity
curl -H "Authorization: OAuth $TWITCH_BOT_ACCESS_TOKEN" \
     https://id.twitch.tv/oauth2/validate
```

**Resolution**:
1. Re-subscribe to EventSub
2. Refresh bot OAuth token
3. Verify bot is moderator in channel
4. Check webhook endpoint is reachable

### Overlay Not Displaying Alerts

**Diagnosis**:
```bash
# Check WebSocket server
docker-compose logs --tail=50 app | grep WebSocket

# Check connected clients
curl http://localhost:3000/api/overlay/status
```

**Resolution**:
1. Restart app container
2. Verify WebSocket port (3001) is exposed
3. Check firewall rules
4. Test overlay URL directly in browser
5. Refresh OBS browser source

## Token Rotation

### Generate New JWT Secret

```bash
# Generate new secret
openssl rand -base64 32

# Update .env
JWT_SECRET=new_secret_here

# Restart app
docker-compose restart app
```

**Note**: Existing user sessions will be invalidated.

### Refresh Twitch OAuth Tokens

```bash
# Broadcaster token
curl -X POST "https://id.twitch.tv/oauth2/token" \
  -d "client_id=$TWITCH_CLIENT_ID" \
  -d "client_secret=$TWITCH_CLIENT_SECRET" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$TWITCH_BROADCASTER_REFRESH_TOKEN"

# Bot token
curl -X POST "https://id.twitch.tv/oauth2/token" \
  -d "client_id=$TWITCH_CLIENT_ID" \
  -d "client_secret=$TWITCH_CLIENT_SECRET" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$TWITCH_BOT_REFRESH_TOKEN"
```

Update `.env` with new tokens and restart.

## Scaling

### Horizontal Scaling (Workers)

```bash
# Scale workers to 3 instances
docker-compose up -d --scale worker=3

# Check worker distribution
docker-compose ps
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_alert_status ON "Alert"(status);
CREATE INDEX idx_alert_user_status ON "Alert"("userId", status);
CREATE INDEX idx_trigger_user_time ON "Trigger"("userId", "triggeredAt");

-- Vacuum and analyze
VACUUM ANALYZE;
```

### CDN Cache Invalidation

```bash
# CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/approved/*"
```

## Monitoring

### Key Metrics to Track

1. **Moderation Pipeline**
   - Average processing time
   - Approval rate
   - Denial rate by category

2. **Triggers**
   - Triggers per hour
   - Unique users triggering
   - Cooldown rejections

3. **System Health**
   - Database connection pool
   - Redis memory usage
   - Worker queue depth
   - S3 request rate

### Alerting Thresholds

- Moderation pipeline > 10 minutes: **CRITICAL**
- Denial rate > 50%: **WARNING** (policy may be too strict)
- Approval rate > 95%: **INFO** (review sample for quality)
- Worker queue depth > 100: **WARNING**
- Database connections > 80%: **CRITICAL**

## Backup and Recovery

### Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20251111.sql
```

### S3 Backups

```bash
# Sync to backup bucket
aws s3 sync s3://your-bucket s3://your-backup-bucket
```

### Disaster Recovery

1. Restore database from latest backup
2. Restore S3 from backup bucket
3. Re-deploy application
4. Re-subscribe to EventSub
5. Verify all services operational

## Support Contacts

- **Database Issues**: [DBA contact]
- **Infrastructure**: [DevOps contact]
- **Twitch API**: [API specialist]
- **On-Call**: [PagerDuty/phone]

## Change Log

- **2025-11-11**: Initial runbook created
- **[Date]**: [Change description]

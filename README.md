# Tofu Alert - Tier 3 Subscriber Custom Alerts

A robust, production-ready web application that allows Tier 3 Twitch subscribers to upload custom alerts (video/audio up to 10 seconds) with strict Twitch ToS compliance moderation. Each viewer can trigger their alert once every 24 hours using the `!myalert` command in chat.

## Features

- **Tier 3 Subscriber Gating**: Only active Tier 3 subscribers can upload and trigger alerts
- **Strict Moderation Pipeline**: Multi-stage content review including:
  - Heuristic checks (file type, duration, blocklists)
  - Speech-to-Text (STT) transcription and analysis
  - Optical Character Recognition (OCR) for video frames
  - LLM-based content moderation (GPT-4 or local model)
  - Perceptual hashing to detect duplicate denied content
- **24-Hour Cooldown**: Per-user rolling cooldown with remaining time display
- **Global Mute**: Broadcaster can instantly mute all alerts via admin panel or chat command
- **OBS Overlay**: Simple browser source overlay that displays triggered alerts
- **Admin Dashboard**: Review queue, manual approval/denial, settings management
- **Audit Logging**: Complete trail of all moderation decisions and triggers

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js 20+
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: S3-compatible object storage (AWS S3, Backblaze B2, etc.)
- **Cache/Queue**: Redis, BullMQ for background jobs
- **Media Processing**: FFmpeg for validation, transcoding, audio normalization
- **Moderation**: Whisper (OpenAI API or local), Tesseract OCR, OpenAI GPT-4
- **Realtime**: WebSocket for overlay updates
- **Chat Integration**: Twitch EventSub WebSocket for chat commands

## Architecture

```
┌─────────────────┐
│  Tier 3 Sub     │
│  Uploads Alert  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         Moderation Pipeline             │
│  1. Heuristics (file, duration, etc.)   │
│  2. Media validation (FFmpeg)           │
│  3. STT (Whisper)                       │
│  4. OCR (Tesseract)                     │
│  5. LLM moderation (GPT-4)              │
│  6. Duplicate check (perceptual hash)   │
│  7. Transcode & normalize audio         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Approved CDN   │      │   Denied     │
│    Storage      │      │  (with logs) │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Chat Command: !myalert                 │
│  • Check Tier 3 status                  │
│  • Check 24h cooldown                   │
│  • Check global mute                    │
│  • Create trigger & dispatch to overlay │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  OBS Overlay    │
│  (WebSocket)    │
└─────────────────┘
```

## Setup Instructions

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- FFmpeg installed
- Tesseract OCR installed
- S3-compatible storage (AWS S3, Backblaze B2, etc.)
- OpenAI API key (for moderation and STT)
- Twitch Developer Application

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd Tofu-Alert
npm install
```

### 2. Twitch Developer Setup

#### Create Twitch Application(s)

1. Go to https://dev.twitch.tv/console/apps
2. Create a new application:
   - **Name**: Tofu Alert
   - **OAuth Redirect URLs**:
     - `http://localhost:3000/api/auth/twitch/callback` (development)
     - `https://yourdomain.com/api/auth/twitch/callback` (production)
   - **Category**: Broadcasting Suite
3. Note down your **Client ID** and **Client Secret**

#### Required OAuth Scopes

- **Broadcaster** (your account):
  - `channel:read:subscriptions` - Check subscriber status
  - `user:read:chat` - Read chat messages
  - `user:write:chat` - Send chat messages
  - `channel:bot` - Bot functionality

- **Bot** (separate account recommended):
  - `user:read:chat` - Read chat messages
  - `user:write:chat` - Send chat messages
  - `user:bot` - Bot functionality

- **Viewers** (subscribers):
  - `user:read:subscriptions` - Verify subscription tier
  - `openid` - Basic identity

### 3. Environment Configuration

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

Key environment variables:

```env
# Twitch
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_BROADCASTER_ID=your_broadcaster_id
TWITCH_BOT_USER_ID=your_bot_user_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tofu_alert

# Redis
REDIS_URL=redis://localhost:6379

# S3 Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=tofu-alert-uploads
CDN_BASE_URL=https://your-cdn.cloudfront.net

# OpenAI (for moderation and STT)
OPENAI_API_KEY=your_openai_api_key

# Security
JWT_SECRET=generate_a_secure_random_string
EVENTSUB_SECRET=generate_another_secure_string

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed initial settings
npx prisma db seed
```

### 5. Get OAuth Tokens

#### For Broadcaster and Bot:

1. Start the dev server: `npm run dev`
2. Navigate to:
   - Broadcaster: `http://localhost:3000/api/auth/twitch?type=broadcaster`
   - Bot: `http://localhost:3000/api/auth/twitch?type=bot`
3. Complete OAuth flow and copy the access/refresh tokens
4. Store tokens in `.env`:
   ```env
   TWITCH_BROADCASTER_ACCESS_TOKEN=...
   TWITCH_BROADCASTER_REFRESH_TOKEN=...
   TWITCH_BOT_ACCESS_TOKEN=...
   TWITCH_BOT_REFRESH_TOKEN=...
   ```

### 6. Subscribe to EventSub

You'll need to set up Twitch EventSub to receive chat messages. Use a tool like ngrok for local development:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL for EventSub webhook
# Update EVENTSUB_CALLBACK_URL in .env
```

Then subscribe to `channel.chat.message` events via Twitch API or CLI.

### 7. Run the Application

#### Development

```bash
# Run Next.js dev server
npm run dev

# Run moderation worker (separate terminal)
npm run worker
```

#### Production (Docker)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Run migrations
docker-compose exec app npx prisma migrate deploy
```

### 8. Configure OBS

1. Add a **Browser Source** in OBS
2. Set URL to: `https://yourdomain.com/overlay`
3. Width: 1920, Height: 1080 (or your stream resolution)
4. Check "Shutdown source when not visible" (optional)
5. Check "Refresh browser when scene becomes active" (optional)

## Usage

### For Subscribers

1. Visit the app URL and sign in with Twitch
2. Verify Tier 3 subscription status
3. Upload a custom alert (max 10 seconds, video or audio)
4. Wait for moderation (typically 1-5 minutes)
5. Once approved, trigger in chat with `!myalert`

### For Broadcasters

#### Admin Panel

- View pending/approved/denied alerts
- Manually approve or deny submissions
- Adjust settings (cooldown, max duration, etc.)
- Toggle global mute

#### Chat Commands

- `!alerts off` - Mute all alerts (mods/broadcaster only)
- `!alerts on` - Unmute alerts (mods/broadcaster only)

## Moderation Policy

The system enforces a **"one step stronger than Twitch ToS"** policy. Content is automatically denied if it contains:

- Sexual content, nudity, sexualized sounds
- Hate speech, harassment, slurs
- Violence, threats, self-harm
- Illegal activity, dangerous acts
- Personal information (doxxing)
- Copyrighted music without license
- Political persuasion content
- References to minors in adult contexts
- Targeted profanity

See `moderation/policy.json` for the full policy configuration.

## API Endpoints

### Public
- `GET /api/auth/twitch` - Start Twitch OAuth
- `GET /api/auth/twitch/callback` - OAuth callback
- `GET /api/me` - Get current user info
- `POST /api/alerts` - Create alert (Tier 3 only)
- `GET /api/alerts` - Get user's alerts
- `GET /api/alerts/:id` - Get alert details
- `DELETE /api/alerts/:id` - Delete alert

### Admin (Broadcaster only)
- `GET /api/admin/settings` - Get settings
- `PATCH /api/admin/settings` - Update settings
- `GET /api/admin/reviews` - Get review queue
- `POST /api/admin/alerts/:id/approve` - Approve alert
- `POST /api/admin/alerts/:id/deny` - Deny alert

### Internal
- `POST /api/webhooks/eventsub` - EventSub webhook
- `POST /api/overlay/trigger` - Trigger overlay alert

## Troubleshooting

### Moderation Pipeline Failures

- Check FFmpeg is installed: `ffmpeg -version`
- Check Tesseract is installed: `tesseract --version`
- Verify OpenAI API key is valid
- Check worker logs: `docker-compose logs -f worker`

### Chat Commands Not Working

- Verify EventSub subscription is active
- Check bot has correct OAuth scopes
- Ensure bot is moderator in channel (or broadcaster has `channel:bot` scope)
- Check webhook signature verification

### Overlay Not Showing Alerts

- Verify WebSocket connection in browser console
- Check firewall/network allows WebSocket connections
- Ensure CDN URLs are accessible
- Test overlay URL directly in browser

## Security Considerations

- **Never commit** `.env` file or tokens to git
- Rotate OAuth tokens regularly (Twitch tokens expire)
- Use HTTPS in production
- Enable rate limiting on upload endpoints
- Implement CAPTCHA for upload form (optional)
- Regularly review audit logs for abuse

## Performance Optimization

- Use CDN for serving approved alerts (CloudFront, Cloudflare, etc.)
- Scale workers horizontally for faster moderation
- Consider GPU for Whisper transcription (faster)
- Cache subscription status (TTL: 5 minutes)
- Implement Redis caching for settings

## License

[Your License Here]

## Support

For issues and feature requests, please open an issue on GitHub.

## Credits

Built for the Twitch community by [Your Name/Team].

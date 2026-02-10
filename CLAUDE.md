# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Match Note is a real-time opinion aggregation platform for sports matches (primarily soccer). Users submit anonymous votes with stances (support/oppose/neutral) and comments. The system uses OpenAI to cluster opinions into topics and generates interactive visualizations showing opinion distributions across categories.

## Commands

### Development
```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

### Environment Setup
1. Copy `.env.local.example` to `.env.local`
2. Configure required environment variables:
   - `NEXTAUTH_URL` and `NEXTAUTH_SECRET` for NextAuth
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for database
   - `OPENAI_API_KEY` for AI summarization
   - `CRON_SECRET` for cron job authentication

### Database Setup
```bash
# Run the schema on your Supabase instance
psql -h <supabase-host> -U postgres -d postgres -f supabase/schema.sql
```

## Architecture

### Core Data Flow

1. **User Input** → Users submit votes (stance + comment) via the main page
2. **Storage** → Votes stored in Supabase `votes` table
3. **AI Summarization** → Cron job (`/api/jobs/summarize`) aggregates votes using OpenAI
4. **Clustering** → AI groups comments into topics with support/oppose/neutral counts
5. **Visualization** → Topic maps render opinion points in 2D space with interactive zoom/pan

### Key Components

**Frontend (src/app/page.tsx)**
- Main page is a client component using `next-auth` session management
- `MapCard` component renders interactive topic maps with `react-zoom-pan-pinch`
- Uses SVG for category circles and absolute-positioned buttons for opinion points
- Pseudo-random distribution places points within category circles
- Fullscreen mode available for detailed exploration

**API Routes**
- `POST /api/rooms/[roomId]/votes` - Submit new vote (requires auth)
- `GET /api/rooms/[roomId]/summary` - Fetch latest aggregated summary
- `POST|GET /api/jobs/summarize` - Trigger AI summarization (cron-protected)

**Authentication (src/lib/auth.ts)**
- NextAuth with Google OAuth provider
- JWT session strategy
- Session includes user ID for vote attribution

**Database (src/lib/supabase.ts)**
- Admin client with `persistSession: false`
- Two tables: `votes` (raw submissions) and `summaries` (AI-generated aggregations)
- Indexes on room_id and created_at for efficient queries

### Type System (src/lib/types.ts)

Core types define the data contracts:
- `Stance`: "support" | "oppose" | "neutral"
- `VoteInput`: User submission payload
- `TopicSummary`: Aggregated topic with counts and stance-specific summaries
- `RoomSummary`: Full room state with all topics

### AI Summarization Logic (src/app/api/jobs/summarize/route.ts)

- Fetches last 200 votes for a room
- Uses `gpt-4o-mini` via OpenAI Responses API
- Expects JSON output with up to 5 topics
- Each topic includes title, vote counts, and 2-3 sentence summaries per stance
- Normalizes various JSON formats (handles arrays/strings flexibly)
- Stores result in `summaries` table as JSONB payload

### Map Visualization Algorithm

1. **Category Layout**: Pre-defined centers in `categoryCenters` array (8 positions)
2. **Point Distribution**: Pseudo-random polar coordinates within category radius
3. **Interactive Features**:
   - Zoom/pan with TransformWrapper
   - Click points to display related opinions
   - Fullscreen overlay mode
4. **Responsive**: Different heights and scales for mobile/desktop

## Important Patterns

### Path Alias
Use `@/*` to import from `src/*` (configured in tsconfig.json)

### Server vs Client
- API routes and auth are server-side
- Main page and map components are client-side ("use client")
- Providers wrapper enables client-side session context

### Mock Data Fallback
If database is empty or unreachable, `mockSummary` from `src/lib/mock.ts` provides demo data

### Cron Job Security
The summarize endpoint checks for:
- `x-cron-secret` header matching `CRON_SECRET`
- Query param `?secret=` matching `CRON_SECRET`
- Vercel cron indicator `x-vercel-cron: 1`

### CSS Custom Properties
The design uses CSS variables like `var(--line)`, `var(--panel-ink)`, `var(--accent)` - these are defined in `globals.css`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **React**: 19.2.3
- **Auth**: NextAuth 4 with Google OAuth
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API (gpt-4o-mini)
- **Styling**: Tailwind CSS 4
- **Interactive Maps**: react-zoom-pan-pinch
- **TypeScript**: Strict mode enabled

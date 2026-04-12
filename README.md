# Kanban Task Board - SDE Assessment

## Live Demo
**TODO**: Deploy to Vercel: `vercel deploy` (see Deploy section)

## Build Plan
Follow the project delivery plan in [BUILD_PLAN.md](./BUILD_PLAN.md) for setup, Supabase integration, drag-and-drop, UI polish, and deployment.

## Avoid These Mistakes
- ❌ Clunky drag-and-drop: Make drag-and-drop smooth and intuitive.

## Quick Start (Local)
From the project folder:
cd ~/Desktop/kanban-task-board
open index.html


Or run a local web server and open it in the browser:
cd /Users/sujithrallapalli/Desktop/kanban-task-board
python3 -m http.server 8000

then open:
http://localhost:8000

If port 8000 is already in use, try:
python3 -m http.server 8080

then open:
http://localhost:8080

**Workflow**: Click "+ New Task" to create tasks (they start in "To Do"). Drag tasks between columns to change their status!


## �� Database Setup (Required)
Follow [supabase-setup.md](./supabase-setup.md):
1. Create Supabase project + run SQL
2. Update `app.js` with your `SUPABASE_URL` + `SUPABASE_ANON_KEY`
3. Test: Create task → verify in Supabase dashboard

## Features Implemented
✅ **Required**:
- [x] Drag & drop across 4 columns (To Do → In Progress → In Review → Done) - **Elegant implementation with smooth animations and visual feedback**
- [x] Guest auth + RLS (users see only own tasks)
- [x] Create tasks (title, desc, priority, due date) - **Tasks created in "To Do" column, drag to change status**
- [x] Real-time persistence
- [x] Delete tasks
- [x] Responsive UI + loading/error states
- [x] LocalStorage fallback

✅ **Advanced**:
- [x] Priority badges
- [x] Due dates
- [x] Stats (total tasks)

## Deploy to Vercel
```bash
npm i -g vercel
vercel
# Follow prompts → live URL ready!
```

## Tech Stack
- Vanilla JS + modern ES modules
- Supabase (DB + Auth + RLS)
- Custom mouse-based drag & drop (no HTML5 Drag API)
- CDN-hosted Supabase client (no build step)

## Database Schema
```sql
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','in_review','done')),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT,
  priority TEXT CHECK (priority IN ('low','normal','high')),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: auth.uid() = user_id
```

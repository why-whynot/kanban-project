# Kanban Task Board Assessment Submission

Candidate: `[Your Full Name]`  
Date: `April 12, 2026`

## Overview
I built a Kanban-style task board focused on visual polish, clear task management, and secure guest access. The experience is designed to feel closer to a lightweight product than a basic todo list, with a strong emphasis on hierarchy, smooth interactions, and readable status cues.

The app uses vanilla HTML, CSS, and JavaScript with Supabase for persistence and anonymous authentication. I chose this stack to keep the app lightweight, fast to load, and easy to deploy while still meeting the full assessment requirements.

## Live App
- Live frontend URL: `[Add deployed URL]`
- GitHub repository: `[Add repository URL]`

## Design Decisions
- Used a card-based Kanban layout with strong spacing, gradients, shadows, and a clear status structure inspired by modern task tools.
- Added a guest account landing page so users start with a clear entry point before entering the board.
- Kept the interaction model direct: create a task, edit a task by clicking it, move it by dragging.
- Added summary stats and due-date indicators so the board communicates workload at a glance.

## Required Features Implemented
- Four default columns: `To Do`, `In Progress`, `In Review`, `Done`
- Drag-and-drop task movement between columns
- Guest account support with Supabase anonymous sign-in
- User-scoped tasks using `user_id`
- Supabase persistence
- Task creation with title, description, priority, and due date
- Loading, error, and empty states
- Responsive layout for smaller screens

## Additional Features
- Task editing and deletion
- Username display in the header
- Overdue task highlighting
- Summary stats for total, completed, and overdue tasks
- Local storage fallback if Supabase is unavailable

## Database Schema
```sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null check (status in ('todo', 'in_progress', 'in_review', 'done')),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  description text,
  priority text default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_own"
on public.tasks
for select
using (
  auth.uid() = user_id
  or owner_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'username_key', '')
);

create policy "tasks_insert_own"
on public.tasks
for insert
with check (
  auth.uid() = user_id
  or owner_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'username_key', '')
);

create policy "tasks_update_own"
on public.tasks
for update
using (
  auth.uid() = user_id
  or owner_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'username_key', '')
)
with check (
  auth.uid() = user_id
  or owner_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'username_key', '')
);

create policy "tasks_delete_own"
on public.tasks
for delete
using (
  auth.uid() = user_id
  or owner_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'username_key', '')
);
```

## Local Setup Instructions
```bash
cd /Users/sujithrallapalli/Desktop/kanban-task-board
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

If using a fresh Supabase project:
1. Enable anonymous sign-in.
2. Run the SQL schema and RLS policies.
3. Add your project URL and anon key to `app.js`.

## Tradeoffs
- I chose vanilla JavaScript over React to keep the app smaller and reduce setup overhead.
- I used direct Supabase access from the client rather than adding a separate backend API because the assessment can be completed securely with anonymous auth and RLS.
- Drag and drop is custom-built rather than using a library, which gives more visual control but requires more manual handling.

## What I Would Improve With More Time
- Add search and filtering by priority or status
- Add labels/tags and assignees
- Add a task details panel with comments and activity history
- Improve keyboard accessibility for drag-and-drop interactions
- Move Supabase config into a cleaner environment-driven setup for multi-environment deployment

# Supabase Setup

## 1. Create the Project
1. Create a free Supabase project.
2. In Authentication settings, enable anonymous sign-ins.

## 2. Create the `tasks` Table
Run this in the SQL editor:

```sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null check (status in ('todo', 'in_progress', 'in_review', 'done')),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text,
  priority text default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  created_at timestamptz not null default now()
);
```

## 3. Enable RLS
Run this next:

```sql
alter table public.tasks enable row level security;

create policy "tasks_select_own"
on public.tasks
for select
using (auth.uid() = user_id);

create policy "tasks_insert_own"
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy "tasks_update_own"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tasks_delete_own"
on public.tasks
for delete
using (auth.uid() = user_id);
```

## 4. Connect the Frontend
Update the constants near the top of [app.js](/Users/sujithrallapalli/Desktop/kanban-task-board/app.js) with your project URL and public anon key.

## 5. Verify
1. Start the app locally.
2. Open it in a normal browser window and create a task.
3. Open it again in an incognito window and confirm you see a separate anonymous guest workspace.
4. Confirm tasks are isolated by `user_id` in Supabase.

# 3–6 Hour Kanban Board Build Plan

This is a focused plan to deliver a polished, working Kanban board quickly while still scoring well on design and functionality.

## ⚡ 0. Strategy First (5–10 min)

Goal: Ship a clean MVP + 1–2 standout features.

Stack:
- React + TypeScript (Vite or Next.js)
- Supabase (DB + Auth)
- Drag & drop: @dnd-kit

## 🧱 Hour 1 — Project Setup + Supabase

1. Create Project
   - Initialize React app.
   - Install:
     - Supabase client
     - @dnd-kit/core and @dnd-kit/sortable
     - Tailwind (optional but fast)
2. Set Up Supabase
   - Create project.
   - Create tasks table:
     - `id uuid primary key default uuid_generate_v4()`
     - `title text not null`
     - `status text`
     - `user_id uuid`
     - `created_at timestamp default now()`
3. Enable Auth (Guest)
   - Enable anonymous sign-in.
   - On app load:
     - create a session if none exists
     - store the user_id
4. Enable RLS
   - Policy: `user_id = auth.uid()`

## 🎯 Hour 2 — Basic UI + Data Flow

5. Build Board Layout
   - 4 columns: To Do, In Progress, In Review, Done.
   - Component structure: `Board` → `Column` → `TaskCard`.
6. Fetch Tasks
   - Query tasks by `user_id`.
   - Group by `status`.
7. Create Task
   - Simple input with required title.
   - Insert into Supabase.
   - Default status: `todo`.

## 🔄 Hour 3 — Drag & Drop (Core Feature)

8. Add Drag-and-Drop
   - Use `@dnd-kit`.
   - Make tasks draggable.
   - Make columns droppable.
9. Update Status on Drop
   - On drop, update status in DB.
   - Optimistically update UI.

## 🎨 Hour 4 — Polish UI (HIGH IMPACT)

10. Make It Look Good
    - Rounded cards.
    - Shadows and padding.
    - Good column spacing.
    - Subtle hover effects.
11. Improve UX
    - Empty state: “No tasks yet”.
    - Loading spinner or skeleton.
    - Basic error handling toast/text.
12. Add Simple Styling System
    - 2–3 colors max.
    - Consistent spacing.
    - Clean font like Inter.

## ⭐ Hour 5 — Add 1–2 Standout Features

Pick only 1–2 quick wins:
- Option A: Priority (low/normal/high) badge.
- Option B: Due date + overdue highlight.
- Option C: Search/filter by title.

## 🚀 Hour 6 — Deploy + Finalize

13. Deploy
    - Use Vercel for fastest deployment.
    - Add environment variables.
14. Clean Code + Structure
    - Separate:
      - `components/`
      - `hooks/`
      - `lib/supabase.ts`
15. Write Submission Doc
    - What you built.
    - Tech choices.
    - Features.
    - Tradeoffs.
    - Future improvements.

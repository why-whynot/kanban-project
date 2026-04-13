# Kanban Task Board

A polished Kanban-style task board built for the Next Play Games software development assessment. The app uses Supabase anonymous auth plus row-level security so each guest only sees their own tasks.

## Features
- Four-column Kanban board: `To Do`, `In Progress`, `In Review`, `Done`
- Guest account landing page with username display
- Create, edit, delete, and drag tasks between columns
- Supabase persistence with local fallback storage
- Priority, due date, overdue highlighting, and board summary stats
- Responsive UI, loading feedback, empty states, and toast errors

## Local Run
Serve the folder over HTTP so module imports work reliably:

```bash
cd /Users/sujithrallapalli/Desktop/kanban-task-board
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Supabase Setup
Use the steps in [supabase-setup.md](/Users/sujithrallapalli/Desktop/kanban-task-board/supabase-setup.md).

## Deploy
This project is configured for static hosting on Vercel.

```bash
npm i -g vercel
vercel --prod
```

After deployment, add the production URL to the final assessment document.

## Files
- [index.html](/Users/sujithrallapalli/Desktop/kanban-task-board/index.html): app structure and UI
- [style.css](/Users/sujithrallapalli/Desktop/kanban-task-board/style.css): styling and responsive layout
- [app.js](/Users/sujithrallapalli/Desktop/kanban-task-board/app.js): auth, data, rendering, drag and drop
- [firstname_lastname_task_manager_assessment.md](/Users/sujithrallapalli/Desktop/kanban-task-board/firstname_lastname_task_manager_assessment.md): editable final submission draft

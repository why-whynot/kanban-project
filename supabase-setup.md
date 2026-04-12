# Supabase Database Setup for Kanban Task Board

## 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose free tier, set name/password/region
3. Wait for DB to be ready (~2min)

## 2. Enable Auth (Guest Accounts)
- Dashboard → Authentication → Settings → Enable "Anonymous sign-ins"

## 3. Create Tasks Table + RLS
Go to SQL Editor and run **exactly**:

```sql
-- Create tasks table matching app.js schema
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

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users only access own tasks
CREATE POLICY "user_tasks" ON tasks 
FOR ALL 
USING (auth.uid()::text = user_id::text);
```

## 4. Get Credentials
- Settings → API
- Copy **Project URL** and **anon/public key**

## 5. Update app.js
Replace placeholders:
```
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

## Test
1. `open index.html`
2. Create task → check Supabase dashboard → Table Editor → tasks
3. Drag task → status updates in real-time
4. Open incognito → different guest sees own tasks only

**✅ Done! Database ready with persistence + security.**

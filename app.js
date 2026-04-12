// Kanban Task Board - Full Implementation
// Supabase + Drag & Drop + Guest Auth + RLS Ready

console.log('Kanban app script loaded');

let supabase;
let user = null;
let tasks = [];
const statuses = ['todo', 'in_progress', 'in_review', 'done'];

// Supabase config - REPLACE WITH YOUR PROJECT CREDENTIALS
const SUPABASE_URL = 'https://oeongqjjfnenfzjdrhwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lb25ncWpqZm5lbmZ6amRyaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTUwMTEsImV4cCI6MjA5MTU5MTAxMX0.qZc0qtn8AWpCW5v7W3lLH-ucwkb1KEOEID394dDRN_A';

class KanbanApp {
  constructor() {
    this.initialization = null;
    this.authReady = false;
    this.editingTaskId = null;

    // Bind UI events immediately for responsiveness
    this.bindEvents();

    // Initialize backend and auth
    this.initialization = this.start();
  }

  async start() {
    await this.initSupabase();
  }

  async initSupabase() {
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const createClient = mod.createClient || (mod.default && mod.default.createClient);
      if (!createClient) {
        throw new Error('Supabase createClient not found in imported module');
      }
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client created');
      await this.initAuth();
    } catch (error) {
      console.warn('Supabase init failed:', error?.message || error, '- using localStorage fallback');
      this.useLocalStorage();
    }
  }

  async initAuth() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }
      console.log('Auth session retrieved:', session);

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        user = data.user;
        console.log('Guest user created:', user.id);
      } else {
        user = session.user;
        console.log('Existing user session:', user.id);
      }

      console.log('Supabase ready, user id:', user?.id);
      this.authReady = true;
      await this.loadTasks();
    } catch (error) {
      console.error('Auth error:', error);
      this.useLocalStorage();
    }
  }

  useLocalStorage() {
    // Fallback for demo
    user = { id: 'demo-guest-' + Date.now() };
    this.authReady = true;
    this.loadTasks();
  }

  bindEvents() {
    console.log('🔧 bindEvents() executed');

    const addTaskBtn = document.getElementById('add-task-btn');
    const taskForm = document.getElementById('task-form');
    const cancelTask = document.getElementById('cancel-task');

    if (!addTaskBtn || !taskForm || !cancelTask) {
      console.error('❌ bindEvents error: missing UI elements', {
        addTaskBtn,
        taskForm,
        cancelTask
      });
      return;
    }

    addTaskBtn.addEventListener('click', () => {
      console.log('🆕 Add task button clicked!');
      this.showTaskModal();
    });

    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitTask();
    });

    cancelTask.addEventListener('click', () => this.hideTaskModal());

    this.setupTaskInteractions();
  }

  async submitTask() {
    if (this.editingTaskId) {
      await this.updateTask(this.editingTaskId);
    } else {
      await this.createTask();
    }
  }

  async loadTasks() {
    document.body.classList.add('loading');
    
    try {
      if (supabase && user) {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        tasks = data || [];
      } else {
        // LocalStorage fallback
        const stored = localStorage.getItem(`tasks_${user.id}`);
        tasks = stored ? JSON.parse(stored) : [];
      }
      
      this.renderBoard();
      this.updateStats();
    } catch (error) {
      console.error('Load tasks error:', error);
      this.showError('Failed to load tasks');
    } finally {
      document.body.classList.remove('loading');
    }
  }

  async createTask() {
    if (this.initialization) {
      await this.initialization;
    }

    const title = document.getElementById('task-title').value.trim();
    if (!title) {
      this.showError('Title is required');
      return;
    }

    if (supabase && !this.authReady) {
      console.warn('Supabase initialized but auth is not ready yet.');
      this.showError('Supabase auth is not ready yet. Saving locally.');
    }

    if (!supabase) {
      console.warn('Supabase client unavailable. Using local storage only.');
      this.showError('Supabase unavailable. Task saved locally.');
    }

    const newTask = {
      id: `local-${Date.now()}`, // Generate ID for local mode
      title,
      description: document.getElementById('task-description').value.trim(),
      status: document.getElementById('task-status').value || 'todo',
      priority: document.getElementById('task-priority').value,
      due_date: document.getElementById('task-due-date').value || null,
      user_id: user?.id || 'demo-user',
      created_at: new Date().toISOString()
    };

    try {
      console.log('Creating task:', newTask);

      // Always update local state first
      tasks.unshift(newTask);
      let savedToSupabase = false;

      if (supabase && user) {
        const insertTask = { ...newTask };
        delete insertTask.id; // let Supabase generate the UUID

        const { data, error } = await supabase
          .from('tasks')
          .insert([insertTask])
          .select()
          .single();

        if (error) {
          console.warn('Supabase insert failed, using local:', error.message);
          this.showError('Task saved locally, but Supabase insert failed.');
        } else {
          // Sync ID if Supabase succeeded
          tasks[0].id = data.id;
          savedToSupabase = true;
          console.log('Supabase task created:', data.id);
        }
      } else {
        if (supabase && !user) {
          console.warn('Supabase client available but user is missing. Saving locally.');
          this.showError('Supabase auth failed, task saved locally.');
        } else {
          console.log('Using localStorage only');
        }
      }

      // Always persist to localStorage as backup
      localStorage.setItem(`tasks_${user?.id || 'demo'}`, JSON.stringify(tasks));

      this.renderBoard();
      this.updateStats();
      this.hideTaskModal();
      document.getElementById('task-form').reset();

      if (savedToSupabase) {
        this.showSuccess('Task created successfully!');
      } else if (!supabase || !user) {
        this.showSuccess('Task saved locally. Supabase unavailable.');
      }
    } catch (error) {
      console.error('Create task failed:', error);
      this.showError('Failed to create task. Using local storage.');
      // Rollback optimistic update
      tasks.shift();
      this.renderBoard();
    }
  }

  async updateTask(taskId) {
    if (this.initialization) {
      await this.initialization;
    }

    const title = document.getElementById('task-title').value.trim();
    if (!title) {
      this.showError('Title is required');
      return;
    }

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const updatedTask = {
      ...tasks[taskIndex],
      title,
      description: document.getElementById('task-description').value.trim(),
      status: document.getElementById('task-status').value || 'todo',
      priority: document.getElementById('task-priority').value,
      due_date: document.getElementById('task-due-date').value || null
    };

    tasks[taskIndex] = updatedTask;

    try {
      if (supabase && user) {
        const updatePayload = {
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          priority: updatedTask.priority,
          due_date: updatedTask.due_date
        };

        const { data, error } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', taskId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          console.warn('Supabase update failed, using local data:', error.message);
          this.showError('Could not save changes to Supabase. Changes are local only.');
        } else {
          tasks[taskIndex] = { ...updatedTask, id: data.id };
          console.log('Supabase task updated:', data.id);
        }
      }

      localStorage.setItem(`tasks_${user?.id || 'demo'}`, JSON.stringify(tasks));
      this.renderBoard();
      this.updateStats();
      this.hideTaskModal();
      document.getElementById('task-form').reset();
      this.editingTaskId = null;
      this.showSuccess('Task updated successfully!');
    } catch (error) {
      console.error('Update task failed:', error);
      this.showError('Failed to update task.');
    }
  }

  async updateTaskStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = newStatus;

    try {
      if (supabase) {
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      // LocalStorage update
      localStorage.setItem(`tasks_${user.id}`, JSON.stringify(tasks));
      
      this.renderBoard();
      this.updateStats();
    } catch (error) {
      console.error('Update error:', error);
    }
  }

  renderBoard() {
    statuses.forEach(status => {
      const container = document.getElementById(`${status}-tasks`) || document.getElementById(`${status.replace(/_/g, '-')}-tasks`);
      if (!container) {
        console.warn(`Missing task container for status: ${status}`);
        return;
      }

      const statusTasks = tasks.filter(task => task.status === status);
      
      if (statusTasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks yet. Click + New Task to add one!</div>';
        return;
      }

      container.innerHTML = statusTasks.map(task => `
        <div class="task priority-${task.priority}" data-id="${task.id}">
          <button class="task-delete" data-id="${task.id}" aria-label="Delete task">×</button>
          <div class="task-title">${task.title}</div>
          ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
          <div class="task-meta">
            <span>${new Date(task.created_at).toLocaleDateString()}</span>
            ${task.due_date ? `<span>${task.due_date}</span>` : ''}
          </div>
        </div>
      `).join('');
    });
  }

  async deleteTask(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    if (!window.confirm('Delete this task?')) {
      return;
    }

    const [removedTask] = tasks.splice(taskIndex, 1);

    try {
      if (supabase && user) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', user.id);
        if (error) {
          console.warn('Supabase delete failed:', error.message);
        }
      }

      localStorage.setItem(`tasks_${user?.id || 'demo'}`, JSON.stringify(tasks));
      this.renderBoard();
      this.updateStats();
      this.showSuccess('Task deleted.');
    } catch (error) {
      console.error('Delete task failed:', error);
      // restore on failure
      tasks.splice(taskIndex, 0, removedTask);
      this.renderBoard();
      this.updateStats();
      this.showError('Failed to delete task.');
    }
  }

  updateStats() {
    document.getElementById('total-tasks').textContent = tasks.length;
  }

  setupTaskInteractions() {
    const board = document.getElementById('board');

    board.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.task-delete');
      if (deleteBtn) {
        e.stopPropagation();
        const taskId = deleteBtn.dataset.id;
        this.deleteTask(taskId);
        return;
      }

      const taskCard = e.target.closest('.task');
      if (!taskCard) return;

      const taskId = taskCard.dataset.id;
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        this.showTaskModal(true, task);
      }
    });
  }

  showTaskModal(editMode = false, task = null) {
    console.log('📱 showTaskModal() called - adding active class');
    
    const modal = document.getElementById('task-modal');
    const titleInput = document.getElementById('task-title');
    const submitButton = document.querySelector('#task-form button[type="submit"]');

    if (!modal || !titleInput) {
      console.error('❌ showTaskModal error: missing modal or title input', { modal, titleInput });
      return;
    }

    try {
      modal.classList.add('active');
      titleInput.focus();

      if (editMode && task) {
        document.getElementById('modal-title').textContent = 'Edit Task';
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-priority').value = task.priority || 'normal';
        document.getElementById('task-status').value = task.status || 'todo';
        document.getElementById('task-due-date').value = task.due_date || '';
        this.editingTaskId = task.id;
        if (submitButton) submitButton.textContent = 'Save Changes';
      } else {
        this.editingTaskId = null;
        document.getElementById('modal-title').textContent = 'New Task';
        document.getElementById('task-form').reset();
        if (submitButton) submitButton.textContent = 'Create Task';
      }
    } catch (error) {
      console.error('❌ showTaskModal error:', error);
    }
  }

  hideTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    document.getElementById('task-form')?.reset();
    this.editingTaskId = null;
  }

  showError(message) {
    // Simple toast
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#ef4444;color:white;padding:12px 20px;border-radius:8px;z-index:10000;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 20px;border-radius:8px;z-index:10000;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready - starting KanbanApp');
  new KanbanApp();
});

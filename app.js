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
    this.dragTestMode = false; // Add test mode flag

    // Drag and drop state variables
    this.draggedTask = null;
    this.draggedElement = null;
    this.placeholder = null;
    this.startColumn = null;
    this.initialX = 0;
    this.initialY = 0;
    this.isDragging = false;

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

    // Add test mode toggle (double-click header)
    const header = document.querySelector('header h1');
    if (header) {
      header.addEventListener('dblclick', () => {
        this.dragTestMode = !this.dragTestMode;
        console.log('🎯 Drag test mode:', this.dragTestMode ? 'ON' : 'OFF');
        this.showTestNotification(this.dragTestMode ? 'Test Mode ON - Drag feedback enabled' : 'Test Mode OFF');
        this.updateTestVisuals();
      });
    }

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
      this.updateTestVisuals();
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
      status: 'todo', // Always create tasks in todo status
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
      // Don't change status in edit mode - use drag and drop for status changes
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
        <div class="task priority-${task.priority}" data-id="${task.id}" data-status="${task.status}">
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
    let wasDragged = false;

    // Click handlers for delete and edit
    board.addEventListener('click', (e) => {
      // Prevent click if we just finished dragging
      if (wasDragged) {
        wasDragged = false;
        return;
      }

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

    // Drag and drop functionality
    this.setupDragAndDrop(() => { wasDragged = true; });
  }

  setupDragAndDrop(onDragComplete) {
    const handleMouseDown = (e) => {
      const task = e.target.closest('.task');
      if (!task || e.target.closest('.task-delete')) return;

      e.preventDefault();
      this.draggedTask = task;
      this.draggedElement = task;
      this.startColumn = task.closest('.column');
      this.initialX = e.clientX;
      this.initialY = e.clientY;
      this.isDragging = false;
      task.style.cursor = 'grabbing';

      if (this.dragTestMode) {
        console.log('🎯 Drag started on task:', task.dataset.id);
      }
    };

    const handleMouseMove = (e) => {
      if (!this.draggedTask) return;

      if (!this.isDragging) {
        const deltaX = Math.abs(e.clientX - this.initialX);
        const deltaY = Math.abs(e.clientY - this.initialY);
        if (deltaX < 10 && deltaY < 10) return; // Minimum drag distance

        this.isDragging = true;
        if (this.dragTestMode) {
          console.log('🚀 Drag initiated - starting visual drag');
        }
        this.startDrag(this.draggedTask);
      }

      if (this.isDragging) {
        this.updateDragPosition(e);
        this.updateDropTarget(e);
      }
    };

    const handleMouseUp = async (e) => {
      if (!this.draggedTask) return;

      if (this.isDragging) {
        if (this.dragTestMode) {
          console.log('✅ Drag finished - processing drop');
        }
        await this.finishDrag(e);
        if (onDragComplete) onDragComplete();
      } else {
        if (this.dragTestMode) {
          console.log('👆 Just a click, not a drag');
        }
        this.draggedTask.style.cursor = '';
      }

      this.draggedTask = null;
      this.draggedElement = null;
      this.placeholder = null;
      this.startColumn = null;
      isDragging = false;
    };

    const handleContextMenu = (e) => {
      if (this.draggedTask) {
        e.preventDefault();
        return false;
      }
    };

    const handleSelectStart = (e) => {
      if (this.draggedTask) {
        e.preventDefault();
        return false;
      }
    };

    const handleDragStart = (e) => {
      if (this.draggedTask) {
        e.preventDefault();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
  }

  startDrag(task) {
    draggedElement = task;
    
    // Add dragging class
    task.classList.add('dragging');
    
    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'task-placeholder';
    placeholder.style.height = `${task.offsetHeight}px`;
    
    // Insert placeholder
    task.parentNode.insertBefore(placeholder, task.nextSibling);
    
    // Make task follow mouse
    task.style.position = 'fixed';
    task.style.zIndex = '1000';
    task.style.pointerEvents = 'none';
    task.style.width = `${task.offsetWidth}px`;
    task.style.transform = 'rotate(2deg) scale(1.02)';
    task.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2)';
    task.style.transition = 'none';
    
    // Add smooth transition for drop
    setTimeout(() => {
      task.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
    }, 0);
  }

  updateDragPosition(e) {
    if (!draggedElement) return;
    
    const rect = draggedElement.getBoundingClientRect();
    const x = e.clientX - rect.width / 2;
    const y = e.clientY - rect.height / 2;
    
    draggedElement.style.left = `${x}px`;
    draggedElement.style.top = `${y}px`;
  }

  updateDropTarget(e) {
    // Clear previous highlights
    this.clearDropHighlights();
    
    // Find column under mouse
    const columns = document.querySelectorAll('.column');
    for (const column of columns) {
      const rect = column.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && 
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        column.classList.add('drop-target');
        break;
      }
    }
  }

  async finishDrag(e) {
    const dropColumn = document.querySelector('.column.drop-target');
    const newStatus = dropColumn ? dropColumn.dataset.status : null;
    const taskId = draggedElement.dataset.id;
    const currentStatus = draggedElement.dataset.status;

    // Reset styles
    draggedElement.style.position = '';
    draggedElement.style.zIndex = '';
    draggedElement.style.pointerEvents = '';
    draggedElement.style.width = '';
    draggedElement.style.left = '';
    draggedElement.style.top = '';
    draggedElement.style.transform = '';
    draggedElement.style.boxShadow = '';
    draggedElement.style.transition = '';
    draggedElement.classList.remove('dragging');

    // Remove placeholder
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    // Clear highlights
    this.clearDropHighlights();

    // Handle drop
    if (dropColumn && newStatus && newStatus !== currentStatus) {
      // Move to new column
      const tasksContainer = dropColumn.querySelector('.tasks');
      if (tasksContainer) {
        tasksContainer.appendChild(draggedElement);
        await this.updateTaskStatus(taskId, newStatus);
        
        // Success animation
        draggedElement.style.transform = 'scale(1.05)';
        draggedElement.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.3)';
        draggedElement.classList.add('success-move');
        setTimeout(() => {
          draggedElement.style.transform = '';
          draggedElement.style.boxShadow = '';
          draggedElement.classList.remove('success-move');
        }, 600);
      }
    } else if (dropColumn && newStatus === currentStatus) {
      // Same column, just reorder
      const tasksContainer = dropColumn.querySelector('.tasks');
      if (tasksContainer) {
        tasksContainer.appendChild(draggedElement);
      }
    } else {
      // Invalid drop, return to original position
      if (startColumn) {
        const tasksContainer = startColumn.querySelector('.tasks');
        if (tasksContainer) {
          tasksContainer.appendChild(draggedElement);
        }
      }
      
      // Error animation
      draggedElement.style.transform = 'scale(0.95)';
      setTimeout(() => {
        draggedElement.style.transform = '';
      }, 200);
    }
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

  showTestNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }

  updateTestVisuals() {
    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => {
      if (this.dragTestMode) {
        task.style.border = '2px solid #3b82f6';
        task.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
      } else {
        task.style.border = '';
        task.style.boxShadow = '';
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready - starting KanbanApp');
  new KanbanApp();
});

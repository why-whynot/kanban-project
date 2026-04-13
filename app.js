// Kanban Task Board - Full Implementation
// Supabase + Drag & Drop + Guest Auth + RLS Ready

console.log('Kanban app script loaded');

let supabase;
let user = null;
let tasks = [];
const statuses = ['todo', 'in_progress', 'in_review', 'done'];

const SUPABASE_URL = 'https://oeongqjjfnenfzjdrhwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lb25ncWpqZm5lbmZ6amRyaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTUwMTEsImV4cCI6MjA5MTU5MTAxMX0.qZc0qtn8AWpCW5v7W3lLH-ucwkb1KEOEID394dDRN_A';

class KanbanApp {
  constructor() {
    this.initialization = null;
    this.authReady = false;
    this.editingTaskId = null;
    this.dragTestMode = false;
    this.tasksLoaded = false;

    // Drag and drop state variables
    this.draggedTask = null;
    this.draggedElement = null;
    this.ghostElement = null;
    this.placeholder = null;
    this.startColumn = null;
    this.initialX = 0;
    this.initialY = 0;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.isDragging = false;

    // Bind UI events immediately for responsiveness
    this.bindEvents();

    // Show guest page first, then init
    this.showGuestPage();
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
      this.loadUsername();
      // Don't load tasks yet - stay on guest page until username set
    } catch (error) {
      console.error('Auth error:', error);
      this.useLocalStorage();
    }
  }

  useLocalStorage() {
    // Stable fallback identity for offline/demo usage
    user = { id: this.getLocalGuestId() };
    this.authReady = true;
    this.loadUsername();
    // Don't load tasks - stay on guest page
  }

  getLocalGuestId() {
    const storageKey = 'kanban-local-guest-id';
    let guestId = localStorage.getItem(storageKey);
    if (!guestId) {
      guestId = `demo-guest-${Date.now()}`;
      localStorage.setItem(storageKey, guestId);
    }
    return guestId;
  }

  getTaskStorageKey() {
    return `tasks_${user?.id || this.getLocalGuestId()}`;
  }

  persistTasks() {
    localStorage.setItem(this.getTaskStorageKey(), JSON.stringify(tasks));
  }

  escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  isTaskOverdue(task) {
    if (!task?.due_date || this.isTaskDone(task)) {
      return false;
    }
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today;
  }

  getEmptyStateMessage(status) {
    const messages = {
      todo: 'No tasks in To Do yet. Create a task to start planning.',
      in_progress: 'Nothing is actively moving right now.',
      in_review: 'No tasks are waiting for review.',
      done: 'Done tasks will land here once work is finished.'
    };
    return messages[status] || 'No tasks yet.';
  }

  loadUsername() {
    const savedUsername = localStorage.getItem('kanban-username') || 'Guest';
    const usernameDisplay = document.getElementById('username-display');
    const usernameInput = document.getElementById('username-input');
    if (usernameDisplay) {
      usernameDisplay.textContent = savedUsername;
    }
    if (usernameInput && savedUsername !== 'Guest') {
      usernameInput.value = savedUsername;
    }

    this.showGuestPage();
  }

  showGuestPage() {
    const guestPage = document.getElementById('guest-page');
    const mainBoard = document.getElementById('main-board');
    if (guestPage) guestPage.style.display = 'flex';
    if (mainBoard) mainBoard.style.display = 'none';
  }

  async showBoard() {
    const guestPage = document.getElementById('guest-page');
    const mainBoard = document.getElementById('main-board');
    if (guestPage) guestPage.style.display = 'none';
    if (mainBoard) mainBoard.style.display = 'flex';
    if (!this.tasksLoaded) {
      await this.loadTasks();
      this.tasksLoaded = true;
      return;
    }
    this.renderBoard();
    this.updateStats();
  }

  hideGuestPage() {
    const guestPage = document.getElementById('guest-page');
    if (guestPage) guestPage.style.display = 'none';
  }

  showAccountModal() {
    this.showGuestPage();
    document.getElementById('username-input')?.focus();
  }

  hideAccountModal() {
    const savedUsername = localStorage.getItem('kanban-username') || 'Guest';
    if (savedUsername !== 'Guest') {
      this.showBoard();
    }
  }

  bindEvents() {
    console.log('🔧 bindEvents() executed');

    const addTaskBtn = document.getElementById('add-task-btn');
    const taskForm = document.getElementById('task-form');
    const cancelTask = document.getElementById('cancel-task');
    const setUsernameBtn = document.getElementById('set-username-btn');
    const accountForm = document.getElementById('account-form');

    if (!addTaskBtn || !taskForm || !cancelTask || !setUsernameBtn || !accountForm) {
      console.error('❌ bindEvents error: missing UI elements');
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

    // Guest account events
    setUsernameBtn.addEventListener('click', () => {
      console.log('👤 Set username clicked');
      this.showAccountModal();
    });

    accountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Account form submit triggered');
      this.saveUsername();
    });

    const skipGuestBtn = document.getElementById('skip-guest');
    if (skipGuestBtn) {
      skipGuestBtn.addEventListener('click', () => this.continueAsGuest());
    }

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
        const stored = localStorage.getItem(this.getTaskStorageKey());
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

  saveUsername() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput?.value.trim();

    if (!username) {
      this.showError('Please enter a username');
      usernameInput?.focus();
      return;
    }

    localStorage.setItem('kanban-username', username);
    document.getElementById('username-display').textContent = username;
    this.showSuccess('Username saved');
    this.showBoard();
  }

  continueAsGuest() {
    localStorage.setItem('kanban-username', 'Guest');
    document.getElementById('username-display').textContent = 'Guest';
    this.showBoard();
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
      this.persistTasks();

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

      this.persistTasks();
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

    const previousStatus = task.status;
    task.status = newStatus;

    try {
      if (supabase && user) {
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      this.persistTasks();
      
      this.renderBoard();
      this.updateStats();
    } catch (error) {
      console.error('Update error:', error);
      task.status = previousStatus;
      this.persistTasks();
      this.renderBoard();
      this.updateStats();
      this.showError('Could not move task. Please try again.');
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
        container.innerHTML = `<div class="empty-state">${this.getEmptyStateMessage(status)}</div>`;
        return;
      }

      container.innerHTML = statusTasks.map(task => {
        const isOverdue = this.isTaskOverdue(task);
        const overdueClass = isOverdue ? 'overdue' : '';
        const safeTitle = this.escapeHtml(task.title);
        const safeDescription = this.escapeHtml(task.description || '');
        const createdAt = task.created_at ? new Date(task.created_at).toLocaleDateString() : 'Today';
        return `
        <div class="task priority-${task.priority} ${overdueClass}" data-id="${task.id}" data-status="${task.status}">
          <button class="task-delete" data-id="${task.id}" aria-label="Delete task">×</button>
          <div class="task-title">${safeTitle}</div>
          ${task.description ? `<div class="task-description">${safeDescription}</div>` : ''}
          <div class="task-meta">
            <span>${createdAt}</span>
            ${task.due_date ? `<span class="due-date ${isOverdue ? 'due-overdue' : ''}">📅 ${task.due_date}</span>` : ''}
          </div>
        </div>
      `;
      }).join('');
    });
  }

  isTaskDone(task) {
    return task.status === 'done';
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

      this.persistTasks();
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
    document.getElementById('completed-tasks').textContent = tasks.filter(task => task.status === 'done').length;
    document.getElementById('overdue-tasks').textContent = tasks.filter(task => this.isTaskOverdue(task)).length;
  }

  setupTaskInteractions() {
    const board = document.getElementById('main-board');
    let wasDragged = false;

    if (!board) {
      console.error('❌ setupTaskInteractions error: missing #main-board');
      return;
    }

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
      if (e.button !== 0) return; // only left click
      const task = e.target.closest('.task');
      if (!task || e.target.closest('.task-delete')) return;

      e.preventDefault();
      const rect = task.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      this.draggedTask = task;
      this.draggedElement = null;
      this.ghostElement = null;
      this.startColumn = task.closest('.column');
      this.initialX = e.clientX;
      this.initialY = e.clientY;
      this.isDragging = false;
      task.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

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
        e.preventDefault();
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
        if (this.draggedTask) {
          this.draggedTask.style.cursor = '';
        }
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }

      this.draggedTask = null;
      this.draggedElement = null;
      this.ghostElement = null;
      this.placeholder = null;
      this.startColumn = null;
      this.isDragging = false;
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
    document.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
  }

  startDrag(task) {
    const rect = task.getBoundingClientRect();
    this.ghostElement = task.cloneNode(true);
    this.draggedElement = this.ghostElement;

    // Create placeholder in original list at the task's position
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'task-placeholder';
    this.placeholder.style.height = `${rect.height}px`;
    this.placeholder.style.width = `${rect.width}px`;
    this.placeholder.style.minHeight = '60px';
    this.placeholder.style.margin = '6px 0';
    this.placeholder.style.background = 'rgba(255, 255, 255, 0.95)';
    this.placeholder.style.border = '2px dashed rgba(102, 126, 234, 0.35)';
    this.placeholder.style.borderRadius = '12px';
    this.placeholder.style.boxSizing = 'border-box';
    task.parentNode.insertBefore(this.placeholder, task);

    // Hide original task while dragging a ghost copy
    task.classList.add('ghost');
    task.style.visibility = 'hidden';
    task.style.pointerEvents = 'none';

    // Setup ghost drag image
    this.ghostElement.classList.add('dragging');
    this.ghostElement.style.position = 'fixed';
    this.ghostElement.style.left = `${rect.left}px`;
    this.ghostElement.style.top = `${rect.top}px`;
    this.ghostElement.style.width = `${rect.width}px`;
    this.ghostElement.style.height = `${rect.height}px`;
    this.ghostElement.style.zIndex = '1000';
    this.ghostElement.style.pointerEvents = 'none';
    this.ghostElement.style.transform = 'rotate(2deg) scale(1.02)';
    this.ghostElement.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2)';
    this.ghostElement.style.transition = 'none';
    document.body.appendChild(this.ghostElement);

    setTimeout(() => {
      if (this.ghostElement) {
        this.ghostElement.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, left 0.2s ease, top 0.2s ease';
      }
    }, 0);
  }

  updateDragPosition(e) {
    if (!this.draggedElement) return;
    
    const x = e.clientX - this.dragOffsetX;
    const y = e.clientY - this.dragOffsetY;
    
    this.draggedElement.style.left = `${x}px`;
    this.draggedElement.style.top = `${y}px`;
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

  clearDropHighlights() {
    const columns = document.querySelectorAll('.column');
    columns.forEach(column => column.classList.remove('drop-target'));
  }

  async finishDrag(e) {
    const dropColumn = document.querySelector('.column.drop-target');
    const newStatus = dropColumn ? dropColumn.dataset.status : null;
    const taskId = this.draggedTask.dataset.id;
    const currentStatus = this.draggedTask.dataset.status;
    const originalTask = this.draggedTask;

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // Remove ghost drag clone
    if (this.ghostElement && this.ghostElement.parentNode) {
      this.ghostElement.parentNode.removeChild(this.ghostElement);
    }

    // Restore original task appearance
    originalTask.style.visibility = '';
    originalTask.style.pointerEvents = '';
    originalTask.classList.remove('ghost');

    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // Remove placeholder
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }

    // Clear highlights
    this.clearDropHighlights();

    // Handle drop
    if (dropColumn && newStatus && newStatus !== currentStatus) {
      const tasksContainer = dropColumn.querySelector('.tasks');
      if (tasksContainer) {
        tasksContainer.appendChild(originalTask);
        await this.updateTaskStatus(taskId, newStatus);
        
        originalTask.style.transform = 'scale(1.05)';
        originalTask.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.3)';
        originalTask.classList.add('success-move');
        setTimeout(() => {
          originalTask.style.transform = '';
          originalTask.style.boxShadow = '';
          originalTask.classList.remove('success-move');
        }, 600);
      }
    } else if (dropColumn && newStatus === currentStatus) {
      const tasksContainer = dropColumn.querySelector('.tasks');
      if (tasksContainer) {
        tasksContainer.appendChild(originalTask);
      }
    } else {
      if (this.startColumn) {
        const tasksContainer = this.startColumn.querySelector('.tasks');
        if (tasksContainer) {
          tasksContainer.appendChild(originalTask);
        }
      }
      originalTask.style.transform = 'scale(0.95)';
      setTimeout(() => {
        originalTask.style.transform = '';
      }, 200);
    }

    this.draggedElement = null;
    this.ghostElement = null;
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
  window.kanbanApp = new KanbanApp();
});

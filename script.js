document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const priorityInput = document.getElementById('priority-input');
    const dateInput = document.getElementById('date-input');
    const taskList = document.getElementById('task-list');
    const taskCountSpan = document.getElementById('task-count');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const sortSelect = document.getElementById('sort-select');
    
    // Progress Bar Elements
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    // Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const editInput = document.getElementById('edit-input');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // --- State ---
    let tasks = JSON.parse(localStorage.getItem('pro_tasks')) || [];
    let currentFilter = 'all';
    let currentSort = 'date-added';
    let editingTaskId = null;

    // --- Icons ---
    const icons = {
        trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
        edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        calendar: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`
    };

    const priorityWeight = { high: 3, medium: 2, low: 1 };

    // --- Core Functions ---

    const getSortedAndFilteredTasks = () => {
        // Filter
        let result = tasks.filter(t => {
            if (currentFilter === 'active') return !t.completed;
            if (currentFilter === 'completed') return t.completed;
            return true;
        });

        // Sort
        result.sort((a, b) => {
            // Always push completed items to bottom visually
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;

            if (currentSort === 'priority') {
                return priorityWeight[b.priority] - priorityWeight[a.priority];
            } else if (currentSort === 'due-date') {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            } else {
                // Default: newest first
                return b.createdAt - a.createdAt;
            }
        });

        return result;
    };

    const renderTasks = () => {
        taskList.innerHTML = '';
        const tasksToRender = getSortedAndFilteredTasks();

        tasksToRender.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;
            li.dataset.priority = task.priority;
            
            // Format Due Date
            let dateHTML = '';
            if (task.dueDate) {
                const dateObj = new Date(task.dueDate + 'T00:00:00'); // Force local timezone interpretation
                const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                
                // Check if overdue (only if not completed)
                const isOverdue = !task.completed && new Date().setHours(0,0,0,0) > dateObj.getTime();
                
                dateHTML = `<span style="${isOverdue ? 'color: var(--danger); font-weight: 500;' : ''}">
                    ${icons.calendar} ${isOverdue ? 'Overdue: ' : ''}${formattedDate}
                </span>`;
            }

            li.innerHTML = `
                <label class="checkbox-wrapper" aria-label="Toggle task">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <div class="task-content">
                    <span class="task-text-content">${escapeHTML(task.text)}</span>
                    ${dateHTML ? `<div class="task-meta">${dateHTML}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="icon-btn edit-btn" aria-label="Edit task">${icons.edit}</button>
                    <button class="icon-btn delete-btn" aria-label="Delete task">${icons.trash}</button>
                </div>
            `;

            taskList.appendChild(li);
        });

        updateUI();
        saveTasks();
    };

    const addTask = (text, priority, dueDate) => {
        const newTask = {
            id: Date.now().toString(),
            text,
            completed: false,
            priority,
            dueDate,
            createdAt: Date.now()
        };
        tasks.push(newTask);
        
        if (currentFilter === 'completed') setFilter('all');
        else renderTasks();
    };

    const deleteTask = (id, element) => {
        element.style.animation = 'fadeOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            renderTasks();
        }, 300);
    };

    const toggleTask = (id) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            
            // If checking off, trigger tiny confetti at mouse location optionally
            if (task.completed) {
                checkCompletionCelebration();
            }
            renderTasks();
        }
    };

    const openEditModal = (id) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        
        editingTaskId = id;
        editInput.value = task.text;
        editModal.classList.remove('hidden');
        editInput.focus();
    };

    const closeEditModal = () => {
        editModal.classList.add('hidden');
        editingTaskId = null;
    };

    const saveEdit = (newText) => {
        if (!editingTaskId) return;
        tasks = tasks.map(t => t.id === editingTaskId ? { ...t, text: newText } : t);
        closeEditModal();
        renderTasks();
    };

    const clearCompleted = () => {
        const hasCompleted = tasks.some(t => t.completed);
        if (!hasCompleted) return;

        // Visual celebration
        fireConfetti();

        const completedElements = Array.from(taskList.children).filter(li => li.classList.contains('completed'));
        completedElements.forEach(el => {
            el.style.animation = 'fadeOut 0.3s ease forwards';
        });

        setTimeout(() => {
            tasks = tasks.filter(t => !t.completed);
            renderTasks();
        }, 300);
    };

    // --- UI Updaters ---

    const updateUI = () => {
        // Update counts
        const activeTasks = tasks.filter(t => !t.completed).length;
        const totalTasks = tasks.length;
        const completedTasks = totalTasks - activeTasks;
        
        taskCountSpan.textContent = `${activeTasks} task${activeTasks !== 1 ? 's' : ''} left`;
        
        // Show/hide clear button
        clearCompletedBtn.style.display = completedTasks > 0 ? 'block' : 'none';
        
        // Update Progress Bar
        const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = totalTasks === 0 ? "Add tasks to begin" : `${percentage}% Completed`;

        // Empty state
        if (tasks.length === 0) {
            taskList.innerHTML = `
                <li class="task-item" style="justify-content: center; flex-direction: column; gap: 10px; background: transparent; border: 1px dashed var(--glass-border); padding: 30px;">
                    <div style="font-size: 2rem; opacity: 0.5;">📝</div>
                    <div style="color: var(--text-secondary);">Your list is beautifully empty.</div>
                </li>
            `;
        }
    };

    const setFilter = (filterName) => {
        currentFilter = filterName;
        filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filterName));
        renderTasks();
    };

    const saveTasks = () => localStorage.setItem('pro_tasks', JSON.stringify(tasks));
    const escapeHTML = (str) => {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    };

    // --- Celebrations ---
    const fireConfetti = () => {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#8b5cf6', '#f472b6', '#a78bfa']
            });
        }
    };

    const checkCompletionCelebration = () => {
        const activeTasks = tasks.filter(t => !t.completed).length;
        // If they just checked off the very last active task (and they have at least a few tasks)
        if (activeTasks === 0 && tasks.length >= 3) {
            setTimeout(fireConfetti, 200);
        }
    };

    // --- Event Listeners ---

    // Form Submission (Add)
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = taskInput.value.trim();
        const priority = priorityInput.value;
        const dueDate = dateInput.value;

        if (text) {
            addTask(text, priority, dueDate);
            taskInput.value = '';
            dateInput.value = '';
            // Reset to medium priority default
            priorityInput.value = 'medium';
        }
    });

    // Task List Interactions (Delegation)
    taskList.addEventListener('click', (e) => {
        const li = e.target.closest('.task-item');
        if (!li || !li.dataset.id) return;
        const id = li.dataset.id;

        if (e.target.closest('.delete-btn')) {
            deleteTask(id, li);
        } else if (e.target.closest('.edit-btn')) {
            openEditModal(id);
        } else if (e.target.closest('.task-checkbox')) {
            toggleTask(id);
        }
    });

    // Allow double clicking task text to edit
    taskList.addEventListener('dblclick', (e) => {
        const textElement = e.target.closest('.task-text-content');
        if (textElement) {
            const li = textElement.closest('.task-item');
            if (li && li.dataset.id) {
                openEditModal(li.dataset.id);
            }
        }
    });

    // Controls
    clearCompletedBtn.addEventListener('click', clearCompleted);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderTasks();
    });

    // Edit Modal interactions
    cancelEditBtn.addEventListener('click', closeEditModal);
    
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = editInput.value.trim();
        if (text) saveEdit(text);
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
            closeEditModal();
        }
    });
    
    // Close modal on click outside
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // --- Initialization ---
    // Set min date to today for date picker
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    renderTasks();
});

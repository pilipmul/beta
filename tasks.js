// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State Global Tasks
let localTasks = [];
let currentFilter = 'all';
let selectedTaskId = null;
let showCompleted = false;
let listNameToDelete = null;

// State Sort & Search Global
let sortAscending = true; 
let searchQuery = "";

// State Global simpan status collapse/expand bulan
let collapsedGroups = {};

// INISIALISASI HALAMAN SAAT DOM SIAP
document.addEventListener("DOMContentLoaded", function() {
    if (typeof renderHeader === 'function') {
        renderHeader({
            subtitle: "Tasks Management",
            hamburgerItems: [
                {
                    label: "New List / Group",
                    icon: `<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
                    onClick: "openNewListModal()"
                }
            ]
        });
    }

    setupEventListeners();
    fetchTasksFromSOT();
});

// EVENT LISTENERS BINDING
function setupEventListeners() {
    // Navigasi Filter Utama
    document.getElementById('nav-all')?.addEventListener('click', function() { switchFilter('all', this); });
    document.getElementById('nav-important')?.addEventListener('click', function() { switchFilter('important', this); });
    document.getElementById('nav-recurring')?.addEventListener('click', function() { switchFilter('recurring', this); });
    document.getElementById('nav-completed')?.addEventListener('click', function() { switchFilter('completed', this); });

    // Tombol Aksi Header
    document.getElementById('btnCreateNewList')?.addEventListener('click', openNewListModal);
    document.getElementById('btnSortOrder')?.addEventListener('click', toggleSortOrder);

    // Input Pencarian Real-Time
    const localSearch = document.getElementById('taskLocalSearchInput');
    localSearch?.addEventListener('input', handleLocalSearch);
    localSearch?.addEventListener('keyup', handleLocalSearch);
    document.getElementById('btnClearLocalSearch')?.addEventListener('click', clearLocalSearch);

    // Tambah Tugas Input
    document.getElementById('btnAddTask')?.addEventListener('click', addTask);
    document.getElementById('task-input')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addTask();
    });

    // Toggle Task Completed
    document.getElementById('btnToggleCompleted')?.addEventListener('click', toggleCompletedVisibility);

    // Panel Detail
    document.getElementById('btnCloseDetailPanel')?.addEventListener('click', closeDetailPanel);
    document.getElementById('btnCancelDetailPanel')?.addEventListener('click', closeDetailPanel);
    document.getElementById('btnSaveDetailPanel')?.addEventListener('click', saveTaskDetails);

    // Modal New List
    document.getElementById('btnCloseNewListModal')?.addEventListener('click', closeNewListModal);
    document.getElementById('btnCancelNewListModal')?.addEventListener('click', closeNewListModal);
    document.getElementById('btnSubmitNewList')?.addEventListener('click', submitNewListCustom);
    document.getElementById('cardMethodMove')?.addEventListener('click', function() {
        const rad = document.getElementById('method-move');
        if (rad) rad.checked = true;
        onMethodChange();
    });
    document.getElementById('cardMethodNew')?.addEventListener('click', function() {
        const rad = document.getElementById('method-new');
        if (rad) rad.checked = true;
        onMethodChange();
    });
    document.getElementById('method-move')?.addEventListener('change', onMethodChange);
    document.getElementById('method-new')?.addEventListener('change', onMethodChange);

    // Modal Edit List
    document.getElementById('btnCloseEditListModal')?.addEventListener('click', closeEditListModal);
    document.getElementById('btnCancelEditListModal')?.addEventListener('click', closeEditListModal);
    document.getElementById('btnSubmitRenameList')?.addEventListener('click', submitRenameList);

    // Modal Delete List
    document.getElementById('btnCloseDeleteListModal')?.addEventListener('click', closeDeleteListModal);
    document.getElementById('btnCancelDeleteListModal')?.addEventListener('click', closeDeleteListModal);
    document.getElementById('btnConfirmDeleteList')?.addEventListener('click', confirmDeleteList);
    document.getElementById('cardDelOptKeep')?.addEventListener('click', function() {
        const rad = document.getElementById('del-opt-keep');
        if (rad) rad.checked = true;
    });
    document.getElementById('cardDelOptAll')?.addEventListener('click', function() {
        const rad = document.getElementById('del-opt-all');
        if (rad) rad.checked = true;
    });

    // Outer Click Handler untuk Modal
    window.addEventListener('click', function(event) {
        const newListModal = document.getElementById('newListModal');
        const deleteListModal = document.getElementById('deleteListModal');
        const editListModal = document.getElementById('editListModal');
        if (event.target === newListModal) closeNewListModal();
        if (event.target === deleteListModal) closeDeleteListModal();
        if (event.target === editListModal) closeEditListModal();
    });
}

function showLoading(status) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = status ? 'flex' : 'none';
    }
}

// FETCH DATA DARI SUPABASE
async function fetchTasksFromSOT() {
    showLoading(true);
    try {
        const { data, error } = await _supabase
            .from('task')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error("Supabase Error:", error);
            alert("Gagal memuat data dari Supabase: " + error.message);
        } else {
            localTasks = data || [];
            renderSidebarLists();
            renderTasks();
        }
    } catch (err) {
        console.error("Gagal terhubung ke Supabase:", err);
    } finally {
        showLoading(false);
    }
}

// SAVE / UPDATE DATA KE SUPABASE
async function saveTaskToSupabase(taskData) {
    showLoading(true);
    try {
        const payload = {
            id: taskData.id,
            title: taskData.title,
            note: taskData.note || "",
            due: taskData.due && taskData.due.trim() !== "" ? taskData.due : null,
            completion: taskData.completion && taskData.completion.trim() !== "" ? taskData.completion : null,
            repeat: taskData.repeat || "none",
            important: Boolean(taskData.important),
            completed: Boolean(taskData.completed),
            listName: taskData.listName || ""
        };

        const { error } = await _supabase
            .from('task')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error("Gagal menyimpan data ke Supabase:", error);
            alert("Gagal menyimpan ke database Supabase: " + error.message);
        }
    } catch (err) {
        console.error("Terjadi kesalahan saat simpan ke Supabase:", err);
    } finally {
        showLoading(false);
    }
}

// DELETE DATA DARI SUPABASE
async function deleteTaskFromSupabase(taskId) {
    showLoading(true);
    try {
        const { error } = await _supabase
            .from('task')
            .delete()
            .eq('id', taskId);

        if (error) {
            console.error("Gagal menghapus data dari Supabase:", error);
        }
    } catch (err) {
        console.error("Terjadi kesalahan saat hapus dari Supabase:", err);
    } finally {
        showLoading(false);
    }
}

function renderSidebarLists() {
    const container = document.getElementById('custom-sidebar-lists');
    if (!container) return;
    container.innerHTML = '';

    const uniqueLists = [];
    localTasks.forEach(t => {
        if (t.listName && t.listName.trim() !== '' && !uniqueLists.includes(t.listName.trim())) {
            uniqueLists.push(t.listName.trim());
        }
    });

    uniqueLists.forEach(listName => {
        const nav = document.createElement('div');
        nav.className = `nav-item-list ${currentFilter === listName ? 'active' : ''}`;
        
        const contentLeft = document.createElement('div');
        contentLeft.style.cssText = "display:flex; align-items:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
        contentLeft.innerHTML = `
            <i class="fas fa-list-ul" style="margin-right:12px; font-size:14px; width:18px; text-align:center;"></i>
            <span>${listName}</span>
        `;

        const actionRight = document.createElement('div');
        actionRight.style.cssText = "display:flex; align-items:center;";

        const btnEdit = document.createElement('i');
        btnEdit.className = "fas fa-pen list-action-icon";
        btnEdit.title = "Edit Nama List";
        btnEdit.addEventListener('click', function(e) { openEditListModal(listName, e); });

        const btnDelete = document.createElement('i');
        btnDelete.className = "far fa-trash-alt list-action-icon list-delete-icon";
        btnDelete.title = "Hapus List";
        btnDelete.addEventListener('click', function(e) { openDeleteListModal(listName, e); });

        actionRight.appendChild(btnEdit);
        actionRight.appendChild(btnDelete);

        nav.appendChild(contentLeft);
        nav.appendChild(actionRight);

        nav.addEventListener('click', function(e) {
            if (!e.target.closest('.list-action-icon')) {
                switchFilter(listName, nav);
            }
        });

        container.appendChild(nav);
    });
}

function openEditListModal(targetListName = null, event = null) {
    if (event) event.stopPropagation();
    
    const targetName = targetListName || currentFilter;
    const isSystemFilter = ['all', 'important', 'recurring', 'completed'].includes(targetName);
    
    if (isSystemFilter) return;

    document.getElementById('old-list-name').value = targetName;
    document.getElementById('edit-list-name-input').value = targetName;
    document.getElementById('editListModal').style.display = 'block';
}

function closeEditListModal() {
    document.getElementById('editListModal').style.display = 'none';
}

async function submitRenameList() {
    const oldName = document.getElementById('old-list-name').value;
    const newName = document.getElementById('edit-list-name-input').value.trim();

    if (!newName) {
        alert("Nama List baru tidak boleh kosong!");
        return;
    }

    if (oldName === newName) {
        closeEditListModal();
        return;
    }

    closeEditListModal();
    showLoading(true);

    try {
        const tasksToUpdate = localTasks.filter(t => t.listName === oldName);
        for (const t of tasksToUpdate) {
            t.listName = newName;
            await saveTaskToSupabase(t);
        }

        if (currentFilter === oldName) {
            currentFilter = newName;
            document.getElementById('current-list-title').innerText = newName;
        }

        renderSidebarLists();
        renderTasks();
    } catch (err) {
        console.error("Gagal memperbarui nama list:", err);
        alert("Gagal mengubah nama list: " + err.message);
    } finally {
        showLoading(false);
    }
}

async function addTask() {
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;

    const isCustomFilter = !['all', 'important', 'recurring', 'completed'].includes(currentFilter);
    const assignedList = isCustomFilter ? currentFilter : "";
    const generatedId = 'ID-' + Date.now();

    const newTask = {
        id: generatedId,
        title: title,
        note: "",
        due: null,
        completion: null,
        repeat: "none",
        important: currentFilter === 'important',
        completed: false,
        listName: assignedList
    };

    localTasks.unshift(newTask);
    input.value = '';
    
    renderTasks();
    renderSidebarLists();

    await saveTaskToSupabase(newTask);
    openDetailPanel(generatedId);
}

function openNewListModal() {
    const nameInput = document.getElementById('new-list-name');
    const titleInput = document.getElementById('new-list-task-title');
    if (nameInput) nameInput.value = '';
    if (titleInput) titleInput.value = '';
    
    const availableTasks = localTasks.filter(t => !t.listName || t.listName === "");
    const selectDropdown = document.getElementById('new-list-task-select');
    
    if (availableTasks.length > 0) {
        document.getElementById('group-method-section').style.display = 'block';
        document.getElementById('method-move').checked = true;
        
        selectDropdown.innerHTML = '';
        availableTasks.forEach(t => {
            selectDropdown.innerHTML += `<option value="${t.id}">${t.title}</option>`;
        });
        
        document.getElementById('sub-select-task-group').style.display = 'block';
        document.getElementById('sub-input-task-group').style.display = 'none';
    } else {
        document.getElementById('group-method-section').style.display = 'none';
        document.getElementById('method-new').checked = true;
        document.getElementById('sub-select-task-group').style.display = 'none';
        document.getElementById('sub-input-task-group').style.display = 'block';
    }

    document.getElementById('newListModal').style.display = 'block';
}

function closeNewListModal() {
    document.getElementById('newListModal').style.display = 'none';
}

function openDeleteListModal(listName, event) {
    if (event) event.stopPropagation();
    listNameToDelete = listName;

    const count = localTasks.filter(t => t.listName === listName).length;
    document.getElementById('delete-list-message').innerText = 
        `Apakah Anda yakin ingin menghapus list "${listName}"? (Terdapat ${count} tugas di dalamnya)`;
    
    document.getElementById('del-opt-keep').checked = true;
    document.getElementById('deleteListModal').style.display = 'block';
}

function closeDeleteListModal() {
    document.getElementById('deleteListModal').style.display = 'none';
    listNameToDelete = null;
}

async function confirmDeleteList() {
    if (!listNameToDelete) return;

    const option = document.querySelector('input[name="delete-list-option"]:checked').value;
    const targetListName = listNameToDelete;

    closeDeleteListModal();
    showLoading(true);

    try {
        if (option === 'all') {
            const tasksToDelete = localTasks.filter(t => t.listName === targetListName);
            for (const t of tasksToDelete) {
                await deleteTaskFromSupabase(t.id);
            }
            localTasks = localTasks.filter(t => t.listName !== targetListName);
        } else {
            const tasksToUpdate = localTasks.filter(t => t.listName === targetListName);
            for (const t of tasksToUpdate) {
                t.listName = "";
                await saveTaskToSupabase(t);
            }
        }

        if (currentFilter === targetListName) {
            switchFilter('all', document.getElementById('nav-all'));
        } else {
            renderSidebarLists();
            renderTasks();
        }
    } catch (err) {
        console.error("Gagal menghapus list:", err);
    } finally {
        showLoading(false);
    }
}

function onMethodChange() {
    const isMove = document.getElementById('method-move').checked;
    if (isMove) {
        document.getElementById('sub-select-task-group').style.display = 'block';
        document.getElementById('sub-input-task-group').style.display = 'none';
    } else {
        document.getElementById('sub-select-task-group').style.display = 'none';
        document.getElementById('sub-input-task-group').style.display = 'block';
    }
}

async function submitNewListCustom() {
    const listName = document.getElementById('new-list-name').value.trim();
    if (!listName) {
        alert("Nama List / Grup Baru wajib diisi!");
        return;
    }

    const method = document.querySelector('input[name="list-method"]:checked').value;

    if (method === "1") {
        const selectTaskId = document.getElementById('new-list-task-select').value;
        const chosenTask = localTasks.find(t => t.id === selectTaskId);
        
        if (chosenTask) {
            chosenTask.listName = listName;
            currentFilter = listName;
            
            document.getElementById('current-list-title').innerText = listName;
            
            closeNewListModal();
            await saveTaskToSupabase(chosenTask);
            renderSidebarLists();
            renderTasks();
            openDetailPanel(chosenTask.id);
        } else {
            alert("Tugas tidak ditemukan!");
        }
    } 
    else if (method === "2") {
        const newTaskTitle = document.getElementById('new-list-task-title').value.trim();
        if (!newTaskTitle) {
            alert("Nama tugas baru untuk list tersebut wajib diisi!");
            return;
        }

        const generatedId = 'ID-' + Date.now();
        const newTask = {
            id: generatedId,
            title: newTaskTitle,
            note: "",
            due: null,
            completion: null,
            repeat: "none",
            important: false,
            completed: false,
            listName: listName
        };

        localTasks.unshift(newTask);
        currentFilter = listName;
        document.getElementById('current-list-title').innerText = listName;
        
        closeNewListModal();
        await saveTaskToSupabase(newTask);
        renderSidebarLists();
        renderTasks();
        openDetailPanel(generatedId);
    }
}

function toggleCompletedVisibility() {
    showCompleted = !showCompleted;
    const completedContainer = document.getElementById('completed-task-list-container');
    const icon = document.getElementById('completed-toggle-icon');
    const text = document.getElementById('completed-toggle-text');

    if (showCompleted) {
        completedContainer.style.display = 'flex';
        icon.style.transform = 'rotate(90deg)';
        text.innerText = 'Sembunyikan tugas selesai';
    } else {
        completedContainer.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
        text.innerText = 'Tampilkan tugas selesai';
    }
}

function createTaskElement(t) {
    const isSelected = selectedTaskId === t.id ? 'selected-task' : '';
    const item = document.createElement('div');
    item.className = `task-item ${t.completed ? 'completed' : ''} ${isSelected}`;
    
    item.addEventListener('click', function(e) {
        if (!e.target.closest('.task-checkbox') && !e.target.closest('.star-icon') && !e.target.closest('.trash-icon')) {
            openDetailPanel(t.id);
        }
    });

    const metaHtml = [];
    if (t.listName) metaHtml.push(`<span class="badge-list">${t.listName}</span>`);
    if (t.due) metaHtml.push(`<span><i class="far fa-calendar-alt"></i> ${t.due}</span>`);
    if (t.completion) metaHtml.push(`<span class="badge-completion" title="Tanggal Selesai"><i class="fas fa-check-double"></i> Selesai: ${t.completion}</span>`);
    if (t.repeat && t.repeat !== 'none') metaHtml.push(`<span><i class="fas fa-sync-alt"></i> Berulang</span>`);

    const cleanNote = t.note ? t.note.trim() : '';

    item.innerHTML = `
        <div class="task-checkbox"></div>
        <div class="task-info">
            <div class="task-title">${t.title}</div>
            ${metaHtml.length > 0 ? `<div class="task-meta">${metaHtml.join('')}</div>` : ''}
        </div>
        <div class="task-inline-note">${cleanNote}</div>
        <i class="${t.important ? 'fas' : 'far'} fa-star star-icon ${t.important ? 'active' : ''}"></i>
        <i class="far fa-trash-alt trash-icon"></i>
    `;

    item.querySelector('.task-checkbox').addEventListener('click', function(e) { toggleComplete(e, t.id); });
    item.querySelector('.star-icon').addEventListener('click', function(e) { toggleImportant(e, t.id); });
    item.querySelector('.trash-icon').addEventListener('click', function(e) { deleteTask(e, t.id); });

    return item;
}

function handleLocalSearch() {
    const inp = document.getElementById('taskLocalSearchInput');
    const btn = document.getElementById('btnClearLocalSearch');
    
    if (inp && btn) {
        btn.style.display = (inp.value.trim() !== '') ? 'block' : 'none';
    }
    
    triggerGlobalSearch();
}

function clearLocalSearch() {
    const inp = document.getElementById('taskLocalSearchInput');
    const btn = document.getElementById('btnClearLocalSearch');
    if (inp) inp.value = '';
    if (btn) btn.style.display = 'none';
    
    clearGlobalSearch();
}

function triggerGlobalSearch() {
    const localInput = document.getElementById('taskLocalSearchInput');
    const globalInput = document.getElementById('globalSearchInput');
    const btnClearLocal = document.getElementById('btnClearLocalSearch');
    const btnClearGlobal = document.getElementById('btnClearSearch');

    let query = "";
    if (localInput && localInput.value.trim() !== "") {
        query = localInput.value.toLowerCase().trim();
    } else if (globalInput && globalInput.value.trim() !== "") {
        query = globalInput.value.toLowerCase().trim();
    }

    searchQuery = query;

    if (btnClearLocal) {
        btnClearLocal.style.display = (localInput && localInput.value.trim() !== "") ? 'block' : 'none';
    }
    if (btnClearGlobal) {
        if (searchQuery !== "") {
            btnClearGlobal.classList.remove('hidden');
        } else {
            btnClearGlobal.classList.add('hidden');
        }
    }

    renderTasks();
}

function clearGlobalSearch() {
    const localInput = document.getElementById('taskLocalSearchInput');
    const globalInput = document.getElementById('globalSearchInput');
    const btnClearLocal = document.getElementById('btnClearLocalSearch');
    const btnClearGlobal = document.getElementById('btnClearSearch');

    if (localInput) localInput.value = '';
    if (globalInput) globalInput.value = '';
    if (btnClearLocal) btnClearLocal.style.display = 'none';
    if (btnClearGlobal) btnClearGlobal.classList.add('hidden');

    searchQuery = '';
    renderTasks();
}

function toggleSortOrder() {
    sortAscending = !sortAscending;
    const sortText = document.getElementById('sort-text');
    const sortIcon = document.getElementById('sort-icon');

    if (sortAscending) {
        if (sortText) sortText.innerText = 'Due (A-Z)';
        if (sortIcon) sortIcon.className = 'fas fa-sort-amount-down-alt';
    } else {
        if (sortText) sortText.innerText = 'Due (Z-A)';
        if (sortIcon) sortIcon.className = 'fas fa-sort-amount-up';
    }
    renderTasks();
}

// LOGIKA LABEL BULAN ("This Month" / NAMA BULAN)
function getMonthLabel(dateStr) {
    if (!dateStr) return "Tanpa Tenggat Waktu";

    const parts = dateStr.split('-');
    if (parts.length < 2) return "Tanpa Tenggat Waktu";

    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    if (year === currentYear && monthIndex === currentMonth) {
        return "This Month";
    }

    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    return `${monthNames[monthIndex]} ${year}`;
}

// LOGIKA RENDER TUGAS DENGAN KELOMPOK BULAN & COLLAPSE / EXPAND
function renderGroupedTasks(tasks, containerElement) {
    const groups = {};

    tasks.forEach(task => {
        const dateKey = (currentFilter === 'completed' && task.completion) ? task.completion : task.due;
        const label = getMonthLabel(dateKey);

        if (!groups[label]) {
            groups[label] = [];
        }
        groups[label].push(task);
    });

    Object.keys(groups).forEach(label => {
        const isCollapsed = Boolean(collapsedGroups[label]);

        const header = document.createElement('div');
        header.className = `month-group-header ${isCollapsed ? 'collapsed' : ''}`;
        header.innerHTML = `
            <i class="fas fa-chevron-down collapse-icon"></i>
            <span>${label} (${groups[label].length})</span>
        `;

        const groupContent = document.createElement('div');
        groupContent.className = `month-group-content ${isCollapsed ? 'hidden-group' : ''}`;

        header.addEventListener('click', function() {
            const nowCollapsed = !collapsedGroups[label];
            collapsedGroups[label] = nowCollapsed;

            if (nowCollapsed) {
                header.classList.add('collapsed');
                groupContent.classList.add('hidden-group');
            } else {
                header.classList.remove('collapsed');
                groupContent.classList.remove('hidden-group');
            }
        });

        groups[label].forEach(task => {
            groupContent.appendChild(createTaskElement(task));
        });

        containerElement.appendChild(header);
        containerElement.appendChild(groupContent);
    });
}

function renderTasks() {
    const activeContainer = document.getElementById('active-task-list-container');
    const completedContainer = document.getElementById('completed-task-list-container');
    const completedSection = document.getElementById('completed-section');

    if (!activeContainer || !completedContainer) return;

    activeContainer.innerHTML = '';
    completedContainer.innerHTML = '';

    // 1. Filter Kategori Sidebar
    let filtered = localTasks.filter(t => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'important') return t.important;
        if (currentFilter === 'recurring') return t.repeat && t.repeat !== 'none';
        if (currentFilter === 'completed') return t.completed;
        return t.listName === currentFilter;
    });

    // 2. Filter Berdasarkan Pencarian
    if (searchQuery) {
        filtered = filtered.filter(t => 
            (t.title && t.title.toLowerCase().includes(searchQuery)) ||
            (t.note && t.note.toLowerCase().includes(searchQuery))
        );
    }

    // 3. Pengurutan (Sort by Due Date / Completion)
    filtered.sort((a, b) => {
        const dateAStr = (currentFilter === 'completed') ? a.completion : a.due;
        const dateBStr = (currentFilter === 'completed') ? b.completion : b.due;

        const dateA = dateAStr ? new Date(dateAStr).getTime() : (sortAscending ? 9999999999999 : -9999999999999);
        const dateB = dateBStr ? new Date(dateBStr).getTime() : (sortAscending ? 9999999999999 : -9999999999999);

        return sortAscending ? dateA - dateB : dateB - dateA;
    });

    if (currentFilter === 'completed') {
        completedSection.style.display = 'none';
        if (filtered.length === 0) {
            activeContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">Tidak ada tugas yang cocok.</div>`;
            return;
        }
        renderGroupedTasks(filtered, activeContainer);
        return;
    }

    const activeTasks = filtered.filter(t => !t.completed);
    const completedTasks = filtered.filter(t => t.completed);

    if (activeTasks.length === 0 && completedTasks.length === 0) {
        activeContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">Tidak ada tugas yang cocok.</div>`;
    } else {
        renderGroupedTasks(activeTasks, activeContainer);
    }

    if (completedTasks.length > 0) {
        completedSection.style.display = 'block';
        renderGroupedTasks(completedTasks, completedContainer);
    } else {
        completedSection.style.display = 'none';
    }
}

async function toggleComplete(event, id) {
    if (event) event.stopPropagation();
    
    const task = localTasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    
    if (task.completed) {
        task.completion = new Date().toISOString().split('T')[0];
        
        if (task.repeat && task.repeat !== 'none') {
            const nextDate = calculateNextDueDate(task.due, task.repeat);
            const recurrentTask = { 
                ...task, 
                id: 'ID-' + Date.now(), 
                completed: false, 
                completion: null, 
                due: nextDate 
            };
            localTasks.unshift(recurrentTask);
            await saveTaskToSupabase(recurrentTask);
        }
    } else {
        task.completion = null;
    }

    renderTasks();
    await saveTaskToSupabase(task);
}

async function toggleImportant(event, id) {
    if (event) event.stopPropagation();
    const task = localTasks.find(t => t.id === id);
    if (task) {
        task.important = !task.important;
        renderTasks();
        await saveTaskToSupabase(task);
    }
}

async function deleteTask(event, id) {
    if (event) event.stopPropagation();
    if (confirm("Apakah Anda yakin ingin menghapus tugas ini secara permanen?")) {
        const taskIndex = localTasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            localTasks.splice(taskIndex, 1);
            if (selectedTaskId === id) {
                closeDetailPanel();
            }
            renderSidebarLists();
            renderTasks();
            await deleteTaskFromSupabase(id);
        }
    }
}

function openDetailPanel(id) {
    selectedTaskId = id;
    const task = localTasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title || '';
    document.getElementById('edit-task-due').value = task.due || '';
    document.getElementById('edit-task-completion').value = task.completion || '';
    document.getElementById('edit-task-repeat').value = task.repeat || 'none';
    document.getElementById('edit-task-note').value = task.note || '';

    const listSelect = document.getElementById('edit-task-list');
    listSelect.innerHTML = '<option value="">(Tanpa Grup / List)</option>';

    const uniqueLists = [];
    localTasks.forEach(t => {
        if (t.listName && t.listName.trim() !== '' && !uniqueLists.includes(t.listName.trim())) {
            uniqueLists.push(t.listName.trim());
        }
    });
    uniqueLists.forEach(l => {
        listSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });
    listSelect.value = task.listName || '';

    document.getElementById('detailPanel').style.display = 'flex';
    renderTasks();
}

function closeDetailPanel() {
    document.getElementById('detailPanel').style.display = 'none';
    selectedTaskId = null;
    renderTasks();
}

async function saveTaskDetails() {
    const id = document.getElementById('edit-task-id').value;
    const task = localTasks.find(t => t.id === id);
    if (task) {
        task.title = document.getElementById('edit-task-title').value.trim();
        task.due = document.getElementById('edit-task-due').value || null;
        task.repeat = document.getElementById('edit-task-repeat').value;
        task.listName = document.getElementById('edit-task-list').value;
        task.note = document.getElementById('edit-task-note').value.trim();

        closeDetailPanel();
        renderSidebarLists();
        renderTasks();
        
        await saveTaskToSupabase(task);
    }
}

function calculateNextDueDate(currentDueStr, repeatInterval) {
    let baseDate = currentDueStr ? new Date(currentDueStr) : new Date();
    if (isNaN(baseDate.getTime())) baseDate = new Date();
    if (repeatInterval === 'daily') {
        baseDate.setDate(baseDate.getDate() + 1);
    } else if (repeatInterval === 'weekly') {
        baseDate.setDate(baseDate.getDate() + 7);
    } else if (repeatInterval === 'monthly') {
        baseDate.setMonth(baseDate.getMonth() + 1);
    }
    return baseDate.toISOString().split('T')[0];
}

function switchFilter(filterType, element) {
    currentFilter = filterType;
    document.querySelectorAll('.nav-item, .nav-item-list').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    const titles = { all: "Semua Tugas", important: "Penting", recurring: "Tugas Berulang Otomatis", completed: "Tugas Selesai" };
    document.getElementById('current-list-title').innerText = titles[filterType] || filterType;

    closeDetailPanel();
    renderTasks();
}
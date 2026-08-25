// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let localTasks = [];
let currentFilter = 'all';
let selectedTaskId = null;
let showCompleted = false;
let listNameToDelete = null;

// State tambahan untuk Sort & Search
let sortAscending = true; 
let searchQuery = "";

// Inisialisasi Navigation Header Terpusat Persis Modul Logistics
renderHeader({
  subtitle: "Kelola Tugas Terintegrasi",
  hamburgerItems: []
});

document.addEventListener("DOMContentLoaded", function() {
    fetchTasksFromSOT();
});

function showLoading(status) {
    document.getElementById('loading-overlay').style.display = status ? 'flex' : 'none';
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

        const { data, error } = await _supabase
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
        nav.innerHTML = `
            <div style="display:flex; align-items:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <i class="fas fa-list-ul" style="margin-right:15px; font-size:16px; width:20px; text-align:center;"></i>
                <span>${listName}</span>
            </div>
            <i class="far fa-trash-alt list-delete-icon" title="Hapus List" onclick="openDeleteListModal('${listName}', event)"></i>
        `;
        nav.onclick = function(e) {
            if (!e.target.closest('.list-delete-icon')) {
                switchFilter(listName, nav);
            }
        };
        container.appendChild(nav);
    });
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
    document.getElementById('new-list-name').value = '';
    document.getElementById('new-list-task-title').value = '';
    
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
        text.innerText = 'Hide completed tasks';
    } else {
        completedContainer.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
        text.innerText = 'Show completed tasks';
    }
}

function createTaskElement(t) {
    const isSelected = selectedTaskId === t.id ? 'selected-task' : '';
    const item = document.createElement('div');
    item.className = `task-item ${t.completed ? 'completed' : ''} ${isSelected}`;
    
    item.onclick = function(e) {
        if (!e.target.closest('.task-checkbox') && !e.target.closest('.star-icon') && !e.target.closest('.trash-icon')) {
            openDetailPanel(t.id);
        }
    };

    const metaHtml = [];
    if (t.listName) metaHtml.push(`<span class="badge-list">${t.listName}</span>`);
    if (t.due) metaHtml.push(`<span><i class="far fa-calendar-alt"></i> ${t.due}</span>`);
    if (t.completion) metaHtml.push(`<span class="badge-completion" title="Tanggal Selesai"><i class="fas fa-check-double"></i> Selesai: ${t.completion}</span>`);
    if (t.repeat && t.repeat !== 'none') metaHtml.push(`<span><i class="fas fa-sync-alt"></i> Berulang</span>`);

    const cleanNote = t.note ? t.note.trim() : '';

    item.innerHTML = `
        <div class="task-checkbox" onclick="toggleComplete(event, '${t.id}')"></div>
        <div class="task-info">
            <div class="task-title">${t.title}</div>
            ${metaHtml.length > 0 ? `<div class="task-meta">${metaHtml.join('')}</div>` : ''}
        </div>
        <div class="task-inline-note">${cleanNote}</div>
        <i class="${t.important ? 'fas' : 'far'} fa-star star-icon ${t.important ? 'active' : ''}" onclick="toggleImportant(event, '${t.id}')"></i>
        <i class="far fa-trash-alt trash-icon" onclick="deleteTask(event, '${t.id}')"></i>
    `;
    return item;
}

// FUNGSI PENCARIAN GLOBAL
function handleSearchInput() {
    const globalSearchInput = document.getElementById('globalSearchInput');
    const btnClear = document.getElementById('btnClearSearch');

    if (globalSearchInput) {
        searchQuery = globalSearchInput.value.toLowerCase().trim();
        if (searchQuery !== '') {
            btnClear.classList.remove('hidden');
        } else {
            btnClear.classList.add('hidden');
        }
    }
    renderTasks();
}

function clearGlobalSearch() {
    const globalSearchInput = document.getElementById('globalSearchInput');
    const btnClear = document.getElementById('btnClearSearch');
    if (globalSearchInput) globalSearchInput.value = '';
    if (btnClear) btnClear.classList.add('hidden');
    searchQuery = '';
    renderTasks();
}

function toggleSortOrder() {
    sortAscending = !sortAscending;
    const sortText = document.getElementById('sort-text');
    const sortIcon = document.getElementById('sort-icon');

    if (sortAscending) {
        sortText.innerText = 'Due (A-Z)';
        sortIcon.className = 'fas fa-sort-amount-down-alt';
    } else {
        sortText.innerText = 'Due (Z-A)';
        sortIcon.className = 'fas fa-sort-amount-up';
    }
    renderTasks();
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

    // 2. Filter Berdasarkan Pencarian Global Header
    if (searchQuery) {
        filtered = filtered.filter(t => 
            (t.title && t.title.toLowerCase().includes(searchQuery)) ||
            (t.note && t.note.toLowerCase().includes(searchQuery))
        );
    }

    // 3. Pengurutan (Sort by Due Date)
    filtered.sort((a, b) => {
        const dateA = a.due ? new Date(a.due).getTime() : (sortAscending ? 9999999999999 : -9999999999999);
        const dateB = b.due ? new Date(b.due).getTime() : (sortAscending ? 9999999999999 : -9999999999999);

        if (sortAscending) {
            return dateA - dateB;
        } else {
            return dateB - dateA;
        }
    });

    if (currentFilter === 'completed') {
        completedSection.style.display = 'none';
        if (filtered.length === 0) {
            activeContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#605e5c; font-size:14px;">Tidak ada tugas yang cocok.</div>`;
            return;
        }
        filtered.forEach(t => activeContainer.appendChild(createTaskElement(t)));
        return;
    }

    const activeTasks = filtered.filter(t => !t.completed);
    const completedTasks = filtered.filter(t => t.completed);

    if (activeTasks.length === 0 && completedTasks.length === 0) {
        activeContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#605e5c; font-size:14px;">Tidak ada tugas yang cocok.</div>`;
    } else {
        activeTasks.forEach(t => activeContainer.appendChild(createTaskElement(t)));
    }

    if (completedTasks.length > 0) {
        completedSection.style.display = 'block';
        completedTasks.forEach(t => completedContainer.appendChild(createTaskElement(t)));
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
    if (confirm("Apakah Anda yakin ingin menghapus tugas ini?")) {
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

window.onclick = function(event) {
    const newListModal = document.getElementById('newListModal');
    const deleteListModal = document.getElementById('deleteListModal');
    if (event.target == newListModal) {
        closeNewListModal();
    }
    if (event.target == deleteListModal) {
        closeDeleteListModal();
    }
};

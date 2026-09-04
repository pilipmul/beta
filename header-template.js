/**
 * Global Navigation Controller - Auto Hover Expandable Sidebar
 */
function renderHeader({ subtitle = "System Integrated" } = {}) {
    const path = window.location.pathname.toLowerCase();

    const globalHeaderWrapper = document.getElementById('global-header');
    if (globalHeaderWrapper) {
        globalHeaderWrapper.innerHTML = `
          <aside id="sidebar" 
                 onmouseenter="expandSidebarOnHover()" 
                 onmouseleave="collapseSidebarOnHover()" 
                 class="sidebar-collapsed min-h-screen flex flex-col fixed left-0 top-0 z-50">
            
            <!-- Header Sidebar & Avatar Toggle -->
            <div class="p-2 border-b border-slate-800 flex items-center gap-2.5 h-14">
              <button type="button" 
                      onclick="toggleSidebar()" 
                      title="Toggle Navigation"
                      class="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold shrink-0 text-xs transition border-0 cursor-pointer shadow-sm">
                <span id="nav-header-avatar">U</span>
              </button>
              
              <div class="sidebar-text truncate">
                <h1 class="text-[10px] font-bold leading-tight truncate">SOT Portal</h1>
                <p id="header-subtitle-text" class="text-[9px] text-slate-400 truncate">${subtitle}</p>
              </div>
            </div>

            <!-- Navigasi Menu Sidebar -->
            <nav class="flex-1 px-1.5 py-3 space-y-2 overflow-y-auto custom-scroll text-xs">
              
              <!-- Dashboard -->
              <a href="dashboard.html" class="flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Dashboard">
                <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 00-1 1m-6 0h6"/>
                </svg>
                <span class="sidebar-text truncate">Dashboard</span>
              </a>
              
              <!-- Eskalasi -->
              <a id="nav-eskalasi" href="eskalasi.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Eskalasi">
                <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span class="sidebar-text truncate">Eskalasi</span>
              </a>
              
              <!-- RKM -->
              <a id="nav-rkm" href="RKM.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="RKM">
                <svg class="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span class="sidebar-text truncate">RKM</span>
              </a>

              <!-- Dok. Perbaikan -->
              <a id="nav-dokPerbaikan" href="sr.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Dok. Perbaikan">
                <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <span class="sidebar-text truncate">Dok. Perbaikan</span>
              </a>

              <!-- Tasks -->
              <a id="nav-tasks" href="tasks.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Tasks">
                <svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012 2h2a2 2 0 012-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <span class="sidebar-text truncate">Tasks</span>
              </a>

              <!-- Syncflow -->
              <a id="nav-syncflow" href="syncflow.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Syncflow">
                <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <span class="sidebar-text truncate">Syncflow</span>
              </a>

              <!-- Logistics -->
              <a id="nav-logistics" href="logistics.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Logistics">
                <svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <span class="sidebar-text truncate">Logistics</span>
              </a>

              <!-- Inventory -->
              <a id="nav-inventory" href="inventory.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Inventory">
                <svg class="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <span class="sidebar-text truncate">Inventory</span>
              </a>

              <!-- Assets -->
              <a id="nav-assets" href="assets.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Assets">
                <svg class="w-5 h-5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span class="sidebar-text truncate">Assets</span>
              </a>

              <!-- Access Control -->
              <a id="nav-access" href="access.html" class="hidden flex items-center gap-2.5 px-1 py-1.5 text-slate-400 hover:text-white transition no-underline" title="Access Control">
                <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <span class="sidebar-text truncate">Access Control</span>
              </a>
            </nav>

            <!-- Footer Sidebar -->
            <div class="p-2 border-t border-slate-800 text-xs">
              <button type="button" onclick="handleLogout()" class="w-full flex items-center gap-2.5 px-1 py-1.5 text-rose-400 hover:text-rose-300 transition cursor-pointer border-0 bg-transparent" title="Keluar">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span class="sidebar-text truncate font-medium">Keluar</span>
              </button>
            </div>
          </aside>
        `;
    }

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.classList.remove('main-offset-expanded');
        mainContent.classList.add('main-offset-collapsed');
    }

    initNavbarAccess();
    highlightActiveMenu(path);
}

function expandSidebarOnHover() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('sidebar-collapsed')) {
        sidebar.classList.replace('sidebar-collapsed', 'sidebar-expanded');
    }
}

function collapseSidebarOnHover() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('sidebar-expanded')) {
        sidebar.classList.replace('sidebar-expanded', 'sidebar-collapsed');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('sidebar-expanded')) {
        sidebar.classList.replace('sidebar-expanded', 'sidebar-collapsed');
    } else {
        sidebar.classList.replace('sidebar-collapsed', 'sidebar-expanded');
    }
}

function highlightActiveMenu(path) {
    document.querySelectorAll('#sidebar nav a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (path.includes(href) && href !== 'dashboard.html') {
            link.classList.add('text-white', 'font-bold');
            link.classList.remove('text-slate-400');
        }
    });
}

function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
        localStorage.removeItem("user");
        sessionStorage.clear();
        window.location.replace("login.html");
    }
}

function initNavbarAccess() {
    const session = localStorage.getItem("user");
    if (!session) return;
    
    let user;
    try {
        user = JSON.parse(session);
    } catch {
        return;
    }

    const userData = user.data || user;
    const displayName = userData.nama || userData.username || "U";
    const headerAvatarEl = document.getElementById("nav-header-avatar");
    if (headerAvatarEl) headerAvatarEl.textContent = displayName.charAt(0).toUpperCase();

    const isSuperAdmin = (userData.nama || userData.username || "").toLowerCase() === "dede hidayat";

    // 1 Key Tepat Sesuai Kolom Supabase
    const modules = [
        { id: "nav-eskalasi",     key: "eskalasi"  },
        { id: "nav-rkm",          key: "rkm"       },
        { id: "nav-dokPerbaikan", key: "perbaikan" },
        { id: "nav-tasks",        key: "task"      },
        { id: "nav-syncflow",     key: "sync"      },
        { id: "nav-logistics",    key: "log"       },
        { id: "nav-inventory",    key: "item"      },
        { id: "nav-assets",       key: "assets"    },
        { id: "nav-access",       key: "acces"     }
    ];

    modules.forEach(mod => {
        const el = document.getElementById(mod.id);
        if (!el) return;

        let allowed = isSuperAdmin;
        if (!allowed && userData[mod.key] !== undefined && userData[mod.key] !== null) {
            const val = String(userData[mod.key]).trim().toUpperCase();
            allowed = (val === "Y" || val === "TRUE" || val === "1");
        }

        el.classList.toggle("hidden", !allowed);
    });
}
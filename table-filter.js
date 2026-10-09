/**
 * TableFilterManager
 * Reusable class for cascading column filters with dynamic popovers,
 * Excel-style tree filtering (collapsed by default across all levels),
 * and distinct level guide lines.
 */
class TableFilterManager {
  constructor(options) {
    this.tableName = options.tableName;
    this.supabaseClient = options.supabaseClient;
    this.allColumns = options.columns || [];
    this.dateColumns = new Set(options.dateColumns || ['date', 'created_at', 'updated_at']);
    this.onFilterChange = options.onFilterChange;
    
    this.globalSearchQuery = options.globalSearchQuery || '';
    this.filterSelections = {};
    this.activeFilterColumn = null;
    this.draftFilterSelections = new Set();
    this.dbFilterOptions = {};
    
    this.popoverEl = document.getElementById(options.popoverId || 'filterPopover');
    this.containerEl = document.getElementById(options.containerId || 'filterItemsList');
    this.searchInputEl = document.getElementById(options.searchInputId || 'filterSearchInput');
    this.selectAllCbEl = document.getElementById(options.selectAllId || 'selectAllCheckbox');

    this._bindEvents();
  }

  _bindEvents() {
    if (this.searchInputEl) {
      this.searchInputEl.setAttribute('autocomplete', 'off');
      this.searchInputEl.oninput = () => this.renderCheckboxes();
    }
  }

  applyToSupabaseQuery(query, searchColumns = []) {
    if (this.globalSearchQuery && searchColumns.length > 0) {
      const orConditions = searchColumns.map(col => `${col}.ilike.%${this.globalSearchQuery}%`).join(',');
      query = query.or(orConditions);
    }

    for (const colKey in this.filterSelections) {
      const selectedSet = this.filterSelections[colKey];
      if (selectedSet && selectedSet.size > 0) {
        const selectedArray = Array.from(selectedSet);
        const hasBlank = selectedArray.includes('-');
        const nonBlankValues = selectedArray.filter(v => v !== '-');

        if (hasBlank && nonBlankValues.length > 0) {
          query = query.or(`${colKey}.in.(${nonBlankValues.map(v => `"${v}"`).join(',')}),${colKey}.is.null,${colKey}.eq.`);
        } else if (hasBlank) {
          query = query.or(`${colKey}.is.null,${colKey}.eq.`);
        } else if (nonBlankValues.length > 0) {
          query = query.in(colKey, nonBlankValues);
        }
      }
    }
    return query;
  }

  toggleMenu(columnKey, event, fallbackData = []) {
    if (event) event.stopPropagation();

    if (this.activeFilterColumn === columnKey && !this.popoverEl.classList.contains('hidden')) {
      this.closePopover();
      return;
    }

    this.activeFilterColumn = columnKey;

    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      let leftPos = Math.max(10, Math.min(rect.left + window.scrollX - 100, window.innerWidth - 230));
      this.popoverEl.style.top = `${rect.bottom + window.scrollY + 4}px`;
      this.popoverEl.style.left = `${leftPos}px`;
    }

    if (this.searchInputEl) this.searchInputEl.value = '';
    this.popoverEl.classList.remove('hidden');

    let query = this.supabaseClient.from(this.tableName).select(columnKey);

    if (this.globalSearchQuery !== '') {
      const searchCols = ['user', 'item', 'note', 'trx_code', 'project'];
      const orConditions = searchCols.map(col => `${col}.ilike.%${this.globalSearchQuery}%`).join(',');
      query = query.or(orConditions);
    }

    for (const key in this.filterSelections) {
      if (key === columnKey) continue;
      const selectedSet = this.filterSelections[key];
      if (selectedSet && selectedSet.size > 0) {
        const selectedArray = Array.from(selectedSet);
        const hasBlank = selectedArray.includes('-');
        const nonBlank = selectedArray.filter(v => v !== '-');

        if (hasBlank && nonBlank.length > 0) {
          query = query.or(`${key}.in.(${nonBlank.map(v => `"${v}"`).join(',')}),${key}.is.null,${key}.eq.`);
        } else if (hasBlank) {
          query = query.or(`${key}.is.null,${key}.eq.`);
        } else if (nonBlank.length > 0) {
          query = query.in(key, nonBlank);
        }
      }
    }

    query.then(({ data, error }) => {
      if (!error && data) {
        const vals = data.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-');
        this.dbFilterOptions[columnKey] = Array.from(new Set(vals)).sort();
      } else {
        const fallback = fallbackData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-');
        this.dbFilterOptions[columnKey] = Array.from(new Set(fallback)).sort();
      }
      this._updateDrafts();
    }).catch(() => {
      const fallback = fallbackData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-');
      this.dbFilterOptions[columnKey] = Array.from(new Set(fallback)).sort();
      this._updateDrafts();
    });
  }

  _updateDrafts() {
    const activeSaved = this.filterSelections[this.activeFilterColumn];
    const allOpts = this.dbFilterOptions[this.activeFilterColumn] || [];
    this.draftFilterSelections = (activeSaved && activeSaved.size > 0) ? new Set(activeSaved) : new Set(allOpts);
    this.renderCheckboxes();
  }

  renderCheckboxes() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const uniqueValues = this.dbFilterOptions[this.activeFilterColumn] || [];
    const isDateCol = this.dateColumns.has(this.activeFilterColumn);

    if (isDateCol) {
      this._renderDateTree(uniqueValues);
    } else {
      this._renderFlatCheckboxes(uniqueValues);
    }
  }

  _renderFlatCheckboxes(uniqueValues) {
    const searchVal = this.searchInputEl ? this.searchInputEl.value.trim().toLowerCase() : '';
    let visibleCount = 0, visibleCheckedCount = 0;

    uniqueValues.forEach(val => {
      if (searchVal && !val.toLowerCase().includes(searchVal)) return;

      visibleCount++;
      const isChecked = this.draftFilterSelections.has(val);
      if (isChecked) visibleCheckedCount++;

      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-1 rounded cursor-pointer truncate';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = val;
      checkbox.checked = isChecked;
      checkbox.className = 'filter-cb';

      checkbox.onchange = (e) => {
        if (e.target.checked) this.draftFilterSelections.add(val);
        else this.draftFilterSelections.delete(val);
        this.updateSelectAllState();
      };

      label.appendChild(checkbox);
      const span = document.createElement('span');
      span.className = 'truncate';
      span.innerText = val;
      label.appendChild(span);

      this.containerEl.appendChild(label);
    });

    if (this.selectAllCbEl) {
      this.selectAllCbEl.checked = visibleCount > 0 && visibleCheckedCount === visibleCount;
    }
  }

  _renderDateTree(uniqueValues) {
    const searchVal = this.searchInputEl ? this.searchInputEl.value.trim().toLowerCase() : '';
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const tree = {};
    const blanks = [];

    uniqueValues.forEach(dateStr => {
      if (dateStr === '-') {
        blanks.push('-');
        return;
      }

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        blanks.push(dateStr);
        return;
      }

      const year = d.getFullYear();
      const month = d.getMonth();

      if (!tree[year]) tree[year] = {};
      if (!tree[year][month]) tree[year][month] = [];
      tree[year][month].push(dateStr);
    });

    const years = Object.keys(tree).sort((a, b) => b - a);

    years.forEach(year => {
      const yearStr = String(year);
      const yearMatch = !searchVal || yearStr.includes(searchVal);

      const months = Object.keys(tree[year]).sort((a, b) => b - a);
      let yearHasMatchingMonth = false;
      const validMonthsForYear = [];

      months.forEach(monthIdx => {
        const idName = monthNames[monthIdx].toLowerCase();
        const enName = monthNamesEn[monthIdx].toLowerCase();
        const monthMatch = !searchVal || idName.includes(searchVal) || enName.includes(searchVal);

        const dates = tree[year][monthIdx].sort().reverse();
        const matchingDates = dates.filter(isoDate => {
          const dayVal = isoDate.includes('-') ? String(parseInt(isoDate.split('-')[2], 10)) : isoDate;
          return !searchVal || yearMatch || monthMatch || isoDate.toLowerCase().includes(searchVal) || dayVal.includes(searchVal);
        });

        if (yearMatch || monthMatch || matchingDates.length > 0) {
          yearHasMatchingMonth = true;
          validMonthsForYear.push({
            monthIdx,
            dates: yearMatch || monthMatch ? dates : matchingDates
          });
        }
      });

      if (!yearHasMatchingMonth) return;

      const yearDiv = document.createElement('div');
      yearDiv.className = 'space-y-1 mb-1 year-group';

      // Year Header
      const yearHeader = document.createElement('div');
      yearHeader.className = 'flex items-center gap-1.5 p-1 rounded hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] text-xs font-bold cursor-pointer';

      const yearToggle = document.createElement('span');
      yearToggle.className = 'text-[9px] text-[#5f6368] transition-transform inline-block w-3 text-center';
      
      // Expand year if a search is active so matching months are visible
      const isYearExpanded = !!searchVal;
      yearToggle.innerText = isYearExpanded ? '▼' : '▶';

      const yearCb = document.createElement('input');
      yearCb.type = 'checkbox';
      yearCb.className = 'filter-cb year-cb';

      const yearLabel = document.createElement('span');
      yearLabel.innerText = year;

      yearHeader.appendChild(yearToggle);
      yearHeader.appendChild(yearCb);
      yearHeader.appendChild(yearLabel);
      yearDiv.appendChild(yearHeader);

      // Months Container
      const monthsContainer = document.createElement('div');
      monthsContainer.className = `ml-3 pl-2.5 space-y-1 border-l border-[#dadce0] dark:border-[#3c4043] relative ${isYearExpanded ? '' : 'hidden'}`;

      yearToggle.onclick = (e) => {
        e.stopPropagation();
        const isHidden = monthsContainer.classList.toggle('hidden');
        yearToggle.innerText = isHidden ? '▶' : '▼';
      };

      const allYearDates = [];

      validMonthsForYear.forEach(({ monthIdx, dates }) => {
        allYearDates.push(...dates);

        const monthDiv = document.createElement('div');
        monthDiv.className = 'space-y-0.5 relative month-group';

        // Month Header
        const monthHeader = document.createElement('div');
        monthHeader.className = 'flex items-center gap-1.5 p-0.5 rounded hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] text-[11px] font-medium cursor-pointer';

        const monthToggle = document.createElement('span');
        monthToggle.className = 'text-[9px] text-[#5f6368] transition-transform inline-block w-3 text-center';
        
        // Month child dates remain COLLAPSED by default
        monthToggle.innerText = '▶';

        const monthCb = document.createElement('input');
        monthCb.type = 'checkbox';
        monthCb.className = 'filter-cb month-cb';

        const monthLabel = document.createElement('span');
        monthLabel.innerText = monthNames[monthIdx];

        monthHeader.appendChild(monthToggle);
        monthHeader.appendChild(monthCb);
        monthHeader.appendChild(monthLabel);
        monthDiv.appendChild(monthHeader);

        // Dates Container (always hidden by default)
        const datesContainer = document.createElement('div');
        datesContainer.className = 'ml-3 pl-2.5 space-y-0.5 border-l border-dashed border-[#dadce0] dark:border-[#3c4043] relative hidden';

        monthToggle.onclick = (e) => {
          e.stopPropagation();
          const isHidden = datesContainer.classList.toggle('hidden');
          monthToggle.innerText = isHidden ? '▶' : '▼';
        };

        dates.forEach(isoDate => {
          const dateLabel = document.createElement('label');
          dateLabel.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-0.5 rounded cursor-pointer truncate relative';

          const dateCb = document.createElement('input');
          dateCb.type = 'checkbox';
          dateCb.value = isoDate;
          dateCb.checked = this.draftFilterSelections.has(isoDate);
          dateCb.className = 'filter-cb date-leaf-cb';

          dateCb.onchange = () => {
            if (dateCb.checked) this.draftFilterSelections.add(isoDate);
            else this.draftFilterSelections.delete(isoDate);
            this._syncDateTreeStates();
          };

          dateLabel.appendChild(dateCb);
          const span = document.createElement('span');
          const dayVal = isoDate.includes('-') ? parseInt(isoDate.split('-')[2], 10) : isoDate;
          span.innerText = dayVal;

          dateLabel.appendChild(span);
          datesContainer.appendChild(dateLabel);
        });

        // Month Checkbox Handler
        monthCb.onchange = () => {
          dates.forEach(d => {
            if (monthCb.checked) this.draftFilterSelections.add(d);
            else this.draftFilterSelections.delete(d);
          });
          this._syncDateTreeStates();
        };

        monthDiv.dataset.dates = JSON.stringify(dates);
        monthDiv.appendChild(datesContainer);
        monthsContainer.appendChild(monthDiv);
      });

      // Year Checkbox Handler
      yearCb.onchange = () => {
        allYearDates.forEach(d => {
          if (yearCb.checked) this.draftFilterSelections.add(d);
          else this.draftFilterSelections.delete(d);
        });
        this._syncDateTreeStates();
      };

      yearDiv.dataset.dates = JSON.stringify(allYearDates);
      yearDiv.appendChild(monthsContainer);
      this.containerEl.appendChild(yearDiv);
    });

    blanks.forEach(val => {
      if (searchVal && val !== '-' && !val.toLowerCase().includes(searchVal)) return;

      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-1 rounded cursor-pointer truncate mt-1 border-t border-[#f1f3f4] dark:border-[#3c4043]';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = val;
      checkbox.checked = this.draftFilterSelections.has(val);
      checkbox.className = 'filter-cb date-leaf-cb';

      checkbox.onchange = () => {
        if (checkbox.checked) this.draftFilterSelections.add(val);
        else this.draftFilterSelections.delete(val);
        this._syncDateTreeStates();
      };

      label.appendChild(checkbox);
      const span = document.createElement('span');
      span.innerText = val === '-' ? '(Kosong)' : val;
      label.appendChild(span);
      this.containerEl.appendChild(label);
    });

    this._syncDateTreeStates();
  }

  _syncDateTreeStates() {
    // 1. Sync Month Checkboxes with Indeterminate State Support
    this.containerEl.querySelectorAll('div.month-group').forEach(groupEl => {
      const dates = JSON.parse(groupEl.dataset.dates || '[]');
      if (dates.length === 0) return;

      const checkedCount = dates.filter(d => this.draftFilterSelections.has(d)).length;
      const monthCb = groupEl.querySelector('.month-cb');

      if (monthCb) {
        if (checkedCount === dates.length) {
          monthCb.checked = true;
          monthCb.indeterminate = false;
        } else if (checkedCount > 0) {
          monthCb.checked = false;
          monthCb.indeterminate = true;
        } else {
          monthCb.checked = false;
          monthCb.indeterminate = false;
        }
      }
    });

    // 2. Sync Year Checkboxes with Indeterminate State Support
    this.containerEl.querySelectorAll('div.year-group').forEach(yearDiv => {
      const dates = JSON.parse(yearDiv.dataset.dates || '[]');
      if (dates.length === 0) return;

      const checkedCount = dates.filter(d => this.draftFilterSelections.has(d)).length;
      const yearCb = yearDiv.querySelector('.year-cb');

      if (yearCb) {
        if (checkedCount === dates.length) {
          yearCb.checked = true;
          yearCb.indeterminate = false;
        } else if (checkedCount > 0) {
          yearCb.checked = false;
          yearCb.indeterminate = true;
        } else {
          yearCb.checked = false;
          yearCb.indeterminate = false;
        }
      }
    });

    // 3. Sync Leaf Date Checkboxes
    const allLeafCbs = this.containerEl.querySelectorAll('.date-leaf-cb');
    allLeafCbs.forEach(cb => {
      cb.checked = this.draftFilterSelections.has(cb.value);
    });

    // 4. Sync Global Select All Checkbox
    const visibleChecked = Array.from(allLeafCbs).filter(cb => cb.checked).length;
    if (this.selectAllCbEl) {
      this.selectAllCbEl.checked = allLeafCbs.length > 0 && visibleChecked === allLeafCbs.length;
      this.selectAllCbEl.indeterminate = visibleChecked > 0 && visibleChecked < allLeafCbs.length;
    }
  }

  updateSelectAllState() {
    const cbs = this.containerEl.querySelectorAll('.filter-cb');
    const allChecked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
    if (this.selectAllCbEl) this.selectAllCbEl.checked = allChecked;
  }

  toggleSelectAll(checked) {
    const uniqueValues = this.dbFilterOptions[this.activeFilterColumn] || [];
    uniqueValues.forEach(val => {
      if (checked) this.draftFilterSelections.add(val);
      else this.draftFilterSelections.delete(val);
    });
    this.renderCheckboxes();
  }

  clearColumn() {
    delete this.filterSelections[this.activeFilterColumn];
    this.draftFilterSelections = new Set(this.dbFilterOptions[this.activeFilterColumn] || []);
    if (this.searchInputEl) this.searchInputEl.value = '';
    this.renderCheckboxes();
    if (typeof this.onFilterChange === 'function') this.onFilterChange();
  }

  applyFilter() {
    const allOpts = this.dbFilterOptions[this.activeFilterColumn] || [];
    if (this.draftFilterSelections.size === 0 || this.draftFilterSelections.size === allOpts.length) {
      delete this.filterSelections[this.activeFilterColumn];
    } else {
      this.filterSelections[this.activeFilterColumn] = new Set(this.draftFilterSelections);
    }
    this.closePopover();
    if (typeof this.onFilterChange === 'function') this.onFilterChange();
  }

  closePopover() {
    if (this.popoverEl) this.popoverEl.classList.add('hidden');
    this.activeFilterColumn = null;
  }
}
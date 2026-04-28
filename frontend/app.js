/**
 * TaskFlow — app.js  (Phase 3 — Live API Integration)
 * jQuery-only · Backend: Express + MongoDB on :5000
 */

$(function () {

  /* ══════════════════════════════════════════
     CONFIG
  ══════════════════════════════════════════ */
  const API = 'http://localhost:5000/api';

  /* ══════════════════════════════════════════
     STATE  (populated from API, never hardcoded)
  ══════════════════════════════════════════ */
  let tasks      = [];
  let volunteers = [];

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */
  let activeFilter = 'all';
  let searchQuery  = '';

  /* ══════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════ */
  const PRIORITY_ICON = { critical: '🚨', high: '🔥', medium: '⚡', low: '🟢' };
  const STATUS_ICON   = { pending: '⏳', active: '▶', completed: '✓' };
  const STATUS_NEXT   = { pending: 'active', active: 'completed', completed: 'pending' };

  // Focusable elements selector (for focus trap)
  const FOCUSABLE_SEL = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  /* ══════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════ */

  function esc(str) {
    return $('<span>').text(String(str || '')).html();
  }

  function capitalize(s) {
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
  }

  /* ── Toast notifications ─────────────────── */
  function showToast(msg, type) {
    const cls = type === 'success' ? 'toast-success' : 'toast-error';
    const $t  = $(`<div class="toast ${cls}">${esc(msg)}</div>`);
    $('body').append($t);
    void $t[0].offsetWidth;  // force reflow
    $t.addClass('toast-show');
    setTimeout(function () {
      $t.removeClass('toast-show');
      setTimeout(function () { $t.remove(); }, 320);
    }, 3500);
  }

  /* ── Full-page loading overlay ───────────── */
  function setLoading(on) {
    if (on) {
      if (!$('#app-loading').length) {
        $('body').append('<div id="app-loading"><div class="spinner"></div></div>');
      }
    } else {
      $('#app-loading').remove();
    }
  }

  /* ── Busy state on a submit button ──────── */
  function setBusy($btn, busy) {
    if (busy) {
      $btn.data('orig-html', $btn.html()).prop('disabled', true)
          .html('<span class="btn-spinner"></span>');
    } else {
      $btn.prop('disabled', false).html($btn.data('orig-html') || $btn.html());
    }
  }

  /* ══════════════════════════════════════════
     STATS — GET /api/stats
  ══════════════════════════════════════════ */
  function fetchStats() {
    return $.getJSON(`${API}/stats`)
      .done(function (stats) {
        animateCounter('#stat-active',     stats.totalActive     || 0);
        animateCounter('#stat-critical',   stats.totalCritical   || 0);
        animateCounter('#stat-volunteers', stats.totalVolunteers || 0);
        animateCounter('#stat-completed',  stats.completedToday  || 0);
      });
  }

  function animateCounter(selector, target) {
    const $el  = $(selector);
    const from = parseInt($el.text(), 10) || 0;
    if (from === target) return;
    $({ n: from }).animate({ n: target }, {
      duration: 450,
      step()  { $el.text(Math.round(this.n)); },
      done()  { $el.text(target); }
    });
  }

  /* ══════════════════════════════════════════
     VOLUNTEERS SIDEBAR — render from state
  ══════════════════════════════════════════ */
  function renderVolunteers() {
    const $list    = $('#volunteer-list').empty();
    const availCnt = volunteers.filter(function (v) {
      return v.availability === 'available';
    }).length;

    $('#vol-count').text(availCnt);

    if (!volunteers.length) {
      $list.append(
        '<p style="font-size:.8rem;color:var(--text-muted);text-align:center;padding:.5rem 0">No volunteers yet.</p>'
      );
      return;
    }

    volunteers.forEach(function (v) {
      const avail     = v.availability === 'available';
      const statusCls = avail ? 'available' : 'assigned';
      const statusTxt = avail ? 'Available' : capitalize(v.availability.replace('_', ' '));

      $list.append(
        `<div class="vol-card ${avail ? '' : 'busy'}">
           <div class="vol-name">${esc(v.name)}</div>
           <div class="vol-role">${esc(v.role)}</div>
           <span class="vol-status ${statusCls}">${statusTxt}</span>
         </div>`
      );
    });
  }

  /* ══════════════════════════════════════════
     ASSIGN CELL — available volunteers only
     task.assignedTo is a populated object or null
  ══════════════════════════════════════════ */
  function buildAssignCell(task) {
    if (task.assignedTo) {
      return `<span class="assigned-tag">👤 ${esc(task.assignedTo.name)}</span>`;
    }

    const available = volunteers.filter(function (v) {
      return v.availability === 'available';
    });

    if (!available.length) {
      return `<select class="assign-select" disabled>
                <option>No volunteers available</option>
              </select>`;
    }

    const opts = available.map(function (v) {
      return `<option value="${v._id}">${esc(v.name)}</option>`;
    }).join('');

    return `<select class="assign-select" data-task-id="${task._id}">
              <option value="">+ Assign volunteer</option>
              ${opts}
            </select>`;
  }

  /* ══════════════════════════════════════════
     LOAD ALL — parallel fetch on page load
  ══════════════════════════════════════════ */
  function loadAll() {
    setLoading(true);
    return $.when(
      $.getJSON(`${API}/tasks`),
      $.getJSON(`${API}/volunteers`),
      fetchStats()
    ).done(function (tasksRes, volsRes) {
      tasks      = tasksRes[0];
      volunteers = volsRes[0];
      renderTasks();
    }).fail(function () {
      showToast('Could not connect to the server. Is the backend running on port 5000?');
    }).always(function () {
      setLoading(false);
    });
  }

  /* ══════════════════════════════════════════
     TASK GRID — render with filter + search
  ══════════════════════════════════════════ */
  function renderTasks() {
    const q = searchQuery.toLowerCase();

    const filtered = tasks.filter(function (t) {
      const matchPriority = activeFilter === 'all' || t.priority === activeFilter;
      const matchSearch   = !q
        || t.title.toLowerCase().includes(q)
        || t.description.toLowerCase().includes(q);
      return matchPriority && matchSearch;
    });

    const $grid = $('#task-grid').empty();

    if (filtered.length === 0) {
      $('#empty-state').removeAttr('hidden');
    } else {
      $('#empty-state').attr('hidden', '');
      filtered.forEach(function (task) {
        $grid.append(
          `<div class="task-card" data-task-id="${task._id}" data-priority="${task.priority}">
             <div class="card-top">
               <span class="card-title">${esc(task.title)}</span>
             </div>
             <p class="card-desc">${esc(task.description)}</p>
             <div class="badge-row">
               <span class="badge-priority ${task.priority}">
                 ${PRIORITY_ICON[task.priority] || ''} ${capitalize(task.priority)}
               </span>
               <button class="badge-status ${task.status}"
                       data-task-id="${task._id}"
                       title="Click to advance status"
                       aria-label="Status: ${task.status}. Click to advance.">
                 ${STATUS_ICON[task.status]} ${task.status.toUpperCase()}
               </button>
             </div>
             <div class="card-actions">
               <div class="assign-wrapper">${buildAssignCell(task)}</div>
               <button class="btn-delete"
                       data-task-id="${task._id}"
                       title="Delete task"
                       aria-label="Delete task: ${esc(task.title)}">🗑</button>
             </div>
           </div>`
        );
      });
    }

    renderVolunteers();
  }

  /* ══════════════════════════════════════════
     ① MODAL HELPERS
     open / close / focus trap / ESC
  ══════════════════════════════════════════ */
  function openModal(backdropId) {
    const $backdrop = $('#' + backdropId).addClass('open');
    // Focus first focusable element
    const $first = $backdrop.find(FOCUSABLE_SEL).filter(':visible').first();
    if ($first.length) $first.focus();
  }

  function closeModal(backdropId) {
    $('#' + backdropId).removeClass('open');
  }

  // FAB → New Task modal
  $('#open-task-modal').on('click', function () {
    resetTaskForm();
    openModal('task-modal-backdrop');
  });

  // Header button → Register Volunteer modal
  $('#open-volunteer-modal').on('click', function () {
    resetVolForm();
    openModal('vol-modal-backdrop');
  });

  // [data-close] close buttons inside modals
  $(document).on('click', '[data-close]', function () {
    closeModal($(this).data('close'));
  });

  // Click on dark backdrop to close
  $(document).on('click', '.modal-backdrop', function (e) {
    if ($(e.target).hasClass('modal-backdrop')) {
      closeModal($(this).attr('id'));
    }
  });

  // Keyboard: ESC closes, Tab traps focus
  $(document).on('keydown', function (e) {

    // ESC — close any open modal
    if (e.key === 'Escape') {
      $('.modal-backdrop.open').each(function () {
        closeModal($(this).attr('id'));
      });
      return;
    }

    // Tab — trap focus inside open modal
    if (e.key === 'Tab') {
      const $backdrop = $('.modal-backdrop.open');
      if (!$backdrop.length) return;

      const $focusable = $backdrop.find(FOCUSABLE_SEL).filter(':visible');
      if (!$focusable.length) return;

      const first = $focusable.first()[0];
      const last  = $focusable.last()[0];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first → last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last → first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  /* ══════════════════════════════════════════
     ② STATUS BADGE → PATCH /api/tasks/:id/status
     Server advances one step: pending→active→completed
  ══════════════════════════════════════════ */
  $(document).on('click', '.badge-status', function () {
    const id   = $(this).data('task-id');
    const $btn = $(this);

    if ($btn.hasClass('completed')) {
      showToast('This task is already completed.', 'error');
      return;
    }

    setBusy($btn, true);

    $.ajax({
      url:    `${API}/tasks/${id}/status`,
      method: 'PATCH'
    }).done(function (updated) {
      const idx = tasks.findIndex(function (t) { return t._id === id; });
      if (idx > -1) tasks[idx] = updated;
      renderTasks();
      fetchStats();
    }).fail(function (xhr) {
      setBusy($btn, false);
      showToast(xhr.responseJSON && xhr.responseJSON.error
        ? xhr.responseJSON.error
        : 'Failed to update status.');
    });
  });

  /* ══════════════════════════════════════════
     ④ ASSIGN DROPDOWN → POST /api/tasks/:id/assign
  ══════════════════════════════════════════ */
  $(document).on('change', '.assign-select', function () {
    const taskId = $(this).data('task-id');
    const volId  = $(this).val();
    if (!taskId || !volId) return;

    const $sel = $(this).prop('disabled', true);

    $.ajax({
      url:         `${API}/tasks/${taskId}/assign`,
      method:      'POST',
      contentType: 'application/json',
      data:        JSON.stringify({ volunteerId: volId })
    }).done(function () {
      loadAll();
    }).fail(function (xhr) {
      $sel.prop('disabled', false).val('');
      showToast(xhr.responseJSON && xhr.responseJSON.error
        ? xhr.responseJSON.error
        : 'Assignment failed.');
    });
  });

  /* ══════════════════════════════════════════
     ⑥ DELETE → DELETE /api/tasks/:id
     CSS slide-out first, then API call
  ══════════════════════════════════════════ */
  $(document).on('click', '.btn-delete', function () {
    const id    = $(this).data('task-id');
    const $card = $(this).closest('.task-card');

    $card.addClass('removing');

    $.ajax({
      url:    `${API}/tasks/${id}`,
      method: 'DELETE'
    }).done(function () {
      setTimeout(function () {
        tasks = tasks.filter(function (t) { return t._id !== id; });
        renderTasks();
        fetchStats();
      }, 360);
    }).fail(function (xhr) {
      $card.removeClass('removing');
      showToast(xhr.responseJSON && xhr.responseJSON.error
        ? xhr.responseJSON.error
        : 'Delete failed.');
    });
  });

  /* ══════════════════════════════════════════
     ⑤ PRIORITY FILTER PILLS
  ══════════════════════════════════════════ */
  $(document).on('click', '.pill', function () {
    activeFilter = $(this).data('filter');
    $('.pill').removeClass('active');
    $(this).addClass('active');
    renderTasks();
  });

  /* ══════════════════════════════════════════
     ⑤ SEARCH INPUT
  ══════════════════════════════════════════ */
  $('#search-input').on('input', function () {
    searchQuery = $(this).val().trim();
    renderTasks();
  });

  /* ══════════════════════════════════════════
     ⑦ NEW TASK FORM — validation + submit
  ══════════════════════════════════════════ */

  // Live character counter on description
  $('#task-desc').on('input', function () {
    const len = $(this).val().length;
    $('#desc-count').text(len);
    const $counter = $('#desc-counter').removeClass('warn full');
    if      (len >= 200) $counter.addClass('full');
    else if (len >= 160) $counter.addClass('warn');
  });

  // Clear errors as user corrects the field
  $('#task-title').on('input', function () {
    if ($(this).val().trim().length >= 5) clearError('#task-title', '#title-error');
  });
  $('#task-desc').on('input', function () {
    const l = $(this).val().trim().length;
    if (l > 0 && l <= 200) clearError('#task-desc', '#desc-error');
  });

  $('#new-task-form').on('submit', function (e) {
    e.preventDefault();

    const title = $('#task-title').val().trim();
    const desc  = $('#task-desc').val().trim();
    const prio  = $('#task-priority').val();
    let valid   = true;

    if (title.length < 5) {
      showError('#task-title', '#title-error', 'Title must be at least 5 characters.');
      valid = false;
    } else {
      clearError('#task-title', '#title-error');
    }

    if (!desc) {
      showError('#task-desc', '#desc-error', 'Description is required.');
      valid = false;
    } else if (desc.length > 200) {
      showError('#task-desc', '#desc-error', 'Description cannot exceed 200 characters.');
      valid = false;
    } else {
      clearError('#task-desc', '#desc-error');
    }

    if (!valid) return;

    const $submit = $(this).find('[type=submit]');
    setBusy($submit, true);

    $.ajax({
      url:         `${API}/tasks`,
      method:      'POST',
      contentType: 'application/json',
      data:        JSON.stringify({ title, description: desc, priority: prio })
    }).done(function (newTask) {
      tasks.unshift(newTask);
      closeModal('task-modal-backdrop');
      resetTaskForm();
      renderTasks();
      fetchStats();
      showToast('Task created!', 'success');
    }).fail(function (xhr) {
      setBusy($submit, false);
      const errs = xhr.responseJSON && xhr.responseJSON.errors;
      const msg  = errs
        ? errs.map(function (e) { return e.msg; }).join(' · ')
        : ((xhr.responseJSON && xhr.responseJSON.error) || 'Failed to create task.');
      showToast(msg);
    });
  });

  function resetTaskForm() {
    $('#new-task-form')[0].reset();
    $('#desc-count').text(0);
    $('#desc-counter').removeClass('warn full');
    clearError('#task-title', '#title-error');
    clearError('#task-desc',  '#desc-error');
  }

  /* ══════════════════════════════════════════
     ③ REGISTER VOLUNTEER FORM — validation + submit
  ══════════════════════════════════════════ */

  // Inline error clearing
  $('#vol-name').on('input', function () {
    if ($(this).val().trim().length >= 2) clearError('#vol-name', '#vol-name-error');
  });
  $('#vol-email').on('input', function () {
    if (/\S+@\S+\.\S+/.test($(this).val().trim())) clearError('#vol-email', '#vol-email-error');
  });
  $('#vol-role').on('input', function () {
    if ($(this).val().trim().length >= 2) clearError('#vol-role', '#vol-role-error');
  });

  $('#new-vol-form').on('submit', function (e) {
    e.preventDefault();

    const name  = $('#vol-name').val().trim();
    const email = $('#vol-email').val().trim();
    const role  = $('#vol-role').val().trim();
    let valid   = true;

    if (name.length < 2) {
      showError('#vol-name', '#vol-name-error', 'Name must be at least 2 characters.');
      valid = false;
    } else {
      clearError('#vol-name', '#vol-name-error');
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      showError('#vol-email', '#vol-email-error', 'Valid email address required.');
      valid = false;
    } else {
      clearError('#vol-name', '#vol-name-error');
    }

    if (role.length < 2) {
      showError('#vol-role', '#vol-role-error', 'Role must be at least 2 characters.');
      valid = false;
    } else {
      clearError('#vol-role', '#vol-role-error');
    }

    if (!valid) return;

    const $submit = $(this).find('[type=submit]');
    setBusy($submit, true);

    $.ajax({
      url:         `${API}/volunteers`,
      method:      'POST',
      contentType: 'application/json',
      data:        JSON.stringify({ name, email, role })
    }).done(function (newVol) {
      volunteers.push(newVol);
      closeModal('vol-modal-backdrop');
      resetVolForm();
      renderTasks();
      fetchStats();
      showToast('Volunteer registered!', 'success');
    }).fail(function (xhr) {
      setBusy($submit, false);
      if (xhr.status === 409) {
        showError('#vol-email', '#vol-email-error', 'A volunteer with this email already exists.');
      } else {
        const errs = xhr.responseJSON && xhr.responseJSON.errors;
        const msg  = errs
          ? errs.map(function (e) { return e.msg; }).join(' · ')
          : ((xhr.responseJSON && xhr.responseJSON.error) || 'Registration failed.');
        showToast(msg);
      }
    });
  });

  function resetVolForm() {
    $('#new-vol-form')[0].reset();
    clearError('#vol-name',  '#vol-name-error');
    clearError('#vol-email', '#vol-email-error');
    clearError('#vol-role',  '#vol-role-error');
  }

  /* ══════════════════════════════════════════
     FORM VALIDATION HELPERS
  ══════════════════════════════════════════ */
  function showError(inputSel, errSel, msg) {
    $(inputSel).addClass('error');
    $(errSel).text(msg);
  }

  function clearError(inputSel, errSel) {
    $(inputSel).removeClass('error');
    $(errSel).text('');
  }

  /* ══════════════════════════════════════════
     INITIALISE
  ══════════════════════════════════════════ */

  // Display today's date in the header
  const now = new Date();
  $('#current-date').text(
    now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  );

  loadAll();

});

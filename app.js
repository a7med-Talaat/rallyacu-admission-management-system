/**
 * RALLY ACU - ADMISSIONS & INTERVIEW SHEET LOGIC
 * Manages applicants, interview evaluations (Committee & HR),
 * admission progress, filtering, CSV export, and state persistence.
 */

(function () {
  // Dedicated Database Table Key per Committee
  function getCommitteeDbKey(committeeName) {
    const slug = (committeeName || "general").toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `rally_db_committee_${slug}`;
  }

  function loadCommitteeDb(committeeName) {
    const key = getCommitteeDbKey(committeeName);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveCommitteeDb(committeeName, list) {
    const key = getCommitteeDbKey(committeeName);
    localStorage.setItem(key, JSON.stringify(list || []));
  }

  // Application State
  const state = {
    user: null,
    applicants: [],
    searchQuery: "",
    selectedCommittee: "ALL",
    selectedStatus: "ALL",
    evaluatingApplicantId: null
  };

  // Toast notification helper
  function showToast(message, isSuccess = true) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${isSuccess ? "toast-success" : ""}`;
    toast.innerHTML = `
      <span>${isSuccess ? "⚡" : "⚠️"}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Load applicants from the user's committee database tables
  function loadApplicants() {
    // Clear any previous legacy mock store
    localStorage.removeItem("rally_acu_interview_sheet_data_v1");

    const userAllowed = state.user && state.user.allowedCommittees ? state.user.allowedCommittees : (state.user && state.user.committee ? [state.user.committee] : ["General"]);
    
    let combined = [];
    userAllowed.forEach(comm => {
      const records = loadCommitteeDb(comm);
      combined = combined.concat(records);
    });

    state.applicants = combined;
  }

  // Save applicants back to their respective committee database tables
  function saveApplicants() {
    const userAllowed = state.user && state.user.allowedCommittees ? state.user.allowedCommittees : (state.user && state.user.committee ? [state.user.committee] : ["General"]);

    userAllowed.forEach(comm => {
      const commItems = state.applicants.filter(a => a.firstChoice === comm);
      saveCommitteeDb(comm, commItems);
    });
  }

  // Compute overall status from committee & HR checks
  function deriveAdmissionStatus(commStatus, hrStatus) {
    if (commStatus === "Rejected" || hrStatus === "Rejected") {
      return "Rejected";
    }
    if (commStatus === "Accepted" && hrStatus === "Accepted") {
      return "Fully Accepted 🎉";
    }
    if (commStatus === "Accepted" && hrStatus === "Pending") {
      return "Committee Accepted, Awaiting HR";
    }
    if (commStatus === "Pending" && hrStatus === "Accepted") {
      return "HR Accepted, Awaiting Committee";
    }
    return "In Review";
  }

  // Render Stats Cards for logged-in user's committee(s)
  function updateStats() {
    const userAllowed = state.user && state.user.allowedCommittees ? state.user.allowedCommittees : (state.user && state.user.committee ? [state.user.committee] : []);
    let list = state.applicants.filter(a => userAllowed.includes(a.firstChoice));

    if (state.selectedCommittee !== "ALL") {
      list = list.filter(a => a.firstChoice === state.selectedCommittee);
    }

    const total = list.length;
    const commAcc = list.filter(a => a.committeeStatus === "Accepted").length;
    const hrAcc = list.filter(a => a.hrStatus === "Accepted").length;
    const fullyAcc = list.filter(a => a.finalStatus.includes("Fully Accepted")).length;
    const pending = list.filter(a => a.committeeStatus === "Pending" || a.hrStatus === "Pending").length;

    const elTotal = document.getElementById("stat-total");
    const elComm = document.getElementById("stat-comm");
    const elHr = document.getElementById("stat-hr");
    const elFull = document.getElementById("stat-full");
    const elPending = document.getElementById("stat-pending");

    if (elTotal) elTotal.textContent = total;
    if (elComm) elComm.textContent = commAcc;
    if (elHr) elHr.textContent = hrAcc;
    if (elFull) elFull.textContent = fullyAcc;
    if (elPending) elPending.textContent = pending;
  }

  // Filter applicants - strictly scoped to user's allowed committees
  function getFilteredApplicants() {
    const q = state.searchQuery.trim().toLowerCase();
    const userAllowed = state.user && state.user.allowedCommittees ? state.user.allowedCommittees : (state.user && state.user.committee ? [state.user.committee] : []);

    return state.applicants.filter(app => {
      // Access Control: User can ONLY view their permitted committees
      if (userAllowed.length && !userAllowed.includes(app.firstChoice)) {
        return false;
      }
      // Specific committee toggle if user has multiple allowed
      if (state.selectedCommittee !== "ALL" && app.firstChoice !== state.selectedCommittee) {
        return false;
      }
      // Status filter
      if (state.selectedStatus === "ACCEPTED" && !app.finalStatus.includes("Accepted")) {
        return false;
      }
      if (state.selectedStatus === "PENDING" && app.finalStatus !== "In Review") {
        return false;
      }
      if (state.selectedStatus === "REJECTED" && app.finalStatus !== "Rejected") {
        return false;
      }
      // Search query
      if (q) {
        const match =
          (app.fullName && app.fullName.toLowerCase().includes(q)) ||
          (app.email && app.email.toLowerCase().includes(q)) ||
          (app.phone && app.phone.includes(q)) ||
          (app.faculty && app.faculty.toLowerCase().includes(q)) ||
          (app.id && app.id.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }

  // Render Table
  function renderTable() {
    const tbody = document.getElementById("sheet-tbody");
    if (!tbody) return;

    const list = getFilteredApplicants();
    const isHead = !state.user.isAdmin;
    const headCommittee = state.user.committee;

    if (list.length === 0) {
      const isSearching = !!state.searchQuery || state.selectedStatus !== "ALL";
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2.4rem; margin-bottom: 0.6rem;">${isSearching ? "🔍" : "📋"}</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">${isSearching ? "No applicants match your search" : "No candidates in this committee database yet"}</div>
            <div style="font-size: 0.85rem; margin-top: 6px; color: var(--text-secondary);">${isSearching ? "Try adjusting your search query or status filter." : "Click the <strong>'+ Add Candidate'</strong> button above to start entering applicants."}</div>
          </td>
        </tr>
      `;
      updateStats();
      return;
    }

    tbody.innerHTML = list.map((app, index) => {
      // Status badge colors
      const getBadgeClass = (status) => {
        if (status === "Accepted") return "accepted";
        if (status === "Rejected") return "rejected";
        return "pending";
      };

      const finalBadgeClass = app.finalStatus.includes("Fully")
        ? "accepted"
        : app.finalStatus === "Rejected"
        ? "rejected"
        : "pending";

      const committeeLabel = app.firstChoice + " Interview";

      return `
        <tr data-id="${app.id}">
          <td style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">
            ${app.id}
          </td>
          <td>
            <div class="candidate-cell">
              <span class="candidate-name">${app.fullName || 'Candidate ' + app.id}</span>
              <span class="candidate-meta">
                <span>🎓 ${app.faculty || 'General / ACU'}${app.academicYear && app.academicYear !== '—' ? ` (${app.academicYear})` : ''}</span>
                <span>•</span>
                <span>📞 ${app.phone || '—'}</span>
              </span>
            </div>
          </td>
          <td>
            <span class="status-badge" style="background: rgba(244,63,94,0.12); color: var(--red); border: 1px solid rgba(244,63,94,0.25);">
              ${app.firstChoice || 'General'}
            </span>
            ${app.secondChoice && app.secondChoice !== '—' ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">2nd: ${app.secondChoice}</div>` : ""}
          </td>
          <!-- Committee Interview Column -->
          <td>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="quick-toggle-group">
                <button
                  class="quick-toggle-btn ${app.committeeStatus === 'Accepted' ? 'active-accepted' : ''}"
                  onclick="window.RallyApp.toggleCommitteeInterview('${app.id}', 'Accepted')"
                  title="Mark Committee Interview as Accepted"
                >✓ Accept</button>
                <button
                  class="quick-toggle-btn ${app.committeeStatus === 'Pending' ? 'active-pending' : ''}"
                  onclick="window.RallyApp.toggleCommitteeInterview('${app.id}', 'Pending')"
                  title="Mark Committee Interview as Pending"
                >⏳ Pending</button>
                <button
                  class="quick-toggle-btn ${app.committeeStatus === 'Rejected' ? 'active-rejected' : ''}"
                  onclick="window.RallyApp.toggleCommitteeInterview('${app.id}', 'Rejected')"
                  title="Mark Committee Interview as Rejected"
                >✕ Reject</button>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">
                ${app.committeeNotes ? `📝 ${app.committeeNotes.substring(0, 32)}...` : "No notes yet"}
              </div>
            </div>
          </td>
          <!-- HR Interview Column -->
          <td>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="quick-toggle-group">
                <button
                  class="quick-toggle-btn ${app.hrStatus === 'Accepted' ? 'active-accepted' : ''}"
                  onclick="window.RallyApp.toggleHRInterview('${app.id}', 'Accepted')"
                  title="Mark HR Interview as Accepted"
                >✓ Accept</button>
                <button
                  class="quick-toggle-btn ${app.hrStatus === 'Pending' ? 'active-pending' : ''}"
                  onclick="window.RallyApp.toggleHRInterview('${app.id}', 'Pending')"
                  title="Mark HR Interview as Pending"
                >⏳ Pending</button>
                <button
                  class="quick-toggle-btn ${app.hrStatus === 'Rejected' ? 'active-rejected' : ''}"
                  onclick="window.RallyApp.toggleHRInterview('${app.id}', 'Rejected')"
                  title="Mark HR Interview as Rejected"
                >✕ Reject</button>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">
                ${app.hrNotes ? `📝 ${app.hrNotes.substring(0, 32)}...` : "No notes yet"}
              </div>
            </div>
          </td>
          <!-- Overall Admission Status -->
          <td>
            <span class="status-badge ${finalBadgeClass}">
              ${app.finalStatus}
            </span>
          </td>
          <!-- Actions -->
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button
                class="btn btn-secondary btn-sm"
                onclick="window.RallyApp.openEvaluationModal('${app.id}')"
                title="Full Evaluation & Notes"
              >
                ✏️ Evaluate
              </button>
              <button
                class="btn btn-outline-danger btn-sm"
                onclick="window.RallyApp.deleteApplicant('${app.id}')"
                title="Remove Candidate"
              >
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    updateStats();
  }

  // Quick Toggle Committee Interview Status
  function toggleCommitteeInterview(applicantId, newStatus) {
    const item = state.applicants.find(a => a.id === applicantId);
    if (!item) return;

    item.committeeStatus = newStatus;
    item.finalStatus = deriveAdmissionStatus(item.committeeStatus, item.hrStatus);
    item.updatedBy = state.user.name;
    saveApplicants();
    renderTable();
    showToast(`Updated ${item.fullName.split(' ')[0]}'s Committee status to "${newStatus}"`);
  }

  // Quick Toggle HR Interview Status
  function toggleHRInterview(applicantId, newStatus) {
    const item = state.applicants.find(a => a.id === applicantId);
    if (!item) return;

    item.hrStatus = newStatus;
    item.finalStatus = deriveAdmissionStatus(item.committeeStatus, item.hrStatus);
    item.updatedBy = state.user.name;
    saveApplicants();
    renderTable();
    showToast(`Updated ${item.fullName.split(' ')[0]}'s HR status to "${newStatus}"`);
  }

  // Add new applicant to sheet (all fields are completely optional)
  function addNewApplicant(formData) {
    formData = formData || {};
    const newId = `RACU-2627-${String(state.applicants.length + 1).padStart(3, "0")}`;
    const rawName = (formData.fullName || "").trim();
    const cleanName = rawName || `Candidate ${newId}`;
    const cleanEmail = (formData.email || "").trim() || "—";
    const cleanPhone = (formData.phone || "").trim() || "—";
    const cleanFaculty = (formData.faculty || "").trim() || "General / ACU";
    const cleanYear = (formData.academicYear || "").trim() || "—";
    const userAllowed = state.user && state.user.allowedCommittees ? state.user.allowedCommittees : (state.user && state.user.committee ? [state.user.committee] : ["General"]);
    let cleanFirstChoice = (formData.firstChoice || "").trim();
    if (!userAllowed.includes(cleanFirstChoice)) {
      cleanFirstChoice = userAllowed[0];
    }
    const cleanSecondChoice = (formData.secondChoice || "").trim() || "—";

    const newApp = {
      id: newId,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      faculty: cleanFaculty,
      academicYear: cleanYear,
      firstChoice: cleanFirstChoice,
      secondChoice: cleanSecondChoice,
      submissionDate: new Date().toISOString().split("T")[0],
      committeeStatus: formData.committeeStatus || "Pending",
      committeeNotes: (formData.committeeNotes || "").trim(),
      committeeScore: formData.committeeScore ? parseInt(formData.committeeScore) : null,
      hrStatus: formData.hrStatus || "Pending",
      hrNotes: (formData.hrNotes || "").trim(),
      hrScore: formData.hrScore ? parseInt(formData.hrScore) : null,
      finalStatus: deriveAdmissionStatus(formData.committeeStatus || "Pending", formData.hrStatus || "Pending"),
      updatedBy: (state.user && state.user.name) || "Interviewer"
    };

    state.applicants.unshift(newApp);
    saveApplicants();
    renderTable();
    showToast(`Added: ${newApp.fullName} to the sheet!`);
  }

  // Delete applicant
  function deleteApplicant(applicantId) {
    const item = state.applicants.find(a => a.id === applicantId);
    if (!item) return;
    if (confirm(`Are you sure you want to remove "${item.fullName}" from the admission sheet?`)) {
      state.applicants = state.applicants.filter(a => a.id !== applicantId);
      saveApplicants();
      renderTable();
      showToast(`Removed candidate from sheet.`);
    }
  }

  // Open Full Evaluation Modal
  function openEvaluationModal(applicantId) {
    const item = state.applicants.find(a => a.id === applicantId);
    if (!item) return;
    state.evaluatingApplicantId = applicantId;

    const modal = document.getElementById("eval-modal");
    if (!modal) return;

    document.getElementById("eval-candidate-name").textContent = item.fullName;
    document.getElementById("eval-candidate-info").textContent = `${item.id} • ${item.faculty} (${item.academicYear}) • First Choice: ${item.firstChoice}`;

    // Fill form
    document.getElementById("eval-comm-status").value = item.committeeStatus;
    document.getElementById("eval-comm-score").value = item.committeeScore || "";
    document.getElementById("eval-comm-notes").value = item.committeeNotes || "";

    document.getElementById("eval-hr-status").value = item.hrStatus;
    document.getElementById("eval-hr-score").value = item.hrScore || "";
    document.getElementById("eval-hr-notes").value = item.hrNotes || "";

    // Set Committee label dynamically (e.g. Media Interview vs Entrepreneur Interview)
    document.getElementById("eval-comm-heading").textContent = `${item.firstChoice} Interview`;

    modal.classList.add("active");
  }

  function closeEvaluationModal() {
    const modal = document.getElementById("eval-modal");
    if (modal) modal.classList.remove("active");
    state.evaluatingApplicantId = null;
  }

  function saveEvaluationModal() {
    if (!state.evaluatingApplicantId) return;
    const item = state.applicants.find(a => a.id === state.evaluatingApplicantId);
    if (!item) return;

    item.committeeStatus = document.getElementById("eval-comm-status").value;
    item.committeeScore = document.getElementById("eval-comm-score").value ? parseInt(document.getElementById("eval-comm-score").value) : null;
    item.committeeNotes = document.getElementById("eval-comm-notes").value.trim();

    item.hrStatus = document.getElementById("eval-hr-status").value;
    item.hrScore = document.getElementById("eval-hr-score").value ? parseInt(document.getElementById("eval-hr-score").value) : null;
    item.hrNotes = document.getElementById("eval-hr-notes").value.trim();

    item.finalStatus = deriveAdmissionStatus(item.committeeStatus, item.hrStatus);
    item.updatedBy = state.user.name;

    saveApplicants();
    renderTable();
    closeEvaluationModal();
    showToast(`Evaluation saved for ${item.fullName}!`);
  }

  // Export to CSV
  function exportToCSV() {
    const list = getFilteredApplicants();
    if (!list.length) {
      showToast("No records to export.", false);
      return;
    }

    const headers = [
      "Candidate ID",
      "Full Name",
      "Email",
      "Phone",
      "Faculty",
      "Academic Year",
      "1st Choice Committee",
      "2nd Choice Committee",
      "Submission Date",
      "Committee Interview Status",
      "Committee Score (1-10)",
      "Committee Notes",
      "HR Interview Status",
      "HR Score (1-10)",
      "HR Notes",
      "Final Admission Status",
      "Last Evaluated By"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map(a => [
      escapeCsv(a.id),
      escapeCsv(a.fullName),
      escapeCsv(a.email),
      escapeCsv(a.phone),
      escapeCsv(a.faculty),
      escapeCsv(a.academicYear),
      escapeCsv(a.firstChoice),
      escapeCsv(a.secondChoice),
      escapeCsv(a.submissionDate),
      escapeCsv(a.committeeStatus),
      escapeCsv(a.committeeScore),
      escapeCsv(a.committeeNotes),
      escapeCsv(a.hrStatus),
      escapeCsv(a.hrScore),
      escapeCsv(a.hrNotes),
      escapeCsv(a.finalStatus),
      escapeCsv(a.updatedBy)
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Rally_ACU_Interviews_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Exported successfully!");
  }

  // Backup data to JSON
  function backupData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.applicants, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `rally_acu_sheet_backup_${new Date().toISOString().split("T")[0]}.json`);
    dlAnchorElem.click();
    showToast("Data backup saved!");
  }

  // Setup UI for authenticated user
  function initUserDashboard(user) {
    state.user = user;
    user.allowedCommittees = user.allowedCommittees || [user.committee];
    state.selectedCommittee = "ALL";
    loadApplicants();

    // Populate user details in UI
    document.getElementById("user-display-name").textContent = user.name;
    document.getElementById("user-display-role").textContent = user.role;
    document.getElementById("user-avatar-initials").textContent = user.name.split(" ").map(n => n[0]).join("").substring(0, 2);
    document.getElementById("welcome-user-name").textContent = user.name;
    document.getElementById("welcome-user-committee").textContent = user.committee;

    const lockedBadgeWrap = document.getElementById("locked-committee-badge-wrap");
    const multiCommSelect = document.getElementById("filter-multi-committee");
    const headerCommLabel = document.getElementById("header-comm-label");

    if (user.allowedCommittees.length > 1) {
      // Multi-committee user (e.g. Bahr: Media + Entrepreneur)
      if (lockedBadgeWrap) lockedBadgeWrap.style.display = "none";
      if (multiCommSelect) {
        multiCommSelect.style.display = "inline-block";
        multiCommSelect.innerHTML = `
          <option value="ALL">All Committees (${user.allowedCommittees.join(" + ")})</option>
          ${user.allowedCommittees.map(c => `<option value="${c}">${c} Only</option>`).join("")}
        `;
        multiCommSelect.onchange = (e) => {
          state.selectedCommittee = e.target.value;
          if (headerCommLabel) {
            headerCommLabel.textContent = state.selectedCommittee === "ALL" ? "Committee Interview" : `${state.selectedCommittee} Interview`;
          }
          renderTable();
        };
      }

      if (headerCommLabel) {
        headerCommLabel.textContent = "Committee Interview";
      }

      // Add Modal: allow selecting among permitted committees
      const addField = document.getElementById("add-firstChoice");
      if (addField) {
        const parent = addField.parentElement;
        parent.innerHTML = `
          <select id="add-firstChoice" class="form-control">
            ${user.allowedCommittees.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        `;
      }
    } else {
      // Single-committee user
      if (lockedBadgeWrap) {
        lockedBadgeWrap.style.display = "inline-flex";
        const badge = document.getElementById("locked-committee-badge");
        if (badge) badge.textContent = user.allowedCommittees[0];
      }
      if (multiCommSelect) multiCommSelect.style.display = "none";
      if (headerCommLabel) {
        headerCommLabel.textContent = `${user.allowedCommittees[0]} Interview`;
      }

      const addField = document.getElementById("add-firstChoice");
      if (addField) {
        addField.value = user.allowedCommittees[0];
      }
    }

    renderTable();
  }

  // Expose methods to global scope
  window.RallyApp = {
    initDashboard: initUserDashboard,
    toggleCommitteeInterview,
    toggleHRInterview,
    addNewApplicant,
    deleteApplicant,
    openEvaluationModal,
    closeEvaluationModal,
    saveEvaluationModal,
    exportToCSV,
    backupData,

    // Filter handlers
    setSearchQuery: function (query) {
      state.searchQuery = query;
      renderTable();
    },
    setCommitteeFilter: function (comm) {
      state.selectedCommittee = comm;
      renderTable();
    },
    setStatusFilter: function (status) {
      state.selectedStatus = status;
      renderTable();
    }
  };
})();

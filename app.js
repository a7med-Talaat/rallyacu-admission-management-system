/**
 * RALLY ACU - ADMISSIONS & INTERVIEW SHEET LOGIC
 * Manages applicants, interview evaluations (Committee & HR),
 * admission progress, filtering, CSV export, and REAL-TIME CLOUD DATABASE PERSISTENCE.
 */

(function () {
  const ALL_COMMITTEES = [
    "Media",
    "Entrepreneur",
    "Operation",
    "Business Development",
    "Talent Management"
  ];

  const MASTER_STORAGE_KEY = "rally_applicants_v2";

  // ═══════════════════════════════════════════════════════════
  //  FIREBASE REALTIME DATABASE  (replaces broken restful-api)
  //  Real-time, free, works globally 24/7
  // ═══════════════════════════════════════════════════════════
  const FIREBASE_URL = "https://rally-acu-default-rtdb.firebaseio.com/candidates.json";

  let isSyncing = false;
  let syncIntervalTimer = null;

  // Dedicated Database Table Key per Committee (Local Cache)
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

  // Get local cache
  function getAllApplicantsFromStorage() {
    const raw = localStorage.getItem(MASTER_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return [];
      }
    }
    // Backward compatibility: collect from all committee DB keys if master not yet created
    let legacy = [];
    ALL_COMMITTEES.forEach(c => {
      const recs = loadCommitteeDb(c);
      legacy = legacy.concat(recs);
    });
    // Deduplicate by ID
    const unique = [];
    const ids = new Set();
    for (const item of legacy) {
      if (item && item.id && !ids.has(item.id)) {
        ids.add(item.id);
        unique.push(item);
      }
    }
    return unique;
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

  // Header cloud sync indicator helper
  function updateSyncIndicator(status, text) {
    const iconEl = document.getElementById("cloud-sync-icon");
    const textEl = document.getElementById("cloud-sync-text");
    if (!textEl) return;
    textEl.textContent = text;
    if (iconEl) {
      if (status === "syncing") {
        iconEl.textContent = "⏳";
        iconEl.classList.add("syncing-spinner");
      } else if (status === "success") {
        iconEl.textContent = "🟢";
        iconEl.classList.remove("syncing-spinner");
      } else if (status === "error") {
        iconEl.textContent = "⚠️";
        iconEl.classList.remove("syncing-spinner");
      }
    }
  }

  // Save to local cache only
  function saveLocalOnly(list) {
    localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(list || []));

    // Also sync to per-committee tables for local caching
    ALL_COMMITTEES.forEach(comm => {
      const commItems = (list || []).filter(a =>
        a.firstChoice === comm ||
        a.interviewCommittee === comm ||
        a.secondChoice === comm ||
        a.addedByCommittee === comm
      );
      saveCommitteeDb(comm, commItems);
    });
  }

  // ─── FIREBASE: Push all applicants ───────────────────────────
  const FIREBASE_DELETED_URL = "https://rally-acu-default-rtdb.firebaseio.com/deleted.json";

  // Record a deleted ID with a timestamp in Firebase
  async function recordDeletion(applicantId) {
    try {
      const safeKey = applicantId.replace(/[.$#\[\]/]/g, "_");
      await fetch(FIREBASE_DELETED_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [safeKey]: Date.now() })
      });
    } catch (e) {
      console.warn("Deletion record error:", e);
    }
  }

  // Remove an ID from the deleted tombstone table (e.g. if newly added)
  async function clearDeletionTombstone(applicantId) {
    try {
      const safeKey = applicantId.replace(/[.$#\[\]/]/g, "_");
      await fetch(`https://rally-acu-default-rtdb.firebaseio.com/deleted/${safeKey}.json`, {
        method: "DELETE"
      });
    } catch (e) {
      // ignore
    }
  }

  async function pushToCloud(applicantsList) {
    try {
      updateSyncIndicator("syncing", "Saving to Firebase...");

      // Firebase stores as object keyed by candidate id
      const firebasePayload = {};
      (applicantsList || []).forEach(a => {
        if (a && a.id) {
          // Firebase keys cannot contain . $ # [ ] /
          const safeKey = a.id.replace(/[.$#\[\]/]/g, "_");
          firebasePayload[safeKey] = a;
        }
      });

      const resp = await fetch(FIREBASE_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(firebasePayload)
      });

      if (resp.ok) {
        updateSyncIndicator("success", `Live ✓ (${(applicantsList || []).length})`);
      } else {
        console.warn("Firebase save HTTP status:", resp.status);
        updateSyncIndicator("error", "Sync Pending");
      }
    } catch (e) {
      console.warn("Firebase push error:", e);
      updateSyncIndicator("error", "Sync Pending");
    }
  }

  // ─── FIREBASE: Fetch + merge, respect deletions ───────────────
  async function syncWithCloud(silent = false) {
    if (isSyncing) return;
    isSyncing = true;
    if (!silent) updateSyncIndicator("syncing", "Syncing...");

    try {
      // Fetch candidates AND deleted tombstones in parallel
      const [candResp, delResp] = await Promise.all([
        fetch(FIREBASE_URL, { headers: { "Accept": "application/json" } }),
        fetch(FIREBASE_DELETED_URL, { headers: { "Accept": "application/json" } })
      ]);

      if (!candResp.ok) throw new Error("Firebase fetch HTTP " + candResp.status);

      const firebaseData = await candResp.json();
      const deletedData = delResp.ok ? await delResp.json() : null;

      // Build map of deleted IDs to their deletion timestamps
      const deletedMap = new Map();
      if (deletedData && typeof deletedData === "object") {
        Object.entries(deletedData).forEach(([k, val]) => {
          const time = typeof val === "number" ? val : Infinity;
          deletedMap.set(k, time);
          deletedMap.set(k.replace(/_/g, "-"), time);
        });
      }

      function isCandidateDeleted(item) {
        if (!item || !item.id) return false;
        const key1 = item.id;
        const key2 = item.id.replace(/[.$#\[\]/]/g, "_");
        const delTime = deletedMap.has(key1) ? deletedMap.get(key1) : (deletedMap.has(key2) ? deletedMap.get(key2) : null);
        if (delTime === null) return false;

        // If candidate was created/updated AFTER the deletion timestamp, it's newly added!
        const itemTime = new Date(item.updatedAt || item.submissionDate || 0).getTime();
        if (itemTime > delTime) {
          clearDeletionTombstone(item.id);
          return false;
        }
        return true;
      }

      // Firebase candidates minus any deleted ones
      const cloudApplicants = firebaseData
        ? Object.values(firebaseData).filter(a => a && a.id && !isCandidateDeleted(a))
        : [];

      const localList = state.applicants && state.applicants.length > 0
        ? state.applicants
        : getAllApplicantsFromStorage();

      const map = new Map();
      let hasLocalUnsaved = false;

      // 1. Firebase is source of truth
      cloudApplicants.forEach(app => {
        if (app && app.id) map.set(app.id, app);
      });

      // 2. Merge local — skip anything deleted remotely, newer timestamp wins
      localList.forEach(localApp => {
        if (!localApp || !localApp.id) return;
        if (isCandidateDeleted(localApp)) return;

        if (!map.has(localApp.id)) {
          map.set(localApp.id, localApp);
          hasLocalUnsaved = true;
        } else {
          const cloudItem = map.get(localApp.id);
          const localTime = new Date(localApp.updatedAt || localApp.submissionDate || 0).getTime();
          const cloudTime = new Date(cloudItem.updatedAt || cloudItem.submissionDate || 0).getTime();
          if (localTime > cloudTime) {
            map.set(localApp.id, localApp);
            hasLocalUnsaved = true;
          }
        }
      });

      const merged = Array.from(map.values());
      merged.sort((a, b) => (b.id || "").localeCompare(a.id || ""));

      state.applicants = merged;
      saveLocalOnly(merged);
      renderTable();

      if (hasLocalUnsaved) {
        await pushToCloud(merged);
      }

      updateSyncIndicator("success", `Live ✓ (${merged.length})`);
      if (!silent) {
        showToast(`Synced: ${merged.length} candidates in database`);
      }
    } catch (err) {
      console.warn("Firebase sync warning:", err);
      updateSyncIndicator("error", "Offline Mode");
    } finally {
      isSyncing = false;
    }
  }

  // Save applicants — saves locally AND pushes to Firebase
  function saveApplicants() {
    saveLocalOnly(state.applicants);
    pushToCloud(state.applicants);
  }

  // Load applicants from cache first, then cloud
  function loadApplicants() {
    localStorage.removeItem("rally_acu_interview_sheet_data_v1");
    state.applicants = getAllApplicantsFromStorage();
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

  // Render Stats Cards for logged-in user's view
  function updateStats() {
    const list = getFilteredApplicants();
    const total = list.length;
    const commAcc = list.filter(a => a.committeeStatus === "Accepted").length;
    const hrAcc = list.filter(a => a.hrStatus === "Accepted").length;
    const fullyAcc = list.filter(a => a.finalStatus.includes("Fully Accepted") || a.finalStatus.includes("Fully")).length;
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

  // Filter applicants - scoped to user's allowed committees, search query & filters
  function getFilteredApplicants() {
    const q = state.searchQuery.trim().toLowerCase();
    const userAllowed = state.user && state.user.allowedCommittees ? state.user.allowedCommittees : (state.user && state.user.committee ? [state.user.committee] : []);
    const isPresident = state.user && (state.user.isAdmin || userAllowed.length >= 5);

    return state.applicants.filter(app => {
      // Access Control:
      // President sees all.
      // Other users see applicants where:
      // - The candidate's assigned committee (firstChoice) is in userAllowed
      // - OR candidate is being interviewed in a committee in userAllowed (interviewCommittee)
      // - OR candidate's secondary choice is in userAllowed
      // - OR candidate was added by this committee or this user
      if (!isPresident && userAllowed.length > 0) {
        const canView =
          userAllowed.includes(app.firstChoice) ||
          userAllowed.includes(app.interviewCommittee) ||
          userAllowed.includes(app.secondChoice) ||
          (app.addedByCommittee && userAllowed.includes(app.addedByCommittee)) ||
          (app.addedBy && app.addedBy === state.user.name);

        if (!canView) return false;
      }

      // Committee filter dropdown (if user toggled specific committee)
      if (state.selectedCommittee !== "ALL") {
        const matchesComm =
          app.firstChoice === state.selectedCommittee ||
          app.interviewCommittee === state.selectedCommittee;
        if (!matchesComm) return false;
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
          (app.firstChoice && app.firstChoice.toLowerCase().includes(q)) ||
          (app.interviewCommittee && app.interviewCommittee.toLowerCase().includes(q)) ||
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

    if (list.length === 0) {
      const isSearching = !!state.searchQuery || state.selectedStatus !== "ALL";
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2.4rem; margin-bottom: 0.6rem;">${isSearching ? "🔍" : "📋"}</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">${isSearching ? "No applicants match your search" : "No candidates in this committee sheet yet"}</div>
            <div style="font-size: 0.85rem; margin-top: 6px; color: var(--text-secondary);">${isSearching ? "Try adjusting your search query or status filter." : "Click the <strong>'+ Add Candidate'</strong> button above to start entering applicants."}</div>
          </td>
        </tr>
      `;
      updateStats();
      return;
    }

    tbody.innerHTML = list.map((app) => {
      const finalBadgeClass = app.finalStatus.includes("Fully")
        ? "accepted"
        : app.finalStatus === "Rejected"
        ? "rejected"
        : "pending";

      const commDisplayName = app.interviewCommittee || app.firstChoice || "Committee";

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
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div>
                <span class="status-badge" style="background: rgba(244,63,94,0.12); color: var(--red); border: 1px solid rgba(244,63,94,0.25); font-weight: 700;">
                  🎯 ${app.firstChoice || 'General'}
                </span>
              </div>
              ${app.interviewCommittee && app.interviewCommittee !== app.firstChoice ? `
                <div style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                  <span>🎙️ In:</span>
                  <span style="background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.25); padding: 1px 6px; border-radius: 4px;">${app.interviewCommittee}</span>
                </div>
              ` : ''}
              ${app.secondChoice && app.secondChoice !== '—' && app.secondChoice !== '' ? `
                <div style="font-size: 0.72rem; color: var(--text-muted);">2nd: ${app.secondChoice}</div>
              ` : ''}
            </div>
          </td>
          <!-- Committee Interview Column -->
          <td>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                ${commDisplayName} Technical
              </div>
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
    item.updatedAt = new Date().toISOString();
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
    item.updatedAt = new Date().toISOString();
    saveApplicants();
    renderTable();
    showToast(`Updated ${item.fullName.split(' ')[0]}'s HR status to "${newStatus}"`);
  }

  // Add new applicant to sheet (all fields are completely optional & customizable)
  function addNewApplicant(formData) {
    formData = formData || {};
    
    // Find next safe unique ID
    let maxNum = 0;
    state.applicants.forEach(a => {
      const match = a.id && a.id.match(/RACU-2627-(\d+)/);
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxNum) maxNum = n;
      }
    });
    // Monotonic local counter so we never collide with recently deleted IDs
    let localCounter = parseInt(localStorage.getItem("rally_last_candidate_num") || "0");
    if (localCounter > maxNum) maxNum = localCounter;
    const nextNum = maxNum + 1;
    localStorage.setItem("rally_last_candidate_num", String(nextNum));

    const newId = `RACU-2627-${String(nextNum).padStart(3, "0")}`;
    clearDeletionTombstone(newId);

    const rawName = (formData.fullName || "").trim();
    const cleanName = rawName || `Candidate ${newId}`;
    const cleanEmail = (formData.email || "").trim() || "—";
    const cleanPhone = (formData.phone || "").trim() || "—";
    const cleanFaculty = (formData.faculty || "").trim() || "General / ACU";
    const cleanYear = (formData.academicYear || "").trim() || "—";

    const userDefaultComm = (state.user && state.user.allowedCommittees && state.user.allowedCommittees[0]) || (state.user && state.user.committee) || "Media";
    // Allow user to freely choose ANY committee for assigned and interview
    const cleanFirstChoice = (formData.firstChoice || "").trim() || userDefaultComm;
    const cleanInterviewCommittee = (formData.interviewCommittee || "").trim() || userDefaultComm;
    const cleanSecondChoice = (formData.secondChoice || "").trim() || "—";

    const newApp = {
      id: newId,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      faculty: cleanFaculty,
      academicYear: cleanYear,
      firstChoice: cleanFirstChoice,
      interviewCommittee: cleanInterviewCommittee,
      secondChoice: cleanSecondChoice,
      addedByCommittee: userDefaultComm,
      addedBy: (state.user && state.user.name) || "Interviewer",
      submissionDate: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString(),
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
    showToast(`Added: ${newApp.fullName} (Assigned: ${newApp.firstChoice} · Interview: ${newApp.interviewCommittee})`);
  }

  // Delete applicant
  function deleteApplicant(applicantId) {
    const item = state.applicants.find(a => a.id === applicantId);
    if (!item) return;
    if (confirm(`Are you sure you want to remove "${item.fullName}" from the admission sheet?`)) {
      state.applicants = state.applicants.filter(a => a.id !== applicantId);
      saveLocalOnly(state.applicants);
      renderTable();
      showToast(`"${item.fullName}" removed from all accounts.`);
      // Record deletion in Firebase so ALL users lose this candidate immediately
      recordDeletion(applicantId).then(() => {
        pushToCloud(state.applicants);
      });
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
    document.getElementById("eval-candidate-info").textContent = `${item.id} • ${item.faculty} (${item.academicYear}) • Assigned: ${item.firstChoice}`;

    const evalFirst = document.getElementById("eval-firstChoice");
    if (evalFirst) evalFirst.value = item.firstChoice || "Media";

    const evalInterview = document.getElementById("eval-interviewCommittee");
    if (evalInterview) evalInterview.value = item.interviewCommittee || item.firstChoice || "Media";

    // Fill form
    document.getElementById("eval-comm-status").value = item.committeeStatus;
    document.getElementById("eval-comm-score").value = item.committeeScore || "";
    document.getElementById("eval-comm-notes").value = item.committeeNotes || "";

    document.getElementById("eval-hr-status").value = item.hrStatus;
    document.getElementById("eval-hr-score").value = item.hrScore || "";
    document.getElementById("eval-hr-notes").value = item.hrNotes || "";

    // Set Committee label dynamically
    const commLabel = item.interviewCommittee || item.firstChoice || "Committee";
    document.getElementById("eval-comm-heading").textContent = `${commLabel} Interview`;

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

    const evalFirst = document.getElementById("eval-firstChoice");
    if (evalFirst) item.firstChoice = evalFirst.value;

    const evalInterview = document.getElementById("eval-interviewCommittee");
    if (evalInterview) item.interviewCommittee = evalInterview.value;

    item.committeeStatus = document.getElementById("eval-comm-status").value;
    item.committeeScore = document.getElementById("eval-comm-score").value ? parseInt(document.getElementById("eval-comm-score").value) : null;
    item.committeeNotes = document.getElementById("eval-comm-notes").value.trim();

    item.hrStatus = document.getElementById("eval-hr-status").value;
    item.hrScore = document.getElementById("eval-hr-score").value ? parseInt(document.getElementById("eval-hr-score").value) : null;
    item.hrNotes = document.getElementById("eval-hr-notes").value.trim();

    item.finalStatus = deriveAdmissionStatus(item.committeeStatus, item.hrStatus);
    item.updatedBy = state.user.name;
    item.updatedAt = new Date().toISOString();

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
      "Assigned Committee",
      "Interviewing In",
      "Secondary Choice",
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
      escapeCsv(a.interviewCommittee || a.firstChoice),
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

    // 1. Immediately load local cache (0ms instant render)
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
    } else {
      if (lockedBadgeWrap) {
        lockedBadgeWrap.style.display = "inline-flex";
        const badge = document.getElementById("locked-committee-badge");
        if (badge) badge.textContent = user.allowedCommittees[0];
      }
      if (multiCommSelect) multiCommSelect.style.display = "none";
      if (headerCommLabel) {
        headerCommLabel.textContent = `${user.allowedCommittees[0]} Interview`;
      }
    }

    // Set initial defaults for Add Candidate modal WITHOUT restricting options
    const addFirst = document.getElementById("add-firstChoice");
    if (addFirst && user.allowedCommittees && user.allowedCommittees[0]) {
      addFirst.value = user.allowedCommittees[0];
    }
    const addInterview = document.getElementById("add-interviewCommittee");
    if (addInterview && user.allowedCommittees && user.allowedCommittees[0]) {
      addInterview.value = user.allowedCommittees[0];
    }

    renderTable();

    // 2. Fetch live data from Firebase and merge immediately
    syncWithCloud(true);

    // 3. Auto-sync with Firebase every 10 seconds, 24/7
    if (syncIntervalTimer) clearInterval(syncIntervalTimer);
    syncIntervalTimer = setInterval(() => {
      if (!document.hidden) {
        syncWithCloud(true);
      }
    }, 10000);
  }

  // Expose methods to global scope
  window.RallyApp = {
    initDashboard: initUserDashboard,
    syncCloud: function () {
      syncWithCloud(false);
    },
    getCurrentUserCommittee: function () {
      if (!state.user) return "Media";
      if (state.selectedCommittee && state.selectedCommittee !== "ALL") return state.selectedCommittee;
      return (state.user.allowedCommittees && state.user.allowedCommittees[0]) || state.user.committee || "Media";
    },
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

/**
 * RALLY ACU - AUTHENTICATION ENGINE
 * Season 2026-2027
 * Fixed credential store — all accounts work reliably.
 */

(function () {

  // All accounts: emails are matched case-insensitively, passwords exactly as-is
  // Passwords "rally 2627acu" and "rally2627acu" are both accepted where noted.
  const USERS = [
    // ── PRESIDENT ──────────────────────────────────────────────
    {
      id: "pres_malak",
      name: "Malak Hussein",
      email: "presidentmalakhusseinrally@acu.com",
      passwords: ["rallypresident2627acu"],
      committee: "All Committees",
      allowedCommittees: ["Media", "Entrepreneur", "Operation", "Business Development", "Talent Management"],
      role: "President of Rally ACU",
      badge: "President",
      isAdmin: true
    },

    // ── MEDIA ───────────────────────────────────────────────────
    {
      id: "head_media",
      name: "Ahmed Talaat",
      email: "ahmedtalaatrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Media",
      allowedCommittees: ["Media"],
      role: "Head of Media",
      badge: "Media Lead",
      isAdmin: false
    },
    {
      id: "media_bassant",
      name: "Bassant Kamal",
      email: "bassantkamalrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Media",
      allowedCommittees: ["Media"],
      role: "Media Lead",
      badge: "Media Lead",
      isAdmin: false
    },
    {
      id: "media_roaa",
      name: "Roaa Hatem",
      email: "roaahatemrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Media",
      allowedCommittees: ["Media"],
      role: "Media Lead",
      badge: "Media Lead",
      isAdmin: false
    },

    // ── ENTREPRENEUR ────────────────────────────────────────────
    {
      id: "head_entrepreneur",
      name: "Mohamed Khaled",
      email: "mohamedkhaledrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Entrepreneur",
      allowedCommittees: ["Entrepreneur"],
      role: "Head of Entrepreneur",
      badge: "Entrepreneur Lead",
      isAdmin: false
    },
    {
      id: "entre_alaa",
      name: "Alaa",
      email: "alaaentrerally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Entrepreneur",
      allowedCommittees: ["Entrepreneur"],
      role: "Entrepreneur Lead",
      badge: "Entrepreneur Lead",
      isAdmin: false
    },

    // ── OPERATION ───────────────────────────────────────────────
    {
      id: "head_operation",
      name: "Arwa Ahmed",
      email: "arwaahmedrally@acu.com",
      passwords: ["rally2627acu", "rally 2627acu"],
      committee: "Operation",
      allowedCommittees: ["Operation"],
      role: "Head of Operation",
      badge: "Operation Lead",
      isAdmin: false
    },

    // ── OPERATION + TALENT MANAGEMENT (DUAL) ────────────────────
    {
      id: "lead_bahr",
      name: "Bahr",
      email: "bahrrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Operation & Talent Management",
      allowedCommittees: ["Operation", "Talent Management"],
      role: "HR Operation Lead",
      badge: "Operation + HR",
      isAdmin: false
    },

    // ── TALENT MANAGEMENT ───────────────────────────────────────
    {
      id: "head_tm",
      name: "Mariam Ahmed",
      email: "mariamahmedrally@acu.com",
      passwords: ["rally2627acu", "rally 2627acu"],
      committee: "Talent Management",
      allowedCommittees: ["Talent Management"],
      role: "Head of Talent Management",
      badge: "Talent Management Lead",
      isAdmin: false
    },
    {
      id: "tm_boda",
      name: "Boda",
      email: "bodatalentrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Talent Management",
      allowedCommittees: ["Talent Management"],
      role: "Talent Management Lead",
      badge: "Talent Management Lead",
      isAdmin: false
    },
    {
      id: "tm_omar",
      name: "Omar",
      email: "omartalentrally@acu.com",
      passwords: ["rally2627acu"],
      committee: "Talent Management",
      allowedCommittees: ["Talent Management"],
      role: "Talent Management Lead",
      badge: "Talent Management Lead",
      isAdmin: false
    },

    // ── BUSINESS DEVELOPMENT ────────────────────────────────────
    {
      id: "head_bd",
      name: "Habiba",
      email: "habibaaarally@acu.com",
      passwords: ["rally2627acu", "rally 2627acu"],
      committee: "Business Development",
      allowedCommittees: ["Business Development"],
      role: "Head of Business Development",
      badge: "BD Lead",
      isAdmin: false
    }
  ];

  window.RallyAuth = {

    getSession: function () {
      const stored = sessionStorage.getItem("rally_auth_session");
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    },

    authenticate: async function (emailInput, passwordInput) {
      if (!emailInput || !passwordInput) {
        return { success: false, error: "Please enter both email and password." };
      }

      const normEmail = emailInput.trim().toLowerCase();
      const enteredPass = passwordInput.trim();

      // Find user by email (case-insensitive)
      const user = USERS.find(u => u.email.toLowerCase() === normEmail);

      if (!user) {
        return { success: false, error: "Invalid email or credentials." };
      }

      // Check if entered password matches any accepted password
      const passMatch = user.passwords.some(p => p === enteredPass);

      if (!passMatch) {
        return { success: false, error: "Incorrect password. Please try again." };
      }

      const profile = {
        id: user.id,
        name: user.name,
        email: emailInput.trim(),
        committee: user.committee,
        allowedCommittees: user.allowedCommittees,
        role: user.role,
        badge: user.badge,
        isAdmin: user.isAdmin,
        loginTime: new Date().toISOString()
      };

      sessionStorage.setItem("rally_auth_session", JSON.stringify(profile));
      return { success: true, profile };
    },

    logout: function () {
      sessionStorage.removeItem("rally_auth_session");
      window.location.reload();
    }
  };

})();

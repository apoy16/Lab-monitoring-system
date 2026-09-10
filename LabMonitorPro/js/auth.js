/* ============================================================
   LabMonitor Pro — auth.js
   Login multi-role, session storage, anti-paste security,
   dan toggle tombol login/logout.
   ============================================================ */

const Auth = (() => {

  const SESSION_KEY = "labmonitor_pro_session";

  const DEMO_USERS = {
    admin: { username: "admin", password: "admin123", role: "admin", label: "Super Admin", lab: "Semua Lab" },
    operator: { username: "operator", password: "operator123", role: "operator", label: "Operator Lab", lab: "Lab 1 - GS Lt 2" }
  };

  let selectedRole = "admin";

  function getSession(){
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSession(session){
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession(){
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isAuthenticated(){
    return !!getSession();
  }

  function currentRole(){
    const s = getSession();
    return s ? s.role : "guest";
  }

  function isAdmin(){
    return currentRole() === "admin";
  }

  /** Menerapkan class role pada <body> yang mengendalikan visibilitas .admin-only lewat CSS */
  function applyRoleToDom(){
    const body = document.body;
    body.classList.remove("role-admin", "role-operator", "role-guest");
    const role = currentRole();
    body.classList.add(role === "admin" ? "role-admin" : role === "operator" ? "role-operator" : "role-guest");

    // Nonaktifkan (bukan hanya sembunyikan) tombol admin-only agar aman dari akses via devtools ringan
    document.querySelectorAll(".admin-only").forEach((el) => {
      const allow = role === "admin";
      if (el.tagName === "BUTTON" || el.tagName === "INPUT"){
        el.disabled = !allow;
      }
    });

    updateTopbar();
  }

  function updateTopbar(){
    const badge = document.getElementById("sessionBadge");
    const badgeText = document.getElementById("sessionBadgeText");
    const authBtn = document.getElementById("btnAuthToggle");
    const session = getSession();

    badge.classList.remove("is-admin", "is-operator");

    if (session){
      badge.classList.add(session.role === "admin" ? "is-admin" : "is-operator");
      badgeText.textContent = `${session.label} · ${session.lab}`;
      authBtn.textContent = "Logout";
      authBtn.classList.add("is-logout");
    } else {
      badgeText.textContent = "Guest Mode";
      authBtn.textContent = "Login";
      authBtn.classList.remove("is-logout");
    }
  }

  function showLoginOverlay(){
    document.getElementById("loginOverlay").classList.remove("is-hidden");
    document.getElementById("loginError").classList.remove("is-visible");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
  }

  function hideLoginOverlay(){
    document.getElementById("loginOverlay").classList.add("is-hidden");
  }

  function attemptLogin(username, password){
    const candidate = Object.values(DEMO_USERS).find(
      (u) => u.role === selectedRole && u.username === username && u.password === password
    );
    if (!candidate){
      const errEl = document.getElementById("loginError");
      errEl.textContent = "Username atau password salah untuk peran yang dipilih.";
      errEl.classList.add("is-visible");
      return false;
    }
    setSession({ role: candidate.role, label: candidate.label, lab: candidate.lab, username: candidate.username });
    applyRoleToDom();
    hideLoginOverlay();
    Toast.show(`Selamat datang, ${candidate.label}.`);
    return true;
  }

  function logout(){
    clearSession();
    applyRoleToDom();
    Toast.show("Sesi berhasil diakhiri.");
  }

  function enterGuestMode(){
    clearSession();
    applyRoleToDom();
    hideLoginOverlay();
  }

  const ROLE_HINT = {
    admin: { text: "Mode aktif: <strong>Super Admin</strong> — akses penuh ke seluruh fitur sistem.", role: "admin" },
    operator: { text: "Mode aktif: <strong>Operator Lab</strong> — akses terbatas pada lab yang ditugaskan.", role: "operator" }
  };

  function updateRoleHint(role){
    const hint = document.getElementById("loginRoleHint");
    if (!hint) return;
    hint.innerHTML = ROLE_HINT[role].text;
    document.getElementById("loginCard").dataset.role = role;
  }

  function init(){
    // Role switch buttons in login card
    document.getElementById("loginRoleSwitch").addEventListener("click", (e) => {
      const btn = e.target.closest(".role-btn");
      if (!btn) return;
      document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedRole = btn.dataset.role;
      updateRoleHint(selectedRole);
    });
    updateRoleHint(selectedRole);

    // Login form submit

    // Login form submit
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;
      attemptLogin(username, password);
    });

    // Guest mode
    document.getElementById("btnGuestMode").addEventListener("click", enterGuestMode);

    // Topbar auth toggle (Login / Logout)
    document.getElementById("btnAuthToggle").addEventListener("click", () => {
      if (isAuthenticated()){
        logout();
      } else {
        showLoginOverlay();
      }
    });

    // Restore existing session on load
    if (isAuthenticated()){
      hideLoginOverlay();
    } else {
      showLoginOverlay();
    }
    applyRoleToDom();
  }

  return { init, isAuthenticated, isAdmin, currentRole, getSession, applyRoleToDom, logout };
})();

/* ------------------------------------------------------------
   Toast helper — dipakai lintas modul (auth, modal, app)
   ------------------------------------------------------------ */
const Toast = (() => {
  function show(message, type = "success"){
    const stack = document.getElementById("toastStack");
    const el = document.createElement("div");
    el.className = `toast${type === "error" ? " is-error" : ""}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }
  return { show };
})();

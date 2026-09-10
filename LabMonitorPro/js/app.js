/* ============================================================
   LabMonitor Pro — app.js
   Inisialisasi aplikasi, routing/tab switcher, dan event listener utama.
   ============================================================ */

const PANE_META = {
  dashboard: { title: "Dashboard", subtitle: "Ringkasan kondisi laboratorium secara real-time" },
  floorplan: { title: "Denah Lab", subtitle: "Peta interaktif posisi &amp; status seluruh unit PC" },
  attendance: { title: "Presensi Mahasiswa", subtitle: "Rekaman kehadiran dari scan barcode presensi" },
  inventory: { title: "Inventaris Non-PC", subtitle: "Aset pendukung di luar unit komputer" }
};

const Router = (() => {
  function goTo(paneName){
    document.querySelectorAll(".nav-item[data-pane]").forEach((n) => n.classList.toggle("is-active", n.dataset.pane === paneName));
    document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("is-active", p.id === `pane-${paneName}`));

    const meta = PANE_META[paneName];
    document.getElementById("paneTitle").innerHTML = meta.title;
    document.getElementById("paneSubtitle").innerHTML = meta.subtitle;

    if (paneName === "dashboard") Dashboard.refresh();
    if (paneName === "attendance") AttendancePane.load();
    if (paneName === "inventory") InventoryPane.load();

    // close mobile sidebar after navigation
    document.querySelector(".sidebar").classList.remove("is-open");
  }

  function init(){
    document.querySelectorAll(".nav-item[data-pane]").forEach((btn) => {
      btn.addEventListener("click", () => goTo(btn.dataset.pane));
    });
  }

  return { init, goTo };
})();

/* ============================================================
   DASHBOARD
   ============================================================ */
const Dashboard = (() => {
  let chartInstance = null;

  function statusRow(labKey, labLabel, counts){
    const total = counts.total || 1;
    const seg = (n, color) => `<span style="width:${(n/total*100)}%; background:${color};"></span>`;
    return `
      <div class="lab-summary-item">
        <div class="lab-summary-head"><strong>${labLabel}</strong><span>${counts.total} unit</span></div>
        <div class="lab-summary-bar">
          ${seg(counts.active, "#10b981")}${seg(counts.unclosed, "#f59e0b")}${seg(counts.standby, "#3b82f6")}${seg(counts.offline, "#94a3b8")}
        </div>
        <div class="lab-summary-legend">
          <span><i class="dot dot-active"></i> ${counts.active} Aktif</span>
          <span><i class="dot dot-unclosed"></i> ${counts.unclosed} Unclosed</span>
          <span><i class="dot dot-standby"></i> ${counts.standby} Standby</span>
          <span><i class="dot dot-offline"></i> ${counts.offline} Offline</span>
        </div>
      </div>`;
  }

  async function refresh(){
    const summary = await Api.getSummary();
    document.getElementById("statTotalPc").textContent = summary.total;
    document.getElementById("statActive").textContent = summary.active;
    document.getElementById("statUnclosed").textContent = summary.unclosed;
    document.getElementById("statOffline").textContent = summary.offline;

    document.getElementById("labSummaryList").innerHTML =
      statusRow("lab1", "Lab 1 — GS Lantai 2", summary.byLab.lab1) +
      statusRow("lab2", "Lab 2 — GU Lantai 3", summary.byLab.lab2);

    renderChart(summary);

    const activity = await Api.getActivity();
    document.getElementById("activityList").innerHTML = activity.map(a => `
      <li><span class="activity-time">${a.time}</span><span class="activity-text">${a.text}</span></li>
    `).join("");
  }

  function renderChart(summary){
    const ctx = document.getElementById("cpuChart");
    if (!ctx || typeof Chart === "undefined") return;

    // Simulasi rata-rata beban CPU 30 detik terakhir berdasarkan jumlah sesi aktif
    const labels = Array.from({ length: 10 }, (_, i) => `${(i+1)*3}s`);
    const base = 20 + summary.active * 1.5;
    const data = labels.map(() => Math.min(96, Math.max(8, base + (Math.random() * 20 - 10))));

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Rata-rata CPU (%)",
          data,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.08)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, grid: { color: "rgba(15,23,42,0.06)" }, ticks: { font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  return { refresh };
})();

/* ============================================================
   ATTENDANCE PANE
   ============================================================ */
const AttendancePane = (() => {
  let allRows = [];

  function statusPillClass(status){
    return status === "Aktif" ? "pill-active" : "pill-unclosed";
  }

  function render(rows){
    const body = document.getElementById("attendanceTableBody");
    const empty = document.getElementById("attendanceEmpty");
    if (!rows.length){
      body.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = rows.map(r => `
      <tr>
        <td>${r.nim}</td><td>${r.nama}</td><td>${r.kelas}</td><td>${r.matkul}</td>
        <td>${r.dosen}</td><td>${r.pc}</td><td>${r.sesi}</td>
        <td><span class="pill ${statusPillClass(r.status)}">${r.status}</span></td>
      </tr>`).join("");
  }

  async function load(){
    allRows = await Api.getAttendance();
    render(allRows);
  }

  function bindSearch(){
    document.getElementById("attendanceSearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q){ render(allRows); return; }
      render(allRows.filter(r =>
        r.nama.toLowerCase().includes(q) || r.nim.toLowerCase().includes(q) ||
        r.kelas.toLowerCase().includes(q) || r.matkul.toLowerCase().includes(q)
      ));
    });
  }

  return { load, init: bindSearch };
})();

/* ============================================================
   INVENTORY PANE
   ============================================================ */
const InventoryPane = (() => {
  let allRows = [];

  function render(rows){
    document.getElementById("inventoryTableBody").innerHTML = rows.map(r => `
      <tr>
        <td>${r.code}</td><td>${r.name}</td><td>${r.category}</td><td>${r.location}</td>
        <td>${r.condition}</td><td>${r.updated}</td>
      </tr>`).join("") || `<tr><td colspan="6" style="color:var(--text-faint);">Tidak ada data.</td></tr>`;
  }

  async function load(){
    allRows = await Api.getInventory();
    render(allRows);
  }

  function bindSearch(){
    document.getElementById("inventorySearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q){ render(allRows); return; }
      render(allRows.filter(r => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q)));
    });
  }

  return { load, init: bindSearch };
})();

/* ============================================================
   APP BOOTSTRAP
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  Auth.init();
  Router.init();
  Floorplan.init();
  PcModal.init();
  ExportModal.init();
  AttendancePane.init();
  InventoryPane.init();

  Dashboard.refresh();
});

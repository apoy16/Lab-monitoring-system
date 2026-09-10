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
  // Riwayat titik data grafik CPU disimpan di sini (rolling window),
  // dan digambar langsung ke <canvas> tanpa library eksternal —
  // supaya grafik tetap tampil walau CDN/internet lab tidak tersedia.
  const CHART_POINTS = 14;
  let chartData = [];
  let lastSummary = null;
  let liveTimer = null;
  let resizeBound = false;

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
          <span><i class="dot dot-unclosed"></i> ${counts.unclosed} Belum Checkout</span>
          <span><i class="dot dot-standby"></i> ${counts.standby} Standby</span>
          <span><i class="dot dot-offline"></i> ${counts.offline} Offline</span>
        </div>
      </div>`;
  }

  async function refresh(){
    const summary = await Api.getSummary();
    lastSummary = summary;

    document.getElementById("statTotalPc").textContent = summary.total;
    document.getElementById("statActive").textContent = summary.active;
    document.getElementById("statUnclosed").textContent = summary.unclosed;
    document.getElementById("statOffline").textContent = summary.offline;

    document.getElementById("labSummaryList").innerHTML =
      statusRow("lab1", "Lab 1 — GS Lantai 2", summary.byLab.lab1) +
      statusRow("lab2", "Lab 2 — GU Lantai 3", summary.byLab.lab2);

    pushChartPoint(summary);
    drawChart();
    startLiveUpdates();
    bindResize();

    const activity = await Api.getActivity();
    document.getElementById("activityList").innerHTML = activity.map(a => `
      <li><span class="activity-time">${a.time}</span><span class="activity-text">${a.text}</span></li>
    `).join("");
  }

  function pushChartPoint(summary){
    const base = 18 + summary.active * 1.6;
    const next = clampVal(base + (Math.random() * 16 - 8));
    if (chartData.length === 0){
      // Isi window awal dengan variasi halus supaya kurva tidak terlihat datar/baru muncul satu titik
      chartData = Array.from({ length: CHART_POINTS }, () => clampVal(base + (Math.random() * 12 - 6)));
    } else {
      chartData.shift();
      chartData.push(next);
    }
  }

  function clampVal(v){ return Math.max(4, Math.min(97, Math.round(v))); }

  function drawChart(){
    const canvas = document.getElementById("cpuChart");
    if (!canvas || !chartData.length) return;

    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth || 480;
    const cssHeight = 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const padL = 34, padR = 10, padT = 14, padB = 22;
    const plotW = cssWidth - padL - padR;
    const plotH = cssHeight - padT - padB;

    // Grid horizontal + label persen
    ctx.strokeStyle = "rgba(15,23,42,0.07)";
    ctx.fillStyle = "#64748b";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach((v) => {
      const y = padT + plotH - (v / 100) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(cssWidth - padR, y);
      ctx.stroke();
      ctx.fillText(`${v}%`, 2, y + 3);
    });

    // Hitung titik kurva
    const stepX = plotW / (chartData.length - 1);
    const points = chartData.map((v, i) => ({
      x: padL + i * stepX,
      y: padT + plotH - (v / 100) * plotH
    }));

    const curvePath = (p) => {
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++){
        const prev = p[i - 1], curr = p[i];
        const midX = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(midX, prev.y, midX, curr.y, curr.x, curr.y);
      }
    };

    // Area fill dengan gradient
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, "rgba(37,99,235,0.22)");
    grad.addColorStop(1, "rgba(37,99,235,0.02)");
    curvePath(points);
    ctx.lineTo(points[points.length - 1].x, padT + plotH);
    ctx.lineTo(points[0].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Garis kurva
    curvePath(points);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Titik terakhir (live indicator)
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(37,99,235,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
  }

  function startLiveUpdates(){
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(() => {
      if (!document.getElementById("pane-dashboard").classList.contains("is-active") || !lastSummary) return;
      pushChartPoint(lastSummary);
      drawChart();
    }, 3000);
  }

  function bindResize(){
    if (resizeBound) return;
    resizeBound = true;
    window.addEventListener("resize", () => drawChart());
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

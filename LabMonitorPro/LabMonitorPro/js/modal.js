/* ============================================================
   LabMonitor Pro — modal.js
   Logika buka/tutup modal detail PC (6 tab), binding data,
   QR Code generator, telemetri real-time, dan modal export.
   ============================================================ */

const STATUS_LABEL = {
  active: "Aktif — Sesi Berjalan",
  unclosed: "Belum Checkout",
  standby: "Standby Online",
  offline: "Offline"
};
const STATUS_DOT_CLASS = {
  active: "dot-active", unclosed: "dot-unclosed", standby: "dot-standby", offline: "dot-offline"
};

/* ============================================================
   PC DETAIL MODAL
   ============================================================ */
const PcModal = (() => {

  let currentPc = null;
  let telemetryTimer = null;

  function el(id){ return document.getElementById(id); }

  async function open(pcId){
    const pc = await Api.getPcDetail(pcId);
    if (!pc){ Toast.show("Data PC tidak ditemukan.", "error"); return; }
    currentPc = pc;

    el("pcModalDot").className = `dot ${STATUS_DOT_CLASS[pc.status]}`;
    el("pcModalTitle").textContent = pc.id;
    el("pcModalSubtitle").textContent = `${pc.seat} · ${pc.lab === "lab1" ? "Lab 1 — GS Lt 2" : "Lab 2 — GU Lt 3"} · ${STATUS_LABEL[pc.status]}`;

    renderInfoTab(pc);
    renderHistoryTab(pc);
    renderAssetTab(pc);
    renderQrTab(pc);
    renderProcessTab(pc);
    renderMaintenanceTab(pc);

    switchTab("info");
    document.getElementById("modalPcDetail").classList.add("is-open");
    startTelemetryLoop();
  }

  function close(){
    document.getElementById("modalPcDetail").classList.remove("is-open");
    if (telemetryTimer) clearInterval(telemetryTimer);
    currentPc = null;
  }

  function switchTab(tabName){
    document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tabName));
    document.querySelectorAll(".modal-tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tabName));
  }

  function infoItem(label, value){
    return `<div class="info-item"><span>${label}</span><span>${value ?? "—"}</span></div>`;
  }

  function renderInfoTab(pc){
    el("infoSpecGrid").innerHTML = [
      infoItem("CPU", pc.hardware.cpu),
      infoItem("RAM", pc.hardware.ram),
      infoItem("Storage", pc.hardware.storage),
      infoItem("IP Address", pc.ip),
      infoItem("Lokasi Lab", pc.lab === "lab1" ? "Lab 1 — GS Lantai 2" : "Lab 2 — GU Lantai 3"),
      infoItem("Kondisi", pc.condition)
    ].join("");
  }

  function renderHistoryTab(pc){
    const u = pc.currentUser;
    if (u){
      el("userHistoryGrid").innerHTML = [
        infoItem("Nama Mahasiswa", u.nama),
        infoItem("NIM", u.nim),
        infoItem("Kelas", u.kelas),
        infoItem("Mata Kuliah", u.matkul),
        infoItem("Dosen Pengampu", u.dosen),
        infoItem("Sesi Jam", u.sesi)
      ].join("");
    } else {
      el("userHistoryGrid").innerHTML = `<div class="info-item" style="grid-column:1/-1;"><span>Status</span><span>Belum ada riwayat pemakaian tercatat pada sesi ini.</span></div>`;
    }
    updateTelemetryDisplay(pc);
  }

  function updateTelemetryDisplay(pc){
    const t = pc.telemetry;
    el("telemetryCpuBar").style.width = `${t.cpu}%`;
    el("telemetryRamBar").style.width = `${t.ram}%`;
    el("telemetryCpuVal").textContent = `${t.cpu}%`;
    el("telemetryRamVal").textContent = `${t.ram}%`;
    el("telemetryProcessList").innerHTML = t.processes.length
      ? t.processes.map(p => `<li><span>${p}</span><span>Aktif</span></li>`).join("")
      : `<li><span>Tidak ada proses aktif tercatat</span></li>`;
  }

  function startTelemetryLoop(){
    if (telemetryTimer) clearInterval(telemetryTimer);
    telemetryTimer = setInterval(() => {
      if (!currentPc || currentPc.status !== "active") return;
      // Simulasi fluktuasi live agent tanpa perlu round-trip API
      currentPc.telemetry.cpu = clamp(currentPc.telemetry.cpu + (Math.random() * 10 - 5), 5, 98);
      currentPc.telemetry.cpu = Math.round(currentPc.telemetry.cpu);
      currentPc.telemetry.ram = clamp(currentPc.telemetry.ram + (Math.random() * 6 - 3), 10, 95);
      currentPc.telemetry.ram = Math.round(currentPc.telemetry.ram);
      updateTelemetryDisplay(currentPc);
      renderProcessTab(currentPc);
    }, 3000);
  }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function renderAssetTab(pc){
    const form = el("assetForm");
    form.motherboard.value = pc.asset.motherboard;
    form.ram.value = pc.asset.ram;
    form.storage.value = pc.asset.storage;
    form.wifi.value = pc.asset.wifi;
    form.monitor.value = pc.asset.monitor;
    form.warranty.value = pc.asset.warranty;
  }

  function renderQrTab(pc){
    const qrData = encodeURIComponent(`LABMONITORPRO|${pc.id}|${pc.lab}|${pc.seat}`);
    el("qrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${qrData}`;
    el("qrSeatLabel").textContent = `${pc.seat} (${pc.id})`;
  }

  function renderProcessTab(pc){
    el("inspectorProcessList").innerHTML = pc.telemetry.processes.length
      ? pc.telemetry.processes.map(p => `<li><span>${p}</span><span>PID ${1000 + Math.floor(Math.random()*900)}</span></li>`).join("")
      : `<li><span>Tidak ada proses aktif tercatat</span></li>`;
  }

  async function renderMaintenanceTab(pc){
    const logs = await Api.getMaintenance(pc.id);
    el("maintenanceTableBody").innerHTML = logs.length
      ? logs.map(m => `<tr><td>${m.date}</td><td>${m.issue}</td><td>${m.action}</td><td>${m.tech}</td></tr>`).join("")
      : `<tr><td colspan="4" style="color:var(--text-faint);">Belum ada riwayat maintenance untuk unit ini.</td></tr>`;
  }

  function bind(){
    el("pcModalClose").addEventListener("click", close);
    document.getElementById("modalPcDetail").addEventListener("click", (e) => {
      if (e.target.id === "modalPcDetail") close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    el("pcModalTabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".modal-tab");
      if (!tab) return;
      if (tab.classList.contains("admin-only") && !Auth.isAdmin()){
        Toast.show("Tab ini khusus untuk Super Admin.", "error");
        return;
      }
      switchTab(tab.dataset.tab);
    });

    // Remote actions
    el("btnBroadcast").addEventListener("click", async () => {
      const msg = prompt("Tulis pesan broadcast untuk pengguna PC ini:");
      if (!msg) return;
      await Api.remoteAction(currentPc.id, "broadcast", { message: msg });
      Toast.show(`Pesan terkirim ke ${currentPc.id}.`);
    });
    el("btnRestart").addEventListener("click", async () => {
      if (!confirm(`Restart ${currentPc.id} sekarang?`)) return;
      await Api.remoteAction(currentPc.id, "restart");
      Toast.show(`Perintah restart terkirim ke ${currentPc.id}.`);
    });
    el("btnShutdownOne").addEventListener("click", async () => {
      if (!confirm(`Shutdown ${currentPc.id} sekarang?`)) return;
      await Api.remoteAction(currentPc.id, "shutdown");
      currentPc.status = "offline";
      Toast.show(`Perintah shutdown terkirim ke ${currentPc.id}.`);
      el("pcModalDot").className = `dot ${STATUS_DOT_CLASS.offline}`;
      Floorplan.render(Floorplan.getActiveLab());
      if (typeof Dashboard !== "undefined") Dashboard.refresh();
    });

    // Asset form
    el("assetForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        motherboard: form.motherboard.value, ram: form.ram.value, storage: form.storage.value,
        wifi: form.wifi.value, monitor: form.monitor.value, warranty: form.warranty.value
      };
      await Api.saveAsset(currentPc.id, data);
      const confirmEl = el("assetSaveConfirm");
      confirmEl.classList.add("is-visible");
      setTimeout(() => confirmEl.classList.remove("is-visible"), 2200);
      Toast.show("Data aset berhasil disimpan.");
    });

    // QR actions
    el("btnPrintSingle").addEventListener("click", () => printQr([currentPc]));
    el("btnPrintAll").addEventListener("click", async () => {
      const labId = Floorplan.getActiveLab();
      const pcs = await Api.getPcs(labId);
      printQr(pcs);
    });

    // Process inspector
    el("btnKillProcess").addEventListener("click", async () => {
      const val = el("killProcessInput").value.trim();
      if (!val){ Toast.show("Masukkan nama proses terlebih dahulu.", "error"); return; }
      await Api.remoteAction(currentPc.id, "kill", { process: val });
      currentPc.telemetry.processes = currentPc.telemetry.processes.filter(p => p !== val);
      renderProcessTab(currentPc);
      el("killProcessInput").value = "";
      Toast.show(`Sinyal terminate untuk "${val}" telah dikirim.`);
    });

    // Maintenance form
    el("maintenanceForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const session = Auth.getSession();
      const entry = {
        date: new Date().toISOString().slice(0, 10),
        issue: form.issue.value.trim(),
        action: form.action.value.trim(),
        tech: session ? session.label : "Operator"
      };
      await Api.addMaintenance(currentPc.id, entry);
      form.reset();
      renderMaintenanceTab(currentPc);
      Toast.show("Riwayat maintenance dicatat.");
    });
  }

  function printQr(pcs){
    const win = window.open("", "_blank");
    const cards = pcs.map(pc => {
      const qrData = encodeURIComponent(`LABMONITORPRO|${pc.id}|${pc.lab}|${pc.seat}`);
      return `
        <div class="print-card">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${qrData}">
          <p><strong>${pc.id}</strong><br>${pc.seat}</p>
        </div>`;
    }).join("");
    win.document.write(`
      <html><head><title>Cetak Label QR — LabMonitor Pro</title>
      <style>
        body{ font-family: sans-serif; margin:24px; }
        .print-grid{ display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; }
        .print-card{ text-align:center; border:1px solid #ddd; border-radius:8px; padding:12px; }
        .print-card img{ width:100%; max-width:160px; }
        .print-card p{ font-size:12px; margin-top:6px; }
      </style></head>
      <body>
        <h2>Label QR Presensi — LabMonitor Pro</h2>
        <div class="print-grid">${cards}</div>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  }

  return { init: bind, open, close };
})();

/* ============================================================
   EXPORT MODAL
   ============================================================ */
const ExportModal = (() => {
  function open(){ document.getElementById("modalExport").classList.add("is-open"); }
  function close(){ document.getElementById("modalExport").classList.remove("is-open"); }

  function downloadCsv(filename, content){
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function bind(){
    document.getElementById("btnOpenExport").addEventListener("click", () => {
      if (!Auth.isAdmin()){
        Toast.show("Export laporan khusus untuk Super Admin.", "error");
        return;
      }
      open();
    });
    document.getElementById("exportModalClose").addEventListener("click", close);
    document.getElementById("modalExport").addEventListener("click", (e) => {
      if (e.target.id === "modalExport") close();
    });
    document.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { filename, content } = await Api.exportReport(btn.dataset.export);
        downloadCsv(filename, content);
        Toast.show("Laporan berhasil diunduh.");
      });
    });

    document.getElementById("btnDownloadAttendance").addEventListener("click", async () => {
      const { filename, content } = await Api.exportReport("attendance");
      downloadCsv(filename, content);
      Toast.show("Laporan presensi berhasil diunduh.");
    });
  }

  return { init: bind, open, close };
})();

/* ============================================================
   LabMonitor Pro — api.js
   Service layer / fetch helper.
   Semua fungsi bersifat async (Promise) sehingga saat backend
   Flask sungguhan tersedia, cukup ganti isi fungsi *tanpa*
   mengubah pemanggilnya di app.js / floorplan.js / modal.js.

   BASE_URL menunjuk ke backend Flask. Selama backend belum aktif,
   layer ini otomatis fallback ke MOCK DATA yang disimpan di
   localStorage agar aplikasi tetap berjalan penuh secara mandiri.
   ============================================================ */

const Api = (() => {

  const BASE_URL = "http://localhost:5000/api"; // arahkan ke backend Flask di sini
  const USE_MOCK = true; // set false setelah backend Flask tersedia
  const STORAGE_KEY = "labmonitor_pro_db_v1";

  // ------------------------------------------------------------
  // MOCK DATA SEEDING
  // ------------------------------------------------------------
  const STUDENT_NAMES = [
    "Ahmad Rizki Pratama", "Siti Nur Aisyah", "Bagas Wicaksono", "Putri Ayu Lestari",
    "Dimas Saputra", "Wulan Sari", "Fajar Nugroho", "Indah Permata Sari",
    "Yusuf Maulana", "Rani Kartika", "Andika Pratama", "Dewi Anggraini",
    "Reza Firmansyah", "Nabila Zahra", "Galih Prasetyo", "Melati Putri",
    "Fikri Ramadhan", "Salsabila Azzahra", "Arya Wibawa", "Citra Kirana"
  ];
  const MATKUL = [
    { nama: "Pemrograman Web", dosen: "Dr. Hendra Kusuma, M.Kom" },
    { nama: "Basis Data Lanjut", dosen: "Ir. Yuni Astuti, M.T." },
    { nama: "Jaringan Komputer", dosen: "Agus Setiawan, S.Kom., M.Cs" },
    { nama: "Kecerdasan Buatan", dosen: "Dr. Prima Wijaya" },
    { nama: "Struktur Data", dosen: "Novi Rahmawati, M.Kom" }
  ];
  const KELAS = ["TI-3A", "TI-3B", "SI-2A", "TI-4A", "SI-3C"];
  const APPS = ["chrome.exe", "vscode.exe", "explorer.exe", "spotify.exe", "excel.exe", "discord.exe", "figma.exe", "python.exe", "wordpad.exe"];

  function seedDatabase(){
    const db = { pcs: {}, attendance: [], maintenance: {}, activity: [], inventory: [] };
    let attendanceCounter = 1;

    ["lab1", "lab2"].forEach((labId) => {
      for (let i = 1; i <= 30; i++){
        const pcId = `${labId === "lab1" ? "PC-A" : "PC-B"}${String(i).padStart(3, "0")}`;
        const roll = Math.random();
        let status;
        if (roll < 0.42) status = "active";
        else if (roll < 0.55) status = "unclosed";
        else if (roll < 0.75) status = "standby";
        else status = "offline";

        const matkul = MATKUL[Math.floor(Math.random() * MATKUL.length)];
        const hasSession = status === "active" || status === "unclosed";

        db.pcs[pcId] = {
          id: pcId,
          lab: labId,
          seat: `Meja ${String(i).padStart(2, "0")}`,
          column: i <= 15 ? "left" : "right",
          status,
          ip: `10.20.${labId === "lab1" ? 1 : 2}.${100 + i}`,
          condition: status === "offline" ? "Perlu pengecekan" : "Baik",
          hardware: {
            cpu: ["Intel Core i5-12400", "Intel Core i7-11700", "AMD Ryzen 5 5600G"][i % 3],
            ram: ["8 GB DDR4", "16 GB DDR4"][i % 2],
            storage: ["256 GB SSD NVMe", "512 GB SSD NVMe"][i % 2]
          },
          currentUser: hasSession ? {
            nama: STUDENT_NAMES[Math.floor(Math.random() * STUDENT_NAMES.length)],
            nim: `21${labId === "lab1" ? "5" : "6"}${String(1000 + i)}`,
            kelas: KELAS[i % KELAS.length],
            matkul: matkul.nama,
            dosen: matkul.dosen,
            sesi: i % 2 === 0 ? "08:00 - 09:40" : "10:00 - 11:40"
          } : null,
          telemetry: hasSession ? {
            cpu: Math.floor(20 + Math.random() * 70),
            ram: Math.floor(25 + Math.random() * 60),
            processes: shuffle(APPS).slice(0, 3 + Math.floor(Math.random() * 3))
          } : { cpu: 0, ram: 0, processes: [] },
          asset: {
            motherboard: `MB-${pcId}-${randHex(6)}`,
            ram: `RAM-${pcId}-${randHex(6)}`,
            storage: `STG-${pcId}-${randHex(6)}`,
            wifi: `WFI-${pcId}-${randHex(6)}`,
            monitor: `MON-${pcId}-${randHex(6)}`,
            warranty: "2027-03-31"
          }
        };
        db.maintenance[pcId] = i % 6 === 0 ? [
          { date: "2026-07-12", issue: "Monitor berkedip saat startup", action: "Ganti kabel VGA", tech: "Teguh S." }
        ] : [];

        if (hasSession){
          const u = db.pcs[pcId].currentUser;
          const sesiStart = u.sesi.split(" - ")[0];
          db.attendance.push({
            id: attendanceCounter++,
            nim: u.nim, nama: u.nama, kelas: u.kelas, matkul: u.matkul, dosen: u.dosen,
            pc: pcId, sesi: u.sesi, scanIn: addMinutes(sesiStart, Math.floor(Math.random() * 12)),
            tanggal: new Date().toISOString().slice(0, 10),
            status: status === "active" ? "Aktif" : "Belum Checkout"
          });
        }
      }
    });

    db.inventory = [
      { code: "MNT-001", name: "Monitor LG 19\" IPS", category: "Monitor", location: "Lab 1 - GS Lt 2", condition: "Baik", updated: "2026-08-02" },
      { code: "MNT-002", name: "Monitor Samsung 21\"", category: "Monitor", location: "Lab 2 - GU Lt 3", condition: "Baik", updated: "2026-08-04" },
      { code: "KBD-011", name: "Keyboard Logitech K120", category: "Keyboard", location: "Lab 1 - GS Lt 2", condition: "Perlu diganti", updated: "2026-06-19" },
      { code: "MSE-014", name: "Mouse Logitech B100", category: "Mouse", location: "Lab 1 - GS Lt 2", condition: "Baik", updated: "2026-07-28" },
      { code: "RTR-002", name: "Router TP-Link AX3000", category: "Router", location: "Lab 2 - GU Lt 3", condition: "Baik", updated: "2026-08-10" },
      { code: "WFD-007", name: "Dongle Wi-Fi TP-Link T2U", category: "Wi-Fi Dongle", location: "Lab 2 - GU Lt 3", condition: "Rusak Ringan", updated: "2026-05-30" },
      { code: "MSE-021", name: "Mouse Logitech B100", category: "Mouse", location: "Lab 2 - GU Lt 3", condition: "Baik", updated: "2026-08-01" },
      { code: "KBD-022", name: "Keyboard Logitech K120", category: "Keyboard", location: "Lab 2 - GU Lt 3", condition: "Baik", updated: "2026-07-15" }
    ];

    db.activity = [
      { time: "09:41", text: "Operator Lab 1 menandai PC-A014 selesai maintenance." },
      { time: "09:22", text: "Sistem mendeteksi PC-B007 offline lebih dari 15 menit." },
      { time: "08:55", text: "Super Admin mengekspor laporan presensi Pemrograman Web." },
      { time: "08:40", text: "30 mahasiswa memulai sesi praktikum Basis Data Lanjut di Lab 2." },
      { time: "08:02", text: "Sinkronisasi live agent selesai untuk seluruh unit Lab 1 & 2." }
    ];

    return db;
  }

  function addMinutes(hhmm, mins){
    const [h, m] = hhmm.split(":").map(Number);
    const total = h * 60 + m + mins;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function randHex(len){
    let s = "";
    const chars = "ABCDEF0123456789";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function shuffle(arr){
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadDb(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted -> reseed */ }
    const fresh = seedDatabase();
    saveDb(fresh);
    return fresh;
  }
  function saveDb(db){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  let DB = loadDb();

  // simulate small network latency for realism without blocking UX
  function delay(ms = 120){ return new Promise((res) => setTimeout(res, ms)); }

  // ------------------------------------------------------------
  // PUBLIC API — mirrors intended Flask REST endpoints
  // ------------------------------------------------------------
  return {

    /** GET /api/pcs?lab=lab1 */
    async getPcs(labId){
      await delay();
      if (USE_MOCK) return Object.values(DB.pcs).filter(p => p.lab === labId);
      return fetch(`${BASE_URL}/pcs?lab=${labId}`).then(r => r.json());
    },

    /** GET /api/pcs/:id */
    async getPcDetail(pcId){
      await delay(80);
      if (USE_MOCK) return DB.pcs[pcId] || null;
      return fetch(`${BASE_URL}/pcs/${pcId}`).then(r => r.json());
    },

    /** GET /api/pcs/summary — counts for dashboard */
    async getSummary(){
      await delay(80);
      if (USE_MOCK){
        const all = Object.values(DB.pcs);
        return {
          total: all.length,
          active: all.filter(p => p.status === "active").length,
          unclosed: all.filter(p => p.status === "unclosed").length,
          standby: all.filter(p => p.status === "standby").length,
          offline: all.filter(p => p.status === "offline").length,
          byLab: {
            lab1: countByLab(all, "lab1"),
            lab2: countByLab(all, "lab2")
          }
        };
      }
      return fetch(`${BASE_URL}/pcs/summary`).then(r => r.json());

      function countByLab(all, labId){
        const list = all.filter(p => p.lab === labId);
        return {
          active: list.filter(p => p.status === "active").length,
          unclosed: list.filter(p => p.status === "unclosed").length,
          standby: list.filter(p => p.status === "standby").length,
          offline: list.filter(p => p.status === "offline").length,
          total: list.length
        };
      }
    },

    /** GET /api/activity */
    async getActivity(){
      await delay(60);
      if (USE_MOCK) return DB.activity;
      return fetch(`${BASE_URL}/activity`).then(r => r.json());
    },

    /** GET /api/attendance */
    async getAttendance(){
      await delay(100);
      if (USE_MOCK) return DB.attendance;
      return fetch(`${BASE_URL}/attendance`).then(r => r.json());
    },

    /** POST /api/attendance/:id/force-checkout — override manual oleh operator */
    async forceCheckout(attendanceId){
      await delay(200);
      if (USE_MOCK){
        const record = DB.attendance.find(a => a.id === attendanceId);
        if (!record) return null;
        record.status = "Checkout Manual";
        record.scanOut = new Date().toTimeString().slice(0, 5);
        const pc = DB.pcs[record.pc];
        if (pc && pc.status === "unclosed"){
          pc.status = "standby";
          pc.currentUser = null;
        }
        saveDb(DB);
        return record;
      }
      return fetch(`${BASE_URL}/attendance/${attendanceId}/force-checkout`, { method: "POST" }).then(r => r.json());
    },

    /** GET /api/inventory */
    async getInventory(){
      await delay(100);
      if (USE_MOCK) return DB.inventory;
      return fetch(`${BASE_URL}/inventory`).then(r => r.json());
    },

    /** POST /api/inventory — tambah aset baru */
    async addInventoryItem(item){
      await delay(150);
      if (USE_MOCK){
        DB.inventory.unshift(item);
        saveDb(DB);
        return item;
      }
      return fetch(`${BASE_URL}/inventory`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item)
      }).then(r => r.json());
    },

    /** PUT /api/inventory/:code — ubah data aset */
    async updateInventoryItem(code, data){
      await delay(150);
      if (USE_MOCK){
        const item = DB.inventory.find(i => i.code === code);
        if (item) Object.assign(item, data);
        saveDb(DB);
        return item;
      }
      return fetch(`${BASE_URL}/inventory/${code}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      }).then(r => r.json());
    },

    /** DELETE /api/inventory/:code — hapus aset */
    async deleteInventoryItem(code){
      await delay(150);
      if (USE_MOCK){
        DB.inventory = DB.inventory.filter(i => i.code !== code);
        saveDb(DB);
        return { ok: true };
      }
      return fetch(`${BASE_URL}/inventory/${code}`, { method: "DELETE" }).then(r => r.json());
    },

    /** GET /api/pcs/:id/maintenance */
    async getMaintenance(pcId){
      await delay(60);
      if (USE_MOCK) return DB.maintenance[pcId] || [];
      return fetch(`${BASE_URL}/pcs/${pcId}/maintenance`).then(r => r.json());
    },

    /** POST /api/pcs/:id/maintenance */
    async addMaintenance(pcId, entry){
      await delay(150);
      if (USE_MOCK){
        if (!DB.maintenance[pcId]) DB.maintenance[pcId] = [];
        DB.maintenance[pcId].unshift(entry);
        saveDb(DB);
        return entry;
      }
      return fetch(`${BASE_URL}/pcs/${pcId}/maintenance`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
      }).then(r => r.json());
    },

    /** PUT /api/pcs/:id/asset */
    async saveAsset(pcId, assetData){
      await delay(150);
      if (USE_MOCK){
        DB.pcs[pcId].asset = { ...DB.pcs[pcId].asset, ...assetData };
        saveDb(DB);
        return DB.pcs[pcId].asset;
      }
      return fetch(`${BASE_URL}/pcs/${pcId}/asset`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assetData)
      }).then(r => r.json());
    },

    /** POST /api/pcs/:id/remote/{restart|shutdown|broadcast|kill} */
    async remoteAction(pcId, action, payload = {}){
      await delay(300);
      if (USE_MOCK){
        if (action === "shutdown"){
          DB.pcs[pcId].status = "offline";
          DB.pcs[pcId].currentUser = null;
          DB.pcs[pcId].telemetry = { cpu: 0, ram: 0, processes: [] };
          saveDb(DB);
        }
        if (action === "kill" && payload.process){
          DB.pcs[pcId].telemetry.processes = DB.pcs[pcId].telemetry.processes.filter(p => p !== payload.process);
          saveDb(DB);
        }
        return { ok: true, action, pcId };
      }
      return fetch(`${BASE_URL}/pcs/${pcId}/remote/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      }).then(r => r.json());
    },

    /** POST /api/pcs/shutdown-all?lab=lab1 */
    async massShutdown(labId){
      await delay(400);
      if (USE_MOCK){
        Object.values(DB.pcs).filter(p => p.lab === labId).forEach(p => {
          p.status = "offline"; p.currentUser = null; p.telemetry = { cpu: 0, ram: 0, processes: [] };
        });
        saveDb(DB);
        return { ok: true };
      }
      return fetch(`${BASE_URL}/pcs/shutdown-all?lab=${labId}`, { method: "POST" }).then(r => r.json());
    },

        /** Helper: cek apakah sebuah tanggal (YYYY-MM-DD) masuk rentang yang dipilih */
    _inRange(dateStr, range, customStart, customEnd){
      if (!dateStr || range === "all") return true;
      const d = new Date(dateStr);
      const now = new Date();
      if (range === "month"){
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      if (range === "semester"){
        const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
        const semesterStart = new Date(now.getFullYear(), semesterStartMonth, 1);
        return d >= semesterStart && d <= now;
      }
      if (range === "custom"){
        if (!customStart || !customEnd) return true;
        return dateStr >= customStart && dateStr <= customEnd;
      }
      return true;
    },

    /** GET /api/export/:type — dalam produksi backend mengembalikan file .xlsx/.pdf */
    async exportReport(type, options = {}){
      await delay(300);
      const { range = "all", customStart = "", customEnd = "" } = options;
      let headers = [];
      let dataRows = [];

      if (type === "attendance"){
        headers = ["NIM","Nama","Kelas","Mata Kuliah","Dosen","PC","Sesi","Status"];
        dataRows = DB.attendance
          .filter(a => this._inRange(a.tanggal, range, customStart, customEnd))
          .map(a => [a.nim, a.nama, a.kelas, a.matkul, a.dosen, a.pc, a.sesi, a.status]);
      } else if (type === "maintenance"){
        headers = ["PC","Tanggal","Kendala","Tindakan","Teknisi"];
        Object.entries(DB.maintenance).forEach(([pc, list]) => {
          list.filter(m => this._inRange(m.date, range, customStart, customEnd))
            .forEach(m => dataRows.push([pc, m.date, m.issue, m.action, m.tech]));
        });
      } else if (type === "inventory"){
        headers = ["Kode Aset","Nama Aset","Kategori","Lokasi","Kondisi","Update Terakhir"];
        dataRows = DB.inventory
          .filter(i => this._inRange(i.updated, range, customStart, customEnd))
          .map(i => [i.code, i.name, i.category, i.location, i.condition, i.updated]);
      }

      const rows = [headers, ...dataRows];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      return {
        filename: `laporan_${type}_${Date.now()}.csv`,
        content: csv,
        headers,
        dataRows
      };
    }
  };
})();

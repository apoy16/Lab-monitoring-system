/* ============================================================
   LabMonitor Pro — floorplan.js
   Rendering denah lab (30 PC), indikator status dual-condition,
   dan interaksi klik node PC untuk membuka modal detail.
   ============================================================ */

const Floorplan = (() => {

  let activeLab = "lab1";
  let refreshTimer = null;

  const STATUS_DOT_CLASS = {
    active: "dot-active",
    unclosed: "dot-unclosed",
    standby: "dot-standby",
    offline: "dot-offline"
  };

  function nodeTemplate(pc){
    const dotClass = STATUS_DOT_CLASS[pc.status] || "dot-offline";
    return `
      <button class="pc-node" data-pc-id="${pc.id}" aria-label="${pc.id} — ${pc.seat}">
        <div class="pc-node-top">
          <span class="pc-node-id">${pc.id}</span>
          <span class="dot ${dotClass}"></span>
        </div>
        <span class="pc-node-seat">${pc.seat}</span>
      </button>
    `;
  }

  async function render(labId){
    activeLab = labId;
    const pcs = await Api.getPcs(labId);
    const left = pcs.filter(p => p.column === "left").sort((a,b) => a.seat.localeCompare(b.seat));
    const right = pcs.filter(p => p.column === "right").sort((a,b) => a.seat.localeCompare(b.seat));

    document.getElementById("labColLeft").innerHTML = left.map(nodeTemplate).join("");
    document.getElementById("labColRight").innerHTML = right.map(nodeTemplate).join("");
  }

  function bindClicks(){
    document.getElementById("labRoom").addEventListener("click", (e) => {
      const node = e.target.closest(".pc-node");
      if (!node) return;
      PcModal.open(node.dataset.pcId);
    });

    document.getElementById("labSwitch").addEventListener("click", (e) => {
      const tab = e.target.closest(".lab-tab");
      if (!tab) return;
      document.querySelectorAll(".lab-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      render(tab.dataset.lab);
    });

    document.getElementById("btnMassShutdown").addEventListener("click", async () => {
      if (!Auth.isAdmin()){
        Toast.show("Hanya Super Admin yang dapat melakukan shutdown massal.", "error");
        return;
      }
      const labName = activeLab === "lab1" ? "Lab 1" : "Lab 2";
      if (!confirm(`Yakin ingin mematikan seluruh unit aktif di ${labName}?`)) return;
      await Api.massShutdown(activeLab);
      Toast.show(`Shutdown massal ${labName} berhasil dikirim.`);
      render(activeLab);
      if (typeof Dashboard !== "undefined") Dashboard.refresh();
    });
  }

  function startAutoRefresh(){
    if (refreshTimer) clearInterval(refreshTimer);
    // Simulasikan pembaruan status ringan setiap beberapa detik agar terasa "live"
    refreshTimer = setInterval(() => {
      if (document.getElementById("pane-floorplan").classList.contains("is-active")){
        render(activeLab);
      }
    }, 15000);
  }

  function init(){
    bindClicks();
    render(activeLab);
    startAutoRefresh();
  }

  function getActiveLab(){ return activeLab; }

  return { init, render, getActiveLab };
})();

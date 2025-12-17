// Configuration
const API_BASE = "/api/v1"; // Proxied through Caddy to NocoDB

// Storage for configuration
let apiToken = "7511d065bc905dcebd199a2cfeaf472339cfcb4b15e29957";
let projectId = localStorage.getItem('nocodb_project_id') || '';
let toolsTableId = localStorage.getItem('nocodb_tools_table_id') || '';
let locationsTableId = localStorage.getItem('nocodb_locations_table_id') || '';
let columnMap = {}; // Maps field names to column IDs

// Brand dropdown options (plus Other)
const BRAND_OPTIONS = [
  "Craftsman","Stanley","Irwin","Vise-Grip","Channellock","Klein Tools","Ridgid",
  "Estwing","Vaughan","Chicago","DeWalt","Makita","Milwaukee","Other"
];

// Taxonomy: Category -> Subcategory -> Type
const SUBCATEGORY_OPTIONS = {
  "Hand Tools": [
    "Screwdrivers",
    "Nut Drivers",
    "Hex/Allen",
    "Wrenches",
    "Pliers & Cutters",
    "Hammers",
    "Measuring & Layout",
    "Other"
  ],
  "Power Tools": [
    "Drills & Drivers",
    "Saws",
    "Sanders & Grinders",
    "Impact Wrenches",
    "Rotary Tools",
    "Multi-Tools",
    "Routers",
    "Nailers & Staplers",
    "Other"
  ]
};

const TYPE_OPTIONS = {
  "Screwdrivers": ["Phillips","Flat/Slotted","Torx","Square/Robertson","Precision","Other"],
  "Nut Drivers": ["Standard","Deep","Magnetic","Other"],
  "Hex/Allen": ["Keys","T-Handles","Drivers","Other"],
  "Wrenches": ["Box/Open","Combination","Adjustable","Pipe","Other"],
  "Pliers & Cutters": ["Slip Joint","Channel Lock","Needle Nose","Lineman Pliers","Side Cutters","Other"],
  "Hammers": ["Claw Hammer","Ball Peen","Sledge Hammer","Mallet/Dead Blow","Other"],
  "Measuring & Layout": ["Tape Measure","Square","Level","Plumb Bob","Calipers","Other"],

  "Drills & Drivers": ["Drill","Impact Driver","Hammer Drill","Screw Gun","Other"],
  "Saws": ["Circular Saw","Reciprocating Saw","Jigsaw","Miter Saw","Table Saw","Other"],
  "Sanders & Grinders": ["Orbital Sander","Belt Sander","Angle Grinder","Bench Grinder","Other"],
  "Impact Wrenches": ["Corded","Cordless","Other"],
  "Rotary Tools": ["Dremel-style","Other"],
  "Multi-Tools": ["Oscillating","Other"],
  "Routers": ["Trim Router","Plunge Router","Other"],
  "Nailers & Staplers": ["Brad Nailer","Finish Nailer","Framing Nailer","Stapler","Other"]
};

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase();
}

function showApiTokenPrompt() { return; } // disabled

function populateBrandDropdown() {
  const el = document.getElementById("tool-brand");
  if (!el) return;
  el.innerHTML = '<option value="">Select brand...</option>';
  BRAND_OPTIONS.forEach(b => {
    const o = document.createElement("option");
    o.value = b;
    o.textContent = b;
    el.appendChild(o);
  });
}

function handleBrandChange() {
  const sel = document.getElementById("tool-brand");
  const grp = document.getElementById("brand-other-group");
  const inp = document.getElementById("brand-other");
  if (!sel || !grp || !inp) return;
  if (sel.value === "Other") {
    grp.style.display = "block";
    inp.required = true;
  } else {
    grp.style.display = "none";
    inp.required = false;
    inp.value = "";
  }
}

// Minimal UI helpers (your existing HTML expects these)
function showMessage(type, msg) { console.log(type, msg); }
function showModal(html) {
  // Create modal skeleton if it doesn't exist
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'none';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.id = 'modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.borderRadius = '12px';
    modal.style.maxWidth = '900px';
    modal.style.width = '92%';
    modal.style.maxHeight = '90%';
    modal.style.overflow = 'auto';
    modal.style.padding = '24px';

    const content = document.createElement('div');
    content.id = 'modal-content';
    modal.appendChild(content);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.body.appendChild(overlay);
  }

  const content = document.getElementById('modal-content');
  overlay.style.display = 'block';
  content.innerHTML = html;
}

async function initializeApp() {
  populateBrandDropdown();
  if (!apiToken) return;
  await discoverTables();
}

// Generic API call function
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultOptions = {
    headers: {
      'xc-token': apiToken,
      'Content-Type': 'application/json'
    }
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, config);
  if (response.status === 401) return null;
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }
  return await response.json();
}

// Discover projects and tables
async function discoverTables() {
  try {
    const basesResp = await apiCall('/db/meta/projects'); // v1 naming
    const projectsResponse = basesResp?.list || basesResp; // tolerate both shapes
    if (!projectsResponse || projectsResponse.length === 0) return;

    const project =
      projectsResponse.find(p => (p.title || "").toLowerCase().includes("tool")) ||
      projectsResponse[0];

    projectId = project.id;
    localStorage.setItem('nocodb_project_id', projectId);

    const tablesRespWrap = await apiCall(`/meta/projects/${projectId}/tables`);
    const tablesResponse = tablesRespWrap?.list || tablesRespWrap;
    if (!tablesResponse) return;

    const toolsTable = tablesResponse.find(t => (t.title || "").toLowerCase() === "tools");
    const locationsTable = tablesResponse.find(t => (t.title || "").toLowerCase() === "locations");

    if (toolsTable) {
      toolsTableId = toolsTable.id;
      localStorage.setItem('nocodb_tools_table_id', toolsTableId);
    }
    if (locationsTable) {
      locationsTableId = locationsTable.id;
      localStorage.setItem('nocodb_locations_table_id', locationsTableId);
    }
  } catch (e) {
    console.error("Discovery error:", e);
  }
}

// ====== Add Tool Modal ======
function addTool() {
  showModal(`
    <h2 style="font-size: 36px; margin-bottom: 20px;">Add a Tool</h2>

    <div class="form-group">
      <label for="tool-category">Category</label>
      <select id="tool-category" style="font-size:24px; padding:15px;" onchange="handleCategoryChange()">
        <option value="">Select category...</option>
        <option>Hand Tools</option>
        <option>Power Tools</option>
      </select>
    </div>

    <div class="form-group">
      <label for="tool-subcategory">Subcategory</label>
      <select id="tool-subcategory" style="font-size:24px; padding:15px;" onchange="handleSubcategoryChange()">
        <option value="">Select subcategory...</option>
      </select>
    </div>

    <div class="form-group" id="subcategory-other-group" style="display:none;">
      <label for="subcategory-other">Specify subcategory</label>
      <input type="text" id="subcategory-other" placeholder="Enter subcategory..." style="font-size:24px; padding:15px;">
    </div>

    <div class="form-group">
      <label for="tool-type">Type</label>
      <select id="tool-type" style="font-size:24px; padding:15px;" onchange="handleTypeChange()">
        <option value="">Select type...</option>
      </select>
    </div>

    <div class="form-group" id="type-other-group" style="display:none;">
      <label for="type-other">Specify type</label>
      <input type="text" id="type-other" placeholder="Enter type..." style="font-size:24px; padding:15px;">
    </div>

    <div class="form-group">
      <label for="tool-brand">Brand</label>
      <select id="tool-brand" style="font-size:24px; padding:15px;" onchange="handleBrandChange()">
        <option value="">Select brand...</option>
      </select>
    </div>

    <div class="form-group" id="brand-other-group" style="display:none;">
      <label for="brand-other">Specify brand</label>
      <input type="text" id="brand-other" placeholder="Enter brand..." style="font-size:24px; padding:15px;">
    </div>

    <div class="form-group">
      <label for="tool-size">Size / Specs</label>
      <input type="text" id="tool-size" style="font-size:24px; padding:15px;" placeholder='e.g. 10", 3/8", 18V'>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveTool()">Save</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);

  populateBrandDropdown();
}

function handleCategoryChange() {
  const category = document.getElementById('tool-category')?.value || '';
  const subSel = document.getElementById('tool-subcategory');
  const typeSel = document.getElementById('tool-type');
  const subOtherGrp = document.getElementById('subcategory-other-group');

  subSel.innerHTML = '<option value="">Select subcategory...</option>';
  typeSel.innerHTML = '<option value="">Select type...</option>';
  if (subOtherGrp) subOtherGrp.style.display = 'none';

  // tolerant match
  const opts =
    SUBCATEGORY_OPTIONS[category] ||
    SUBCATEGORY_OPTIONS[(category || "").trim()] ||
    SUBCATEGORY_OPTIONS[(category || "").trim().toLowerCase()] ||
    SUBCATEGORY_OPTIONS[Object.keys(SUBCATEGORY_OPTIONS).find(k => normalizeKey(k) === normalizeKey(category))];

  if (opts) {
    opts.forEach(s => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      subSel.appendChild(o);
    });
  }

  handleSubcategoryChange();
}

function handleSubcategoryChange() {
  const sub = document.getElementById('tool-subcategory')?.value || '';
  const subOtherGrp = document.getElementById('subcategory-other-group');
  const subOtherInp = document.getElementById('subcategory-other');
  const typeSel = document.getElementById('tool-type');

  if (subOtherGrp && subOtherInp) {
    if (sub === "Other") {
      subOtherGrp.style.display = "block";
      subOtherInp.required = true;
    } else {
      subOtherGrp.style.display = "none";
      subOtherInp.required = false;
      subOtherInp.value = "";
    }
  }

  typeSel.innerHTML = '<option value="">Select type...</option>';
  const types = TYPE_OPTIONS[sub] || [];
  types.forEach(t => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    typeSel.appendChild(o);
  });
}

function handleTypeChange() {
  const t = document.getElementById('tool-type')?.value || '';
  const grp = document.getElementById('type-other-group');
  const inp = document.getElementById('type-other');
  if (!grp || !inp) return;
  if (t === "Other") {
    grp.style.display = "block";
    inp.required = true;
  } else {
    grp.style.display = "none";
    inp.required = false;
    inp.value = "";
  }
}

// Save tool (requires Tools table id discovered)
async function saveTool() {
  if (!toolsTableId) { alert("Tools table not found yet."); return; }

  const category = document.getElementById('tool-category')?.value || null;

  const sub = document.getElementById('tool-subcategory')?.value || null;
  const subOther = document.getElementById('subcategory-other')?.value?.trim() || "";
  const finalSub = (sub === "Other") ? (subOther || "Other") : sub;

  const type = document.getElementById('tool-type')?.value || null;
  const typeOther = document.getElementById('type-other')?.value?.trim() || "";
  const finalType = (type === "Other") ? (typeOther || "Other") : type;

  const brandSel = document.getElementById('tool-brand')?.value || null;
  const brandOther = document.getElementById('brand-other')?.value?.trim() || "";
  const finalBrand = (brandSel === "Other") ? (brandOther || "Other") : brandSel;

  const sizeSpec = document.getElementById('tool-size')?.value?.trim() || null;

  const payload = {
    "Category": category,
    "Sub Category": finalSub,
    "Type": finalType,
    "Brand": finalBrand,
    "Size / Specs": sizeSpec
  };

  try {
    // NocoDB v1 data endpoint (tableId)
    await apiCall(`/db/data/v1/${projectId}/${toolsTableId}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    closeModal();
    alert("Saved.");
  } catch (e) {
    console.error(e);
    alert("Error saving tool: " + e.message);
  }
}

// Expose addTool to global (if your HTML uses onclick="addTool()")
window.addTool = addTool;
window.saveTool = saveTool;
window.handleCategoryChange = handleCategoryChange;
window.handleSubcategoryChange = handleSubcategoryChange;
window.handleTypeChange = handleTypeChange;
window.handleBrandChange = handleBrandChange;


// Expose functions for inline onclick handlers
window.__toolInventoryExports = true;
if (typeof showSettings === 'function') window.showSettings = showSettings;
if (typeof findTool === 'function') window.findTool = findTool;
if (typeof repairTool === 'function') window.repairTool = repairTool;
if (typeof inventoryOverview === 'function') window.inventoryOverview = inventoryOverview;
if (typeof moveTool === 'function') window.moveTool = moveTool;
if (typeof addTool === 'function') window.addTool = addTool;
if (typeof closeModal === 'function') window.closeModal = closeModal;
if (typeof clearSettings === 'function') window.clearSettings = clearSettings;
if (typeof saveSettings === 'function') window.saveSettings = saveSettings;
if (typeof performSearch === 'function') window.performSearch = performSearch;

function closeModal() {
  // New modal system (overlay injected by showModal)
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';

  // Legacy modal system (index.html has #modal)
  const legacy = document.getElementById('modal');
  if (legacy) legacy.classList.add('hidden');
}

// ===== RESTORED BUTTON HANDLERS (STUBS) =====


function findTool() {
  showModal(`
    <h2>Find a Tool</h2>
    <div class="form-group">
      <label>Search</label>
      <input type="text" id="search-term" placeholder="Brand, category, subcategory, type, size/spec..." style="font-size: 24px; padding: 14px; width:100%;" />
      <p style="margin-top:10px; opacity:.75;">Press Enter to search.</p>
    </div>
    <div id="search-results" style="margin-top:16px;"></div>
  `);

  const input = document.getElementById("search-term");
  input.focus();
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performSearch();
  });
}

async function performSearch() {
  const term = (document.getElementById("search-term")?.value || "").trim().toLowerCase();
  const out = document.getElementById("search-results");
  if (!out) return;

  if (!term) {
    out.innerHTML = `<p style="opacity:.8;">Type something to search.</p>`;
    return;
  }

  try {
    // Pull a chunk of rows and filter locally (simple + reliable)
    const resp = await apiCall(`/db/data/v1/${projectId}/${toolsTableId}?limit=500`);
    const rows = resp?.list || resp?.data || resp || [];

    const hits = rows.filter(r => {
      const brand = (r["Brand"] || "").toLowerCase();
      const cat   = (r["Category"] || "").toLowerCase();
      const sub   = (r["Sub Category"] || "").toLowerCase();
      const typ   = (r["Type"] || "").toLowerCase();
      const size  = (r["Size / Specs"] || "").toLowerCase();
      return brand.includes(term) || cat.includes(term) || sub.includes(term) || typ.includes(term) || size.includes(term);
    });

    if (!hits.length) {
      out.innerHTML = `<p>No matches.</p>`;
      return;
    }

    out.innerHTML = hits.slice(0, 50).map(r => {
      const label = [r["Brand"], r["Size / Specs"], r["Type"], r["Sub Category"], r["Category"]]
        .filter(Boolean).join(" • ");
      const id = r["Id"] || r["id"] || "";
      return `<button class="action-button" style="width:100%; justify-content:flex-start; margin:8px 0;" onclick="openToolDetails('${id}')">${escapeHtml(label || 'Tool')}</button>`;
    }).join("");

    window.__lastSearchRows = rows;
  } catch (e) {
    console.error(e);
    out.innerHTML = `<p style="color:#c0392b;">Search failed. Check console.</p>`;
  }
}

function openToolDetails(id) {
  const rows = window.__lastSearchRows || [];
  const r = rows.find(x => (x["Id"] || x["id"] || "") == id);
  if (!r) return;

  const fields = ["Category","Sub Category","Type","Brand","Size / Specs","Location","Condition","Tags"];
  const lines = fields.map(f => `<p><strong>${f}:</strong> ${escapeHtml(String(r[f] || ""))}</p>`).join("");

  showModal(`
    <h2>Tool Details</h2>
    ${lines}
  `);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function moveTool() {
  showModal(`
    <h2>Move a Tool</h2>
    <p>Select a tool and choose a new location.</p>
    <p>(Coming next)</p>
  `);
}

function repairTool() {
  showModal(`
    <h2>Repair a Tool</h2>
    <p>Mark a tool as needing repair or log maintenance.</p>
    <p>(Coming next)</p>
  `);
}

function inventoryOverview() {
  showModal(`
    <h2>Inventory Overview</h2>
    <p>Summary view of all tools.</p>
    <p>(Coming next)</p>
  `);
}

// Safety: modal close handler (was missing)
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}


// ===== TEMP SAFE STUBS (restore buttons) =====
function findTool() {
  showModal('<h2>Find a Tool</h2><p>Search is coming next.</p>');
}

function repairTool() {
  showModal('<h2>Repair a Tool</h2><p>Repair tracking coming later.</p>');
}

function moveTool() {
  showModal('<h2>Move a Tool</h2><p>Move tool flow coming later.</p>');
}

function inventoryOverview() {
  showModal('<h2>Inventory Overview</h2><p>Overview coming later.</p>');
}

// safety: close modal
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
}

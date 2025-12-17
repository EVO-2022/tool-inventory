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
    const basesResp = await apiCall('/db/meta/projects');
    const projectsResponse = basesResp?.list || basesResp;
    if (!projectsResponse || projectsResponse.length === 0) return;

    const project =
      projectsResponse.find(p => (p.title || "").toLowerCase().includes("tool")) ||
      projectsResponse[0];

    projectId = project.id;
    localStorage.setItem('nocodb_project_id', projectId);

    const tablesRespWrap = await apiCall(`/db/meta/projects/${projectId}/tables`);
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

// Settings function
function showSettings() {
  showModal(`
    <h2>Settings</h2>
    <div class="form-group">
      <label>API Token:</label>
      <input type="text" id="settings-token" value="${apiToken ? '••••••••' : ''}" placeholder="Enter API token..." style="font-size: 24px; padding: 15px; width:100%;" />
      <p style="font-size: 18px; color: #7f8c8d; margin-top: 10px;">Find this in NocoDB: Settings > Token Management</p>
    </div>
    <div class="form-group">
      <label>Current Configuration:</label>
      <div style="font-size: 18px; padding: 15px; background-color: #ecf0f1; border-radius: 8px;">
        <p><strong>Project ID:</strong> ${projectId || 'Not set'}</p>
        <p><strong>Tools Table ID:</strong> ${toolsTableId || 'Not set'}</p>
        <p><strong>Locations Table ID:</strong> ${locationsTableId || 'Not set'}</p>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveSettings()">Save & Refresh</button>
      <button class="btn btn-secondary" onclick="clearSettings()">Clear All Settings</button>
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `);
}

function saveSettings() {
  const newToken = document.getElementById('settings-token')?.value?.trim();
  if (newToken && newToken !== '••••••••') {
    apiToken = newToken;
    localStorage.setItem('nocodb_api_token', apiToken);
  }
  
  projectId = '';
  toolsTableId = '';
  locationsTableId = '';
  localStorage.removeItem('nocodb_project_id');
  localStorage.removeItem('nocodb_tools_table_id');
  localStorage.removeItem('nocodb_locations_table_id');
  
  closeModal();
  showModal('<h2>Settings Saved</h2><p>Rediscovering tables...</p>');
  discoverTables().then(() => {
    setTimeout(closeModal, 1500);
  });
}

function clearSettings() {
  if (!confirm('Clear all settings? You will need to reconfigure the API token.')) return;
  
  apiToken = '';
  projectId = '';
  toolsTableId = '';
  locationsTableId = '';
  localStorage.clear();
  closeModal();
  showModal('<h2>Settings Cleared</h2><p>All settings have been cleared.</p>');
  setTimeout(closeModal, 2000);
}

// Expose all functions to global scope for onclick handlers
window.addTool = addTool;
window.saveTool = saveTool;
window.handleCategoryChange = handleCategoryChange;
window.handleSubcategoryChange = handleSubcategoryChange;
window.handleTypeChange = handleTypeChange;
window.handleBrandChange = handleBrandChange;
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.clearSettings = clearSettings;
window.findTool = findTool;
window.repairTool = repairTool;
window.inventoryOverview = inventoryOverview;
window.moveTool = moveTool;
window.closeModal = closeModal;
window.performSearch = performSearch;
window.performMoveSearch = performMoveSearch;
window.saveToolMove = saveToolMove;
window.saveRepairStatus = saveRepairStatus;
window.openToolDetails = openToolDetails;

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
async function moveTool() {
  if (!toolsTableId) {
    showModal(`<h2>Move a Tool</h2><p style="color:#c0392b;">Tools table not configured.</p>`);
    return;
  }

  showModal(`
    <h2>Move a Tool</h2>
    <div class="form-group">
      <label>Search for tool to move</label>
      <input type="text" id="move-search-term" placeholder="Brand, category, type..." style="font-size: 24px; padding: 14px; width:100%;" />
      <p style="margin-top:10px; opacity:.75;">Press Enter to search.</p>
    </div>
    <div id="move-results" style="margin-top:16px;"></div>
  `);

  const input = document.getElementById("move-search-term");
  input.focus();
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await performMoveSearch();
  });
}

async function performMoveSearch() {
  const term = (document.getElementById("move-search-term")?.value || "").trim().toLowerCase();
  const out = document.getElementById("move-results");
  if (!out) return;

  if (!term) {
    out.innerHTML = `<p style="opacity:.8;">Type something to search.</p>`;
    return;
  }

  try {
    const resp = await apiCall(`/db/data/v1/${projectId}/${toolsTableId}?limit=500`);
    const rows = resp?.list || resp?.data || resp || [];

    const hits = rows.filter(r => {
      const brand = (r["Brand"] || "").toLowerCase();
      const cat = (r["Category"] || "").toLowerCase();
      const sub = (r["Sub Category"] || "").toLowerCase();
      const typ = (r["Type"] || "").toLowerCase();
      return brand.includes(term) || cat.includes(term) || sub.includes(term) || typ.includes(term);
    });

    if (!hits.length) {
      out.innerHTML = `<p>No matches.</p>`;
      return;
    }

    // Load locations
    let locations = [];
    if (locationsTableId) {
      try {
        const locResp = await apiCall(`/db/data/v1/${projectId}/${locationsTableId}`);
        locations = locResp?.list || locResp?.data || locResp || [];
      } catch (e) {
        console.error("Failed to load locations:", e);
      }
    }

    const locOptions = locations.map(l => `<option value="${l.Id || l.id}">${escapeHtml(l["Location Name"] || "Unknown")}</option>`).join("");

    out.innerHTML = hits.slice(0, 20).map(r => {
      const label = [r["Brand"], r["Size / Specs"], r["Type"], r["Sub Category"]].filter(Boolean).join(" • ");
      const id = r["Id"] || r["id"] || "";
      return `
        <div style="border:1px solid #ddd; padding:12px; margin:8px 0; border-radius:8px;">
          <p><strong>${escapeHtml(label || 'Tool')}</strong></p>
          <select id="move-loc-${id}" style="font-size:20px; padding:10px; width:100%; margin-top:8px;">
            <option value="">Select new location...</option>
            ${locOptions}
          </select>
          <button class="btn btn-primary" onclick="saveToolMove('${id}')" style="margin-top:8px; font-size:20px; padding:10px 20px;">Save Location</button>
        </div>
      `;
    }).join("");

    window.__moveSearchRows = rows;
  } catch (e) {
    console.error(e);
    out.innerHTML = `<p style="color:#c0392b;">Search failed. Check console.</p>`;
  }
}

async function saveToolMove(toolId) {
  const select = document.getElementById(`move-loc-${toolId}`);
  if (!select) return;

  const newLocationId = select.value;
  if (!newLocationId) {
    alert("Please select a location.");
    return;
  }

  try {
    await apiCall(`/db/data/v1/${projectId}/${toolsTableId}/${toolId}`, {
      method: 'PATCH',
      body: JSON.stringify({ 'Home Location': newLocationId })
    });
    showModal(`<h2>Success</h2><p>Tool location updated!</p>`);
    setTimeout(() => moveTool(), 1500);
  } catch (e) {
    console.error(e);
    alert("Failed to update location.");
  }
}

async function repairTool() {
  if (!toolsTableId) {
    showModal(`<h2>Repair a Tool</h2><p style="color:#c0392b;">Tools table not configured.</p>`);
    return;
  }

  showModal(`
    <h2>Repair a Tool</h2>
    <div id="repair-content" style="margin-top:16px;">
      <p>Loading tools that need repair...</p>
    </div>
  `);

  try {
    const resp = await apiCall(`/db/data/v1/${projectId}/${toolsTableId}?limit=500`);
    const rows = resp?.list || resp?.data || resp || [];
    const needsRepair = rows.filter(r => (r["Condition"] || "").toLowerCase().includes("repair"));

    const content = document.getElementById("repair-content");
    if (!needsRepair.length) {
      content.innerHTML = `<p style="color:#27ae60; font-size:20px;">✅ No tools need repair. Great job!</p>`;
      return;
    }

    content.innerHTML = `
      <p style="font-size:20px; margin-bottom:16px;"><strong>Found ${needsRepair.length} tool(s) needing repair:</strong></p>
      ${needsRepair.map(r => {
        const label = [r["Brand"], r["Size / Specs"], r["Type"], r["Sub Category"]].filter(Boolean).join(" • ");
        const id = r["Id"] || r["id"] || "";
        return `
          <div style="border:1px solid #ddd; padding:12px; margin:8px 0; border-radius:8px;">
            <p><strong>${escapeHtml(label || 'Tool')}</strong></p>
            <select id="repair-condition-${id}" style="font-size:20px; padding:10px; width:100%; margin-top:8px;">
              <option value="Good">Good</option>
              <option value="Worn">Worn</option>
              <option value="New">New</option>
              <option value="Needs Repair" selected>Needs Repair</option>
            </select>
            <button class="btn btn-primary" onclick="saveRepairStatus('${id}')" style="margin-top:8px; font-size:20px; padding:10px 20px;">Update Condition</button>
          </div>
        `;
      }).join("")}
    `;
  } catch (e) {
    console.error(e);
    const content = document.getElementById("repair-content");
    if (content) content.innerHTML = `<p style="color:#c0392b;">Failed to load tools. Check console.</p>`;
  }
}

async function saveRepairStatus(toolId) {
  const select = document.getElementById(`repair-condition-${toolId}`);
  if (!select) return;

  const newCondition = select.value;
  if (!newCondition) return;

  try {
    await apiCall(`/db/data/v1/${projectId}/${toolsTableId}/${toolId}`, {
      method: 'PATCH',
      body: JSON.stringify({ 'Condition': newCondition })
    });
    showModal(`<h2>Success</h2><p>Tool condition updated!</p>`);
    setTimeout(() => repairTool(), 1500);
  } catch (e) {
    console.error(e);
    alert("Failed to update condition.");
  }
}

async function inventoryOverview() {
  if (!toolsTableId) {
    showModal(`<h2>Inventory Overview</h2><p style="color:#c0392b;">Tools table not configured.</p>`);
    return;
  }

  showModal(`
    <h2>Inventory Overview</h2>
    <div id="overview-content" style="margin-top:16px;">
      <p>Loading statistics...</p>
    </div>
  `);

  try {
    const resp = await apiCall(`/db/data/v1/${projectId}/${toolsTableId}?limit=1000`);
    const rows = resp?.list || resp?.data || resp || [];

    const total = rows.length;
    const byCategory = {};
    const byCondition = {};
    let loanedOut = 0;
    let needsRepair = 0;

    rows.forEach(r => {
      const cat = r["Category"] || "Unknown";
      const cond = r["Condition"] || "Unknown";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      byCondition[cond] = (byCondition[cond] || 0) + 1;
      if (r["Loaned Out"]) loanedOut++;
      if ((cond || "").toLowerCase().includes("repair")) needsRepair++;
    });

    const content = document.getElementById("overview-content");
    content.innerHTML = `
      <div style="font-size:24px; margin-bottom:20px;">
        <strong>Total Tools: ${total}</strong>
      </div>
      <div style="font-size:20px; margin-bottom:16px;">
        <strong>Loaned Out: ${loanedOut}</strong><br>
        <strong>Need Repair: ${needsRepair}</strong>
      </div>
      <div style="margin-top:24px;">
        <h3 style="font-size:22px; margin-bottom:12px;">By Category:</h3>
        ${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => 
          `<p style="font-size:18px; margin:4px 0;">${escapeHtml(cat)}: ${count}</p>`
        ).join("")}
      </div>
      <div style="margin-top:24px;">
        <h3 style="font-size:22px; margin-bottom:12px;">By Condition:</h3>
        ${Object.entries(byCondition).map(([cond, count]) => 
          `<p style="font-size:18px; margin:4px 0;">${escapeHtml(cond)}: ${count}</p>`
        ).join("")}
      </div>
    `;
  } catch (e) {
    console.error(e);
    const content = document.getElementById("overview-content");
    if (content) content.innerHTML = `<p style="color:#c0392b;">Failed to load overview. Check console.</p>`;
  }
}

// Modal close handler
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

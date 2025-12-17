// Configuration
const API_BASE = "/api/v1/db"; // Proxied through Caddy to NocoDB // Proxied through Caddy to NocoDB

// Storage for configuration
let apiToken = "7511d065bc905dcebd199a2cfeaf472339cfcb4b15e29957";
let projectId = localStorage.getItem('nocodb_project_id') || '';
let toolsTableId = localStorage.getItem('nocodb_tools_table_id') || '';
let locationsTableId = localStorage.getItem('nocodb_locations_table_id') || '';
let columnMap = {}; // Maps field names to column IDs

// Taxonomy: Category -> Subcategory -> Type
const SUBCATEGORY_OPTIONS = {
    'Hand Tool': ['Wrenches', 'Screwdrivers', 'Hex/Allen', 'Pliers & Cutters', 'Hammers', 'Measuring & Layout', 'Other'],
    'Power Tool': ['Other'],
    'Measuring': ['Other'],
    'Fasteners': ['Other'],
    'Outdoor': ['Other'],
    'Electrical': ['Other'],
    'Plumbing': ['Other'],
    'Other': ['Other']
};

const TYPE_OPTIONS = {
    'Wrenches': ['Combination', 'Open-end', 'Box-end', 'Adjustable', 'Pipe', 'Crowfoot', 'Torque', 'Other'],
    'Screwdrivers': ['Phillips', 'Flat', 'Torx', 'Robertson', 'Precision', 'Nut driver', 'Other'],
    'Hex/Allen': ['L-keys', 'T-handle', 'Driver bits', 'Folding set', 'Other'],
    'Pliers & Cutters': ['Needle nose', 'Lineman', 'Slip joint', 'Channel lock', 'Side cutters', 'Locking (Vise-Grip)', 'Other'],
    'Hammers': ['Claw', 'Ball-peen', 'Dead blow', 'Mallet', 'Sledge', 'Other'],
    'Measuring & Layout': ['Tape measure', 'Speed square', 'Combination square', 'Level', 'Chalk line', 'Plumb bob', 'Other'],
    'Other': ['Other']
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

async function initializeApp() {
    // Check if we need to configure API token
    if (!apiToken) {
        /* token prompt disabled */
} else {
        await discoverTables();
    }
}

// Show API token configuration prompt
function showApiTokenPrompt() {
  return;
}


// Show settings
function showSettings() {
    showModal(`
        <h2 style="font-size: 36px; margin-bottom: 30px;">Settings</h2>
        <div class="form-group">
            <label>API Token:</label>
            <input type="text" id="settings-token" value="${apiToken ? '••••••••' : ''}" placeholder="Enter API token..." style="font-size: 24px; padding: 15px;">
            <p style="font-size: 20px; color: #7f8c8d; margin-top: 10px;">Find this in NocoDB: Settings > Token Management</p>
        </div>
        <div class="form-group">
            <label>Current Configuration:</label>
            <div style="font-size: 20px; padding: 15px; background-color: #ecf0f1; border-radius: 8px;">
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
    const newToken = document.getElementById('settings-token').value.trim();
    if (newToken && newToken !== '••••••••') {
        apiToken = newToken;
        localStorage.setItem('nocodb_api_token', apiToken);
    }
    
    // Clear cached IDs to force rediscovery
    projectId = '';
    toolsTableId = '';
    locationsTableId = '';
    localStorage.removeItem('nocodb_project_id');
    localStorage.removeItem('nocodb_tools_table_id');
    localStorage.removeItem('nocodb_locations_table_id');
    
    closeModal();
    showMessage('info', 'Settings saved. Rediscovering tables...');
    discoverTables();
}

function clearSettings() {
    if (confirm('Clear all settings? You will need to reconfigure the API token.')) {
        apiToken = '';
        projectId = '';
        toolsTableId = '';
        locationsTableId = '';
        localStorage.clear();
        closeModal();
        showMessage('info', 'Settings cleared.');
        /* token prompt disabled */
}
}

// Discover projects and tables
async function discoverTables() {
    try {
        // v1: get projects (bases)
        const basesResp = await apiCall('/meta/projects');
        const bases = (basesResp && Array.isArray(basesResp.list)) ? basesResp.list : basesResp;

        if (!bases || !Array.isArray(bases) || bases.length === 0) {
            showMessage('error', 'No bases found in NocoDB. Create a base first.');
            return;
        }

        // Pick the Tool Inventory base if present, otherwise first
        const base = bases.find(b => (b.title || '').toLowerCase().includes('tool')) || bases[0];
        projectId = base.id; // keep existing variable name to avoid refactors
        localStorage.setItem('nocodb_project_id', projectId);

        // v1: get tables for this project
        const tablesResp = await apiCall(`/meta/projects/${projectId}/tables`);
        const tables = (tablesResp && Array.isArray(tablesResp.list)) ? tablesResp.list : tablesResp;

        if (!tables || !Array.isArray(tables) || tables.length === 0) {
            showMessage('error', 'No tables found in this base. Create "Tools" and "Locations" tables in NocoDB.');
            return;
        }

        // Match by title first (recommended), fallback to table_name
        const toolsTable = tables.find(t => (t.title || '').toLowerCase() === 'tools')
            || tables.find(t => (t.table_name || '').toLowerCase().endswith('tools'));
        const locationsTable = tables.find(t => (t.title || '').toLowerCase() === 'locations')
            || tables.find(t => (t.table_name || '').toLowerCase().endswith('locations'));

        if (toolsTable) {
            toolsTableId = toolsTable.id;
            localStorage.setItem('nocodb_tools_table_id', toolsTableId);

            // Note: Column mapping disabled - not needed for basic functionality
            // Tables in v1 API include column info inline
        }

        if (locationsTable) {
            locationsTableId = locationsTable.id;
            localStorage.setItem('nocodb_locations_table_id', locationsTableId);
        }

        if (!toolsTable) {
            showMessage('error', 'Tools table not found. Please create a "Tools" table in NocoDB.');
        }
    } catch (error) {
        console.error('Discovery error:', error);
        showMessage('error', 'Could not connect to NocoDB. Please check your API token and try again.');
    }
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

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            // Token invalid, clear it
            apiToken = '';
            localStorage.removeItem('nocodb_api_token');
            /* token prompt disabled */
return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Main action functions
function findTool() {
    showModal(`
        <h2 style="font-size: 36px; margin-bottom: 30px;">Find a Tool</h2>
        <div class="form-group">
            <label for="search-term">Search for a tool:</label>
            <input type="text" id="search-term" placeholder="Search by brand, type, size, or category..." style="font-size: 28px; padding: 20px;" onkeyup="if(event.key==='Enter') performSearch()">
        </div>
        <div class="form-actions">
            <button class="btn btn-primary" onclick="performSearch()">Search</button>
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
        <div id="search-results" class="search-results"></div>
    `);
}

function addTool() {
    loadLocations().then(locations => {
        const locationOptions = locations.map(loc => 
            `<option value="${loc.Id}">${loc['Location Name'] || 'Unknown'}</option>`
        ).join('');
        
        showModal(`
            <h2 style="font-size: 36px; margin-bottom: 30px;">Add a Tool</h2>
            <form id="add-tool-form" onsubmit="saveNewTool(event)">
                <div class="form-group">
                    <label for="tool-category">Category *</label>
                    <select id="tool-category" required style="font-size: 24px; padding: 15px;" onchange="handleCategoryChange()">
                        <option value="">Select a category...</option>
                        <option value="Hand Tool">Hand Tool</option>
                        <option value="Power Tool">Power Tool</option>
                        <option value="Measuring">Measuring</option>
                        <option value="Fasteners">Fasteners</option>
                        <option value="Outdoor">Outdoor</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tool-subcategory">Sub Category</label>
                    <select id="tool-subcategory" style="font-size: 24px; padding: 15px;" onchange="handleSubcategoryChange()">
                        <option value="">Select subcategory...</option>
                    </select>
                </div>
                <div class="form-group" id="subcategory-other-group" style="display: none;">
                    <label for="subcategory-other">Specify subcategory</label>
                    <input type="text" id="subcategory-other" placeholder="Enter subcategory..." style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-type">Type</label>
                    <select id="tool-type" style="font-size: 24px; padding: 15px;" onchange="handleTypeChange()">
                        <option value="">Select type...</option>
                    </select>
                </div>
                <div class="form-group" id="type-other-group" style="display: none;">
                    <label for="type-other">Specify type</label>
                    <input type="text" id="type-other" placeholder="Enter type..." style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-brand">Brand</label>
                    <input type="text" id="tool-brand" style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-size">Size / Specs</label>
                    <input type="text" id="tool-size" placeholder="e.g., 1/2 inch, 10mm" style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-condition">Condition *</label>
                    <select id="tool-condition" required style="font-size: 24px; padding: 15px;">
                        <option value="">Select condition...</option>
                        <option value="New">New</option>
                        <option value="Good">Good</option>
                        <option value="Worn">Worn</option>
                        <option value="Needs Repair">Needs Repair</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tool-location">Home Location</label>
                    <select id="tool-location" style="font-size: 24px; padding: 15px;">
                        <option value="">None</option>
                        ${locationOptions}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Tool</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `);
    }).catch(() => {
        // Show form without locations if loading fails
        showModal(`
            <h2 style="font-size: 36px; margin-bottom: 30px;">Add a Tool</h2>
            <form id="add-tool-form" onsubmit="saveNewTool(event)">
                <div class="form-group">
                    <label for="tool-category">Category *</label>
                    <select id="tool-category" required style="font-size: 24px; padding: 15px;" onchange="handleCategoryChange()">
                        <option value="">Select a category...</option>
                        <option value="Hand Tool">Hand Tool</option>
                        <option value="Power Tool">Power Tool</option>
                        <option value="Measuring">Measuring</option>
                        <option value="Fasteners">Fasteners</option>
                        <option value="Outdoor">Outdoor</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tool-subcategory">Sub Category</label>
                    <select id="tool-subcategory" style="font-size: 24px; padding: 15px;" onchange="handleSubcategoryChange()">
                        <option value="">Select subcategory...</option>
                    </select>
                </div>
                <div class="form-group" id="subcategory-other-group" style="display: none;">
                    <label for="subcategory-other">Specify subcategory</label>
                    <input type="text" id="subcategory-other" placeholder="Enter subcategory..." style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-type">Type</label>
                    <select id="tool-type" style="font-size: 24px; padding: 15px;" onchange="handleTypeChange()">
                        <option value="">Select type...</option>
                    </select>
                </div>
                <div class="form-group" id="type-other-group" style="display: none;">
                    <label for="type-other">Specify type</label>
                    <input type="text" id="type-other" placeholder="Enter type..." style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-brand">Brand</label>
                    <input type="text" id="tool-brand" style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-size">Size / Specs</label>
                    <input type="text" id="tool-size" placeholder="e.g., 1/2 inch, 10mm" style="font-size: 24px; padding: 15px;">
                </div>
                <div class="form-group">
                    <label for="tool-condition">Condition *</label>
                    <select id="tool-condition" required style="font-size: 24px; padding: 15px;">
                        <option value="">Select condition...</option>
                        <option value="New">New</option>
                        <option value="Good">Good</option>
                        <option value="Worn">Worn</option>
                        <option value="Needs Repair">Needs Repair</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Tool</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `);
    });
}

// Handle category change to update subcategory options
function handleCategoryChange() {
    const categorySelect = document.getElementById('tool-category');
    const subcategorySelect = document.getElementById('tool-subcategory');
    const typeSelect = document.getElementById('tool-type');
    
    if (!categorySelect || !subcategorySelect) {
        return;
    }
    
    const category = categorySelect.value;
    
    // Clear subcategory and type
    subcategorySelect.innerHTML = '<option value="">Select subcategory...</option>';
    if (typeSelect) {
        typeSelect.innerHTML = '<option value="">Select type...</option>';
    }
    
    // Hide "Other" inputs
    const subcategoryOtherGroup = document.getElementById('subcategory-other-group');
    const typeOtherGroup = document.getElementById('type-other-group');
    if (subcategoryOtherGroup) subcategoryOtherGroup.style.display = 'none';
    if (typeOtherGroup) typeOtherGroup.style.display = 'none';
    
    // Populate subcategory options based on category
    if (category && SUBCATEGORY_OPTIONS[category]) {
        SUBCATEGORY_OPTIONS[category].forEach(subcat => {
            const option = document.createElement('option');
            option.value = subcat;
            option.textContent = subcat;
            subcategorySelect.appendChild(option);
        });
    }
    
    // Trigger subcategory change to update type options
    handleSubcategoryChange();
}

// Handle subcategory change to update type options and show/hide "Other" input
function handleSubcategoryChange() {
    const subcategorySelect = document.getElementById('tool-subcategory');
    const subcategoryOtherGroup = document.getElementById('subcategory-other-group');
    const subcategoryOtherInput = document.getElementById('subcategory-other');
    const typeSelect = document.getElementById('tool-type');
    
    if (!subcategorySelect) {
        return;
    }
    
    const subcategory = subcategorySelect.value;
    
    // Handle subcategory "Other" input
    if (subcategoryOtherGroup && subcategoryOtherInput) {
        if (subcategory === 'Other') {
            subcategoryOtherGroup.style.display = 'block';
            subcategoryOtherInput.required = true;
        } else {
            subcategoryOtherGroup.style.display = 'none';
            subcategoryOtherInput.required = false;
            subcategoryOtherInput.value = '';
        }
    }
    
    // Clear and update type options
    if (typeSelect) {
        typeSelect.innerHTML = '<option value="">Select type...</option>';
        
        // Hide type "Other" input
        const typeOtherGroup = document.getElementById('type-other-group');
        if (typeOtherGroup) typeOtherGroup.style.display = 'none';
        
        // Populate type options based on subcategory
        if (subcategory && TYPE_OPTIONS[subcategory]) {
            TYPE_OPTIONS[subcategory].forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                typeSelect.appendChild(option);
            });
        }
    }
}

// Handle type change to show/hide "Other" input
function handleTypeChange() {
    const typeSelect = document.getElementById('tool-type');
    const typeOtherGroup = document.getElementById('type-other-group');
    const typeOtherInput = document.getElementById('type-other');
    
    if (!typeSelect || !typeOtherGroup || !typeOtherInput) {
        return;
    }
    
    if (typeSelect.value === 'Other') {
        typeOtherGroup.style.display = 'block';
        typeOtherInput.required = true;
    } else {
        typeOtherGroup.style.display = 'none';
        typeOtherInput.required = false;
        typeOtherInput.value = '';
    }
}

function repairTool() {
    showModal(`
        <h2 style="font-size: 36px; margin-bottom: 30px;">Repair a Tool</h2>
        <div id="repair-message" class="message message-info">
            Loading tools that need repair...
        </div>
        <div id="repair-tools-list" class="search-results"></div>
    `);
    loadToolsNeedingRepair();
}

function moveTool() {
    loadLocations().then(locations => {
        const locationOptions = locations.map(loc => 
            `<option value="${loc.Id}">${loc['Location Name'] || 'Unknown'}</option>`
        ).join('');
        
        showModal(`
            <h2 style="font-size: 36px; margin-bottom: 30px;">Move a Tool</h2>
            <div class="form-group">
                <label for="move-search">Search for tool to move:</label>
                <input type="text" id="move-search" placeholder="Search by brand, type, size, or category..." style="font-size: 28px; padding: 20px;" onkeyup="searchToolsForMove(event)">
            </div>
            <div id="move-tools-list" class="search-results"></div>
            <div id="move-location-select" style="display: none; margin-top: 30px;">
                <div class="form-group">
                    <label for="new-location">New Location:</label>
                    <select id="new-location" style="font-size: 24px; padding: 15px;">
                        <option value="">None</option>
                        ${locationOptions}
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="saveToolMove()">Save Location</button>
                    <button class="btn btn-secondary" onclick="cancelToolMove()">Cancel</button>
                </div>
            </div>
        `);
    }).catch(() => {
        showModal(`
            <h2 style="font-size: 36px; margin-bottom: 30px;">Move a Tool</h2>
            <div class="form-group">
                <label for="move-search">Search for tool to move:</label>
                <input type="text" id="move-search" placeholder="Search by brand, type, size, or category..." style="font-size: 28px; padding: 20px;" onkeyup="searchToolsForMove(event)">
            </div>
            <div id="move-tools-list" class="search-results"></div>
        `);
    });
}

function inventoryOverview() {
    showModal(`
        <h2 style="font-size: 36px; margin-bottom: 30px;">Inventory Overview</h2>
        <div id="overview-content" class="message message-info">
            Loading inventory statistics...
        </div>
    `);
    loadInventoryOverview();
}

// Modal functions
function showModal(content) {
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
    selectedToolForMove = null;
}

// Search functionality
async function performSearch() {
    const searchTerm = document.getElementById('search-term').value.trim();
    const resultsDiv = document.getElementById('search-results');
    
    if (!searchTerm) {
        resultsDiv.innerHTML = '<div class="message message-error">Please enter a search term.</div>';
        return;
    }
    
    if (!toolsTableId) {
        resultsDiv.innerHTML = '<div class="message message-error">Tools table not configured. Please set up your NocoDB tables first.</div>';
        return;
    }
    
    resultsDiv.innerHTML = '<div class="message message-info">Searching...</div>';
    
    try {
        // Search tools across multiple fields (Brand, Sub Category, Size / Specs, Category)
        // NocoDB doesn't support OR queries easily, so we'll get all tools and filter client-side
        const response = await apiCall(`/data/v1/${projectId}/${toolsTableId}`);
        
        if (!response || !response.list) {
            resultsDiv.innerHTML = '<div class="message message-info">No tools found.</div>';
            return;
        }
        
        // Filter tools by search term across multiple fields
        const searchLower = searchTerm.toLowerCase();
        const tools = response.list.filter(tool => {
            const brand = (getFieldValue(tool, 'Brand') || '').toLowerCase();
            const subCategory = (getFieldValue(tool, 'Sub Category') || '').toLowerCase();
            const sizeSpec = (getFieldValue(tool, 'Size / Specs') || '').toLowerCase();
            const category = (getFieldValue(tool, 'Category') || '').toLowerCase();
            const displayName = computeDisplayName(tool).toLowerCase();
            
            return brand.includes(searchLower) || 
                   subCategory.includes(searchLower) || 
                   sizeSpec.includes(searchLower) || 
                   category.includes(searchLower) ||
                   displayName.includes(searchLower);
        });
        
        if (tools.length === 0) {
            resultsDiv.innerHTML = '<div class="message message-info">No tools found matching your search.</div>';
            return;
        }
        
        let html = `<div style="font-size: 24px; margin-bottom: 20px; font-weight: bold;">Found ${tools.length} tool(s):</div>`;
        tools.forEach(tool => {
            html += formatToolItem(tool);
        });
        resultsDiv.innerHTML = html;
    } catch (error) {
        resultsDiv.innerHTML = `<div class="message message-error">Error searching: ${error.message}</div>`;
    }
}

// Save new tool
async function saveNewTool(event) {
    event.preventDefault();
    
    if (!toolsTableId) {
        alert('Tools table not configured. Please set up your NocoDB tables first.');
        return;
    }
    
    const subcategory = document.getElementById('tool-subcategory').value;
    const subcategoryOtherInput = document.getElementById('subcategory-other');
    let subCategoryOther = '';
    
    if (subcategory === 'Other') {
        const subcategoryOtherValue = subcategoryOtherInput ? subcategoryOtherInput.value.trim() : '';
        if (!subcategoryOtherValue) {
            alert('Please specify the subcategory.');
            return;
        }
        subCategoryOther = subcategoryOtherValue;
    }
    
    const type = document.getElementById('tool-type').value;
    const typeOtherInput = document.getElementById('type-other');
    let typeValue = type || null;
    let typeOther = '';
    
    if (type === 'Other') {
        const typeOtherValue = typeOtherInput ? typeOtherInput.value.trim() : '';
        if (!typeOtherValue) {
            alert('Please specify the type.');
            return;
        }
        typeValue = typeOtherValue;
        typeOther = typeOtherValue;
    }
    
    const toolData = {
        'Category': document.getElementById('tool-category').value,
        'Sub Category': subcategory === 'Other' ? subCategoryOther : (subcategory || null),
        'Type': typeValue,
        'Brand': document.getElementById('tool-brand').value || null,
        'Size / Specs': document.getElementById('tool-size').value || null,
        'Condition': document.getElementById('tool-condition').value,
        'Home Location': document.getElementById('tool-location')?.value || null,
        'Sub Category Other': subCategoryOther,
        'Type Other': typeOther
    };
    
    try {
        const response = await apiCall(`/data/v1/${projectId}/${toolsTableId}`, {
            method: 'POST',
            body: JSON.stringify(toolData)
        });
        
        if (response) {
            showMessage('info', 'Tool saved successfully!');
            closeModal();
        }
    } catch (error) {
        alert(`Error saving tool: ${error.message}`);
    }
}

// Load tools needing repair
async function loadToolsNeedingRepair() {
    const listDiv = document.getElementById('repair-tools-list');
    const messageDiv = document.getElementById('repair-message');
    
    if (!toolsTableId) {
        messageDiv.innerHTML = '<div class="message message-error">Tools table not configured.</div>';
        return;
    }
    
    try {
        const response = await apiCall(`/data/v1/${projectId}/${toolsTableId}?where=(Condition,eq,Needs Repair)`);
        
        if (!response || !response.list || response.list.length === 0) {
            messageDiv.innerHTML = '<div class="message message-info">No tools need repair. Great job!</div>';
            listDiv.innerHTML = '';
            return;
        }
        
        messageDiv.innerHTML = `<div class="message message-info">Found ${response.list.length} tool(s) needing repair:</div>`;
        
        let html = '';
        response.list.forEach(tool => {
            html += `
                <div class="tool-item">
                    ${formatToolItem(tool)}
                    <div style="margin-top: 15px;">
                        <button class="btn btn-primary" onclick="markToolRepaired('${tool.Id}')" style="font-size: 20px; padding: 15px 25px;">
                            Mark as Repaired
                        </button>
                    </div>
                </div>
            `;
        });
        listDiv.innerHTML = html;
    } catch (error) {
        messageDiv.innerHTML = `<div class="message message-error">Error loading tools: ${error.message}</div>`;
    }
}

// Mark tool as repaired
async function markToolRepaired(toolId) {
    if (!confirm('Mark this tool as repaired? You can change the condition to "Good" or "Worn".')) {
        return;
    }
    
    const newCondition = prompt('Enter new condition:\n1. New\n2. Good\n3. Worn\n\nEnter the number or condition name:');
    if (!newCondition) return;
    
    let condition = newCondition.trim();
    if (condition === '1') condition = 'New';
    if (condition === '2') condition = 'Good';
    if (condition === '3') condition = 'Worn';
    
    try {
        await apiCall(`/data/v1/${projectId}/${toolsTableId}/${toolId}`, {
            method: 'PATCH',
            body: JSON.stringify({ 'Condition': condition })
        });
        
        showMessage('info', 'Tool condition updated!');
        loadToolsNeedingRepair(); // Refresh the list
    } catch (error) {
        alert(`Error updating tool: ${error.message}`);
    }
}

// Search tools for moving
let selectedToolForMove = null;

async function searchToolsForMove(event) {
    if (event.key !== 'Enter') return;
    
    const searchTerm = event.target.value.trim();
    const listDiv = document.getElementById('move-tools-list');
    
    if (!searchTerm) {
        listDiv.innerHTML = '';
        return;
    }
    
    if (!toolsTableId) {
        listDiv.innerHTML = '<div class="message message-error">Tools table not configured.</div>';
        return;
    }
    
    listDiv.innerHTML = '<div class="message message-info">Searching...</div>';
    
    try {
        // Search tools across multiple fields (Brand, Sub Category, Size / Specs, Category)
        const response = await apiCall(`/data/v1/${projectId}/${toolsTableId}`);
        
        if (!response || !response.list) {
            listDiv.innerHTML = '<div class="message message-info">No tools found.</div>';
            return;
        }
        
        // Filter tools by search term across multiple fields
        const searchLower = searchTerm.toLowerCase();
        const filteredTools = response.list.filter(tool => {
            const brand = (getFieldValue(tool, 'Brand') || '').toLowerCase();
            const subCategory = (getFieldValue(tool, 'Sub Category') || '').toLowerCase();
            const sizeSpec = (getFieldValue(tool, 'Size / Specs') || '').toLowerCase();
            const category = (getFieldValue(tool, 'Category') || '').toLowerCase();
            const displayName = computeDisplayName(tool).toLowerCase();
            
            return brand.includes(searchLower) || 
                   subCategory.includes(searchLower) || 
                   sizeSpec.includes(searchLower) || 
                   category.includes(searchLower) ||
                   displayName.includes(searchLower);
        });
        
        if (filteredTools.length === 0) {
            listDiv.innerHTML = '<div class="message message-info">No tools found.</div>';
            return;
        }
        
        let html = '';
        filteredTools.forEach(tool => {
            const displayName = computeDisplayName(tool);
            html += `
                <div class="tool-item" style="cursor: pointer;" onclick="selectToolForMove('${tool.Id}', '${displayName.replace(/'/g, "\\'")}')">
                    ${formatToolItem(tool)}
                    <div style="margin-top: 10px; color: #3498db; font-weight: bold;">Click to select this tool</div>
                </div>
            `;
        });
        listDiv.innerHTML = html;
    } catch (error) {
        listDiv.innerHTML = `<div class="message message-error">Error searching: ${error.message}</div>`;
    }
}

function selectToolForMove(toolId, toolName) {
    selectedToolForMove = toolId;
    const locationSelect = document.getElementById('move-location-select');
    if (locationSelect) {
        locationSelect.style.display = 'block';
        locationSelect.scrollIntoView({ behavior: 'smooth' });
    }
    showMessage('info', `Selected: ${toolName}`);
}

async function saveToolMove() {
    if (!selectedToolForMove) {
        alert('Please select a tool first.');
        return;
    }
    
    const newLocationId = document.getElementById('new-location')?.value || null;
    
    try {
        await apiCall(`/data/v1/${projectId}/${toolsTableId}/${selectedToolForMove}`, {
            method: 'PATCH',
            body: JSON.stringify({ 'Home Location': newLocationId })
        });
        
        showMessage('info', 'Tool location updated!');
        closeModal();
    } catch (error) {
        alert(`Error updating location: ${error.message}`);
    }
}

function cancelToolMove() {
    selectedToolForMove = null;
    const locationSelect = document.getElementById('move-location-select');
    if (locationSelect) {
        locationSelect.style.display = 'none';
    }
}

// Load inventory overview
async function loadInventoryOverview() {
    const contentDiv = document.getElementById('overview-content');
    
    if (!toolsTableId) {
        contentDiv.innerHTML = '<div class="message message-error">Tools table not configured.</div>';
        return;
    }
    
    try {
        // Get all tools
        const response = await apiCall(`/data/v1/${projectId}/${toolsTableId}`);
        
        if (!response || !response.list) {
            contentDiv.innerHTML = '<div class="message message-info">No tools in inventory.</div>';
            return;
        }
        
        const tools = response.list;
        const total = tools.length;
        
        // Count by category
        const byCategory = {};
        const byCondition = {};
        let loanedOut = 0;
        let needsRepair = 0;
        
        tools.forEach(tool => {
            const category = getFieldValue(tool, 'Category') || 'Unknown';
            const condition = getFieldValue(tool, 'Condition') || 'Unknown';
            
            byCategory[category] = (byCategory[category] || 0) + 1;
            byCondition[condition] = (byCondition[condition] || 0) + 1;
            
            if (getFieldValue(tool, 'Loaned Out')) loanedOut++;
            if (condition === 'Needs Repair') needsRepair++;
        });
        
        let html = `
            <div style="font-size: 28px; margin-bottom: 30px;">
                <strong>Total Tools: ${total}</strong>
            </div>
            <div style="font-size: 24px; margin-bottom: 20px;">
                <strong>Loaned Out: ${loanedOut}</strong>
            </div>
            <div style="font-size: 24px; margin-bottom: 20px;">
                <strong>Need Repair: ${needsRepair}</strong>
            </div>
            <div style="margin-top: 30px;">
                <h3 style="font-size: 28px; margin-bottom: 15px;">By Category:</h3>
        `;
        
        Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
            html += `<div style="font-size: 24px; margin-bottom: 10px;">${cat}: ${count}</div>`;
        });
        
        html += `
            </div>
            <div style="margin-top: 30px;">
                <h3 style="font-size: 28px; margin-bottom: 15px;">By Condition:</h3>
        `;
        
        Object.entries(byCondition).forEach(([cond, count]) => {
            html += `<div style="font-size: 24px; margin-bottom: 10px;">${cond}: ${count}</div>`;
        });
        
        html += '</div>';
        contentDiv.innerHTML = html;
    } catch (error) {
        contentDiv.innerHTML = `<div class="message message-error">Error loading overview: ${error.message}</div>`;
    }
}

// Load locations
async function loadLocations() {
    if (!locationsTableId) {
        return [];
    }
    
    try {
        const response = await apiCall(`/data/v1/${projectId}/${locationsTableId}`);
        return response?.list || [];
    } catch (error) {
        console.error('Error loading locations:', error);
        return [];
    }
}

// Get field value from tool object (handles different field name formats)
function getFieldValue(tool, fieldName) {
    // Try exact match first
    if (tool[fieldName] !== undefined) return tool[fieldName];
    
    // Try with different case variations
    const lowerField = fieldName.toLowerCase();
    for (const key in tool) {
        if (key.toLowerCase() === lowerField) {
            return tool[key];
        }
    }
    
    // Try column ID if we have it
    if (columnMap[fieldName] && tool[columnMap[fieldName]] !== undefined) {
        return tool[columnMap[fieldName]];
    }
    
    return null;
}

// Compute display name from existing fields
function computeDisplayName(tool) {
    const brand = getFieldValue(tool, 'Brand') || '';
    const sizeSpec = getFieldValue(tool, 'Size / Specs') || '';
    const toolType = getFieldValue(tool, 'Sub Category') || '';
    
    // Build display name from [brand, sizeSpec, toolType].filter(Boolean).join(" ")
    const parts = [brand, sizeSpec, toolType].filter(Boolean);
    if (parts.length > 0) {
        return parts.join(' ');
    }
    
    // Fallback: use category and/or tags
    const category = getFieldValue(tool, 'Category') || '';
    const tags = getFieldValue(tool, 'Tags') || '';
    const fallbackParts = [category, tags].filter(Boolean);
    return fallbackParts.length > 0 ? fallbackParts.join(' ') : 'Unnamed Tool';
}

// Format tool item for display
function formatToolItem(tool) {
    const displayName = computeDisplayName(tool);
    const category = getFieldValue(tool, 'Category') || 'Unknown';
    const condition = getFieldValue(tool, 'Condition') || 'Unknown';
    const brand = getFieldValue(tool, 'Brand') || '';
    const size = getFieldValue(tool, 'Size / Specs') || '';
    const subCategory = getFieldValue(tool, 'Sub Category') || '';
    const location = getFieldValue(tool, 'Home Location') || '';
    const loanedOut = getFieldValue(tool, 'Loaned Out') || false;
    
    return `
        <h3>${displayName}</h3>
        <p><strong>Category:</strong> ${category}</p>
        ${subCategory ? `<p><strong>Sub Category:</strong> ${subCategory}</p>` : ''}
        ${condition ? `<p><strong>Condition:</strong> ${condition}</p>` : ''}
        ${brand ? `<p><strong>Brand:</strong> ${brand}</p>` : ''}
        ${size ? `<p><strong>Size:</strong> ${size}</p>` : ''}
        ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
        <p><strong>Loaned Out:</strong> ${loanedOut ? 'Yes' : 'No'}</p>
    `;
}

// Helper function to show messages
function showMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = text;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.zIndex = '10000';
    messageDiv.style.minWidth = '300px';
    messageDiv.style.maxWidth = '90%';
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

# Tool Inventory Web App

A self-hosted, mobile-friendly tool inventory web application with a simple, senior-friendly custom frontend. Built on [NocoDB](https://nocodb.com/) (open-source Airtable alternative) for data management, with a clean interface featuring large, easy-to-use buttons.

## What This Is

A fast search tool database designed for easy access, especially for seniors. Features a simple custom frontend with large buttons for common actions:
- **Find a Tool** - Search for tools in your inventory
- **Add a Tool** - Add new tools to your collection
- **Repair a Tool** - View and update tools that need repair
- **Move a Tool** - Change a tool's location
- **Inventory Overview** - See your complete inventory

The frontend is designed to be dead simple—no hidden menus or complex navigation.

## Quick Start

### Local Development (Mac)

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Start the application:**
   ```bash
   ./scripts/dev-up.sh
   ```

3. **Access the application:**
   Open [http://localhost:8084](http://localhost:8084) in your browser to use the custom frontend.
   
   To access NocoDB directly (for setup/administration), you can access it through the API at `/api` or modify the Caddyfile routing.

4. **Stop the application:**
   ```bash
   ./scripts/dev-down.sh
   ```

### Production Deployment (Ubuntu Server)

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd tool-inventory
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` (optional):**
   - Set `NC_PUBLIC_URL` to your public URL if needed
   - Set `NC_AUTH_JWT_SECRET` to a strong random string for production

4. **Start the application:**
   ```bash
   ./scripts/prod-up.sh
   ```

5. **Access the application:**
   Open `http://SERVER_IP:18080` in your browser to use the custom frontend.
   
   To access NocoDB directly (for setup/administration), you can access it through the API at `/api` or modify the Caddyfile routing.

6. **Stop the application:**
   ```bash
   ./scripts/prod-down.sh
   ```

## API Setup

The custom frontend requires an API token to connect to NocoDB. Here's how to set it up:

1. **Access NocoDB directly:**
   - For development: Access NocoDB UI at `http://localhost:8084/nocodb`
   - This allows you to set up tables and generate API tokens

2. **Create an API Token:**
   - Log into NocoDB
   - Go to **Settings** (gear icon) → **Token Management**
   - Click **Generate New Token**
   - Copy the token (you'll only see it once!)

3. **Configure the Frontend:**
   - Open the custom frontend at `http://localhost:8084`
   - When prompted, paste your API token
   - The app will automatically discover your projects and tables
   - You can also access settings by clicking the ⚙️ button in the top-right corner

4. **Troubleshooting:**
   - If the app can't find your tables, make sure:
     - Your project is named something with "tool" in it (or it will use the first project)
     - Your tables are named exactly "Tools" and "Locations" (case-sensitive)
   - If API calls fail, check that your token is still valid in NocoDB settings

## Data Model

### Table: Locations

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| Location Name | Single line text | Yes | Name of the location |
| Path | Single line text | Yes | Hierarchical path, e.g., "Garage > Red Toolbox > Drawer 2" |
| Notes | Long text | No | Additional notes about the location |

### Table: Tools

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| Tool Name | Single line text | Yes | Name of the tool |
| Category | Single select | Yes | Options: Hand Tool, Power Tool, Measuring, Fasteners, Outdoor, Electrical, Plumbing, Other |
| Sub Category | Single line text | No | Examples: wrench, hammer, screwdriver, pliers |
| Brand | Single line text | No | Tool brand/manufacturer |
| Size / Specs | Single line text | No | Include imperial/metric notes |
| Condition | Single select | Yes | Options: New, Good, Worn, Needs Repair |
| Home Location | Link to Locations | No | Relationship to the Locations table |
| Loaned Out | Checkbox | No | Whether the tool is currently loaned out |
| Loan Note | Long text | No | Notes about who borrowed it, when, etc. |
| Tags | Multi-select | No | Custom tags for filtering |
| Last Updated | Auto timestamp | Auto | Automatically updated timestamp |

## Setting Up Tables in NocoDB

### Step 1: Create the Locations Table

1. After accessing NocoDB, you'll be prompted to create a project. Name it "Tool Inventory" or similar.
2. Click **"Add Table"** and name it **"Locations"**.
3. Add the following fields:
   - **Location Name**: 
     - Type: `Single line text`
     - Required: ✓
   - **Path**: 
     - Type: `Single line text`
     - Required: ✓
   - **Notes**: 
     - Type: `Long text`
     - Required: ✗

### Step 2: Create the Tools Table

1. Click **"Add Table"** again and name it **"Tools"**.
2. Add the following fields in order:

   - **Tool Name**: 
     - Type: `Single line text`
     - Required: ✓

   - **Category**: 
     - Type: `Single select`
     - Required: ✓
     - Options: `Hand Tool`, `Power Tool`, `Measuring`, `Fasteners`, `Outdoor`, `Electrical`, `Plumbing`, `Other`
     - (Add each option one by one in NocoDB's interface)

   - **Sub Category**: 
     - Type: `Single line text`
     - Required: ✗

   - **Brand**: 
     - Type: `Single line text`
     - Required: ✗

   - **Size / Specs**: 
     - Type: `Single line text`
     - Required: ✗

   - **Condition**: 
     - Type: `Single select`
     - Required: ✓
     - Options: `New`, `Good`, `Worn`, `Needs Repair`

   - **Home Location**: 
     - Type: `Link to another record`
     - Link to: `Locations` table
     - Required: ✗

   - **Loaned Out**: 
     - Type: `Checkbox`
     - Required: ✗

   - **Loan Note**: 
     - Type: `Long text`
     - Required: ✗

   - **Tags**: 
     - Type: `Multi-select`
     - Required: ✗

   - **Last Updated**: 
     - Type: `Created time` or `Last modified time`
     - (NocoDB will automatically track this)

### Step 3: Create Recommended Views

#### All Tools View
- This is the default view—no action needed.

#### Loaned Out View
1. In the **Tools** table, click **"Add View"** → **"Grid View"**.
2. Name it **"Loaned Out"**.
3. Click the filter icon and add:
   - Field: `Loaned Out`
   - Operator: `is equal`
   - Value: `true` (or checked)
4. Save the view.

#### Needs Repair View
1. In the **Tools** table, click **"Add View"** → **"Grid View"**.
2. Name it **"Needs Repair"**.
3. Click the filter icon and add:
   - Field: `Condition`
   - Operator: `is equal`
   - Value: `Needs Repair`
4. Save the view.

#### By Location View
1. In the **Tools** table, click **"Add View"** → **"Grid View"**.
2. Name it **"By Location"**.
3. Click the group icon and select:
   - Group by: `Home Location`
4. Save the view.

#### By Category View
1. In the **Tools** table, click **"Add View"** → **"Grid View"**.
2. Name it **"By Category"**.
3. Click the group icon and select:
   - Group by: `Category`
4. Save the view.

## Managing Repairs

### Viewing Tools That Need Repair

1. Navigate to the **Tools** table.
2. Select the **"Needs Repair"** view from the view dropdown.
3. All tools with `Condition = Needs Repair` will be displayed.

### Updating a Tool After Repair

1. In the **"Needs Repair"** view, click on the tool record you want to update.
2. Click the **Condition** field.
3. Change it from **"Needs Repair"** to the appropriate status (e.g., **"Good"** or **"Worn"**).
4. Save the record (changes are usually auto-saved in NocoDB).

The tool will automatically disappear from the "Needs Repair" view once its condition is updated.

## Backup

The `data/` folder contains the NocoDB database. To back up your data:

```bash
# Create a backup
tar -czf tool-inventory-backup-$(date +%Y%m%d).tar.gz data/

# Or simply copy the folder
cp -r data/ /path/to/backup/location/
```

**Important:** Always stop the containers before backing up the `data/` folder to ensure data consistency:

```bash
./scripts/dev-down.sh  # or prod-down.sh
# Then backup the data/ folder
./scripts/dev-up.sh    # or prod-up.sh
```

## Requirements

- Docker and Docker Compose installed
- For production: A server with Docker installed (Ubuntu recommended)

## Troubleshooting

- **Port already in use**: Change the port mapping in `docker-compose.yml` or `docker-compose.prod.yml`.
- **Permission errors**: Ensure Docker has proper permissions. On Linux, you may need to add your user to the docker group.
- **Data not persisting**: Verify the `data/` folder exists and has proper write permissions.

## License

This repository is provided as-is for personal use.


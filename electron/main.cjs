const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');
const { autoUpdater } = require('electron-updater');
const { initializeDatabase, hashPassword } = require('./dbInit.cjs');

let mainWindow;
let sqlPool = null;
let licensingPool = null;

// Cloud VPS database connection specifically for licensing checks (Option B)
const LIC_DB_CONFIG = {
  server: '152.239.115.119',
  port: 1438,
  database: 'fees_tracker',
  user: 'fees_client_user',
  password: 'ClientSecureAccess@99!',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 8000
  },
  pool: {
    max: 3,
    min: 0,
    idleTimeoutMillis: 15000
  }
};

async function getLicensingPool() {
  if (LIC_DB_CONFIG.server === 'YOUR_CLOUD_VPS_IP') {
    throw new Error('Licensing server IP is not configured. Please contact the administrator.');
  }
  if (!licensingPool) {
    licensingPool = await sql.connect(LIC_DB_CONFIG);
  }
  return licensingPool;
}

const configPath = path.join(app.getPath('userData'), 'db-config.json');
const licensePath = path.join(app.getPath('userData'), 'license.json');
const LICENSE_SALT = 'OrientFeesTrackerSystemSecretSalt2026!';

// Helper to load db config
function getDbConfig() {
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error('Failed to read config file', e);
    }
  }
  return null;
}

// Close SQL Pool on exit
async function closePool() {
  if (sqlPool) {
    try {
      await sqlPool.close();
      sqlPool = null;
    } catch (err) {
      console.error('Error closing SQL Pool', err);
    }
  }
  if (licensingPool) {
    try {
      await licensingPool.close();
      licensingPool = null;
    } catch (err) {
      console.error('Error closing Licensing SQL Pool', err);
    }
  }
}

// Connect to SQL Server
async function getPool(configOverride = null) {
  const config = configOverride || getDbConfig();
  if (!config) {
    throw new Error('Database connection configuration not found.');
  }

  // If there's an existing pool, close it first if configuring override
  if (configOverride && sqlPool) {
    await closePool();
  }

  if (!sqlPool || !sqlPool.connected) {
    if (sqlPool) {
      try {
        await sqlPool.close();
      } catch (e) {
        console.error('Error closing disconnected pool', e);
      }
      sqlPool = null;
    }

    const dbConfig = {
      server: config.server,
      port: parseInt(config.port) || 1433,
      database: config.database,
      user: config.user,
      password: config.password,
      options: {
        encrypt: config.encrypt !== false, // default true
        trustServerCertificate: config.trustServerCertificate !== false, // default true for local/VPN DBs
        enableArithAbort: true,
        connectTimeout: 60000, // Increased to 60s to survive extreme 1000ms ping latencies
        requestTimeout: 120000  // Increased to 120s to allow large reports to load over slow connections
      },
      pool: {
        max: 15,
        min: 0, // Reset to 0 to prevent connection startup lockups
        idleTimeoutMillis: 30000 // Revert to 30s to release idle local resources
      }
    };
    sqlPool = await sql.connect(dbConfig);
    
    try {
      const request = sqlPool.request();
      await request.query(`
        if exists (select * from sys.columns where object_id = object_id('students') and name = 'dob')
        begin
          alter table students alter column dob date null;
        end

        if not exists (select * from sysobjects where name='org_config' and xtype='U')
        begin
          create table org_config (
            id int primary key default 1 check (id = 1),
            org_name varchar(150) default 'GRACE BAPTIST CREDIT UNION' not null,
            location varchar(150) default 'AMAKOM-KUMASI' not null,
            telephone varchar(100) default 'TEL: 0244757447/0207447016' not null,
            school_name varchar(150) default 'Space Academy' not null,
            logo_url varchar(max) null
          );
          insert into org_config (org_name, location, telephone, school_name)
          values ('GRACE BAPTIST CREDIT UNION', 'AMAKOM-KUMASI', 'TEL: 0244757447/0207447016', 'Space Academy');
        end

        if not exists (select * from sysobjects where name='lic_keys' and xtype='U')
        begin
          create table lic_keys (
            id int identity(1,1) primary key,
            license_key varchar(100) unique not null,
            max_devices int default 1 not null,
            expiry_date date not null,
            is_active bit default 1 not null
          );
          insert into lic_keys (license_key, max_devices, expiry_date, is_active)
          values ('X89H2P9L3K5M7W1', 5, '2027-12-31', 1);
        end

        if not exists (select * from sysobjects where name='lic_activations' and xtype='U')
        begin
          create table lic_activations (
            id int identity(1,1) primary key,
            key_id int foreign key references lic_keys(id) on delete cascade not null,
            machine_id varchar(150) not null,
            activated_at datetime default getdate() not null,
            unique (key_id, machine_id)
          );
        end
      `);
      console.log('Startup database migrations executed successfully (dob nullable & org_config initialized).');
    } catch (migErr) {
      console.error('Failed to run startup migrations:', migErr);
    }
  }
  return sqlPool;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    frame: false, // Frameless window
    icon: path.join(__dirname, 'resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true
  });

  // Auto Updater Configuration
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', { status: 'checking', text: 'Checking for updates...' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', {
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes || 'Performance improvements and optimizations.',
        text: `Update version ${info.version} is available.`
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', { status: 'not-available', text: 'App is up to date.' });
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', { status: 'error', text: `Update error: ${err.message || 'Connection issue.'}` });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', {
        status: 'downloading',
        progressPercent: progressObj.percent,
        text: `Downloading... ${Math.round(progressObj.percent)}%`
      });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', {
        status: 'downloaded',
        text: 'Update downloaded. Ready to install.'
      });
    }
  });

  // Perform check a few seconds after application launch
  setTimeout(() => {
    // Only check for updates in packaged environment
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(e => console.error('Fail to check update', e));
    }
  }, 6000);

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await closePool();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window controls IPC
ipcMain.handle('win-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('win-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('win-close', () => {
  if (mainWindow) mainWindow.close();
});

// Update Control IPC
ipcMain.handle('upd-check', async () => {
  try {
    const res = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: res ? res.updateInfo : null };
  } catch (err) {
    console.error('Update check trigger error', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('upd-download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    console.error('Update download trigger error', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('upd-install', () => {
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    console.error('Update install trigger error', err);
    return { success: false, error: err.message };
  }
});

// IPC handlers
ipcMain.handle('db-check-config', () => {
  return getDbConfig() !== null;
});

ipcMain.handle('db-save-config', async (event, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    // Test the new connection right away
    await getPool(config);
    return { success: true };
  } catch (err) {
    console.error('Failed to save or connect config', err);
    // Delete bad config
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db-get-connection-info', async () => {
  try {
    const config = getDbConfig();
    if (!config) return { success: false, error: 'No connection configuration found.' };
    return {
      success: true,
      config: {
        server: config.server,
        port: config.port,
        database: config.database,
        user: config.user,
        encrypt: config.encrypt,
        trustServerCertificate: config.trustServerCertificate
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db-test-connection', async (event, config) => {
  const { performance } = require('perf_hooks');
  try {
    const tempPool = await sql.connect({
      server: config.server,
      port: parseInt(config.port) || 1433,
      database: config.database,
      user: config.user,
      password: config.password,
      options: {
        encrypt: config.encrypt !== false,
        trustServerCertificate: config.trustServerCertificate !== false,
        connectTimeout: 30000 // Increased to 30s to allow test connection negotiations over 1000ms ping
      }
    });

    const queryStart = performance.now();
    const result = await tempPool.request().query("SELECT 1 AS [test], (SELECT COUNT(*) FROM sysobjects WHERE name IN ('students', 'org_config', 'users')) AS [schema_check]");
    const latency = Math.round(performance.now() - queryStart);

    const tablesCount = result.recordset[0].schema_check;
    const isInitialized = tablesCount >= 2;

    await tempPool.close();

    let strength = 'Slow / Unstable';
    if (latency < 50) {
      strength = 'Excellent (Fast LAN/Local)';
    } else if (latency < 150) {
      strength = 'Good (Standard Remote)';
    } else if (latency < 300) {
      strength = 'Moderate (Slight Delay)';
    }

    return {
      success: true,
      latency,
      strength,
      isInitialized
    };
  } catch (err) {
    console.error('Test connection failed', err);
    return { success: false, error: err.message };
  }
});

// Generic safe parameterized SQL query execution
ipcMain.handle('db-query', async (event, { query, params }) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    
    if (params) {
      for (const param of params) {
        // Param format: { name: 'paramName', value: paramValue, type: 'VarChar' }
        if (param.type && sql[param.type]) {
          request.input(param.name, sql[param.type], param.value);
        } else {
          request.input(param.name, param.value);
        }
      }
    }
    
    const result = await request.query(query);
    return { success: true, recordset: result.recordset, rowsAffected: result.rowsAffected };
  } catch (err) {
    console.error('Database query error', err);
    return { success: false, error: err.message };
  }
});

// DB Initialization Handler
ipcMain.handle('db-initialize', async () => {
  try {
    const pool = await getPool();
    await initializeDatabase(pool);
    return { success: true };
  } catch (err) {
    console.error('Failed to initialize database schema', err);
    return { success: false, error: err.message };
  }
});

// Licensing IPC Handlers
ipcMain.handle('lic-get-machine-id', () => {
  try {
    return { success: true, machineId: machineIdSync({ original: true }) };
  } catch (err) {
    console.error('Failed to query machine ID', err);
    return { success: false, error: 'Could not fetch machine hardware fingerprint.' };
  }
});

ipcMain.handle('lic-check-active', () => {
  try {
    if (!fs.existsSync(licensePath)) {
      return { active: false, error: 'License file not found. Activation required.' };
    }
    const licData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    const currentMachineId = machineIdSync({ original: true });

    // Validate Signature to ensure it wasn't tampered with (include lastOpened in signature check)
    const expectedSig = crypto
      .createHmac('sha256', LICENSE_SALT)
      .update(licData.machineId + licData.expiryDate + licData.licenseKey + (licData.lastOpened || ''))
      .digest('hex');

    if (licData.signature !== expectedSig) {
      return { active: false, error: 'Invalid license signature. File may be corrupted or tampered with.' };
    }

    if (licData.machineId !== currentMachineId) {
      return { active: false, error: 'License mismatch. This key is registered to another machine.' };
    }

    // Anti-Rollback system clock tamper check
    const now = new Date();
    const lastOpened = licData.lastOpened ? new Date(licData.lastOpened) : null;
    if (lastOpened && now < lastOpened) {
      return { 
        active: false, 
        error: 'System clock tampering detected. The current time is behind the last recorded execution time. Please correct your system clock.' 
      };
    }

    // Expiry check
    const expiry = new Date(licData.expiryDate);
    if (now > expiry) {
      return { active: false, error: `License expired on ${expiry.toLocaleDateString('en-GB')}.` };
    }

    // Update the lastOpened timestamp to the current time, re-sign, and save locally
    licData.lastOpened = now.toISOString();
    licData.signature = crypto
      .createHmac('sha256', LICENSE_SALT)
      .update(licData.machineId + licData.expiryDate + licData.licenseKey + licData.lastOpened)
      .digest('hex');
    fs.writeFileSync(licensePath, JSON.stringify(licData, null, 2), 'utf8');

    return { active: true, info: { expiryDate: licData.expiryDate, licenseKey: licData.licenseKey } };
  } catch (err) {
    console.error('License verification failed', err);
    return { active: false, error: 'Error checking license validity.' };
  }
});

ipcMain.handle('lic-activate', (event, { licenseKey, expiryDate, signature }) => {
  try {
    const currentMachineId = machineIdSync({ original: true });

    // Re-verify signature
    const expectedSig = crypto
      .createHmac('sha256', LICENSE_SALT)
      .update(currentMachineId + expiryDate + licenseKey)
      .digest('hex');

    if (signature !== expectedSig) {
      return { success: false, error: 'Invalid activation code or signature for this machine.' };
    }

    // Save token
    const licInfo = {
      licenseKey,
      machineId: currentMachineId,
      expiryDate,
      signature
    };
    fs.writeFileSync(licensePath, JSON.stringify(licInfo, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('License activation error', err);
    return { success: false, error: err.message || 'Activation failed.' };
  }
});

ipcMain.handle('lic-activate-online', async (event, { licenseKey }) => {
  try {
    const currentMachineId = machineIdSync({ original: true });

    // Connect to secure licensing VPS database
    const pool = await getLicensingPool();
    
    // Check if key is valid, active, and get limits/expiry
    const keyReq = pool.request();
    keyReq.input('license_key', sql.VarChar(100), licenseKey);
    const keyRes = await keyReq.query(`
      SELECT id, max_devices, expiry_date, is_active 
      FROM lic_keys 
      WHERE license_key = @license_key
    `);

    if (keyRes.recordset.length === 0) {
      return { success: false, error: 'Invalid license key. Please check spelling.' };
    }

    const keyData = keyRes.recordset[0];
    if (!keyData.is_active) {
      return { success: false, error: 'This license key has been deactivated.' };
    }

    // Get secure time directly from the Cloud VPS database to prevent system clock tampering
    const timeRes = await pool.request().query('SELECT GETDATE() AS server_time');
    const vpsTime = new Date(timeRes.recordset[0].server_time);

    const expiry = new Date(keyData.expiry_date);
    if (vpsTime > expiry) {
      return { success: false, error: `This license expired on ${expiry.toLocaleDateString('en-GB')}.` };
    }

    // Check existing devices registered for this key
    const actReq = pool.request();
    actReq.input('key_id', sql.Int, keyData.id);
    const actRes = await actReq.query(`
      SELECT machine_id 
      FROM lic_activations 
      WHERE key_id = @key_id
    `);

    const registeredDevices = actRes.recordset.map(r => r.machine_id);
    const isAlreadyActivated = registeredDevices.includes(currentMachineId);

    if (!isAlreadyActivated) {
      if (registeredDevices.length >= keyData.max_devices) {
        return { 
          success: false, 
          error: `Activation limit reached (${keyData.max_devices} devices max). Deactivate another workstation first.` 
        };
      }

      // Register this workstation machine ID
      const regReq = pool.request();
      regReq.input('key_id', sql.Int, keyData.id);
      regReq.input('machine_id', sql.VarChar(150), currentMachineId);
      await regReq.query(`
        INSERT INTO lic_activations (key_id, machine_id) 
        VALUES (@key_id, @machine_id)
      `);
    }

    // Format expiry date for local token payload (YYYY-MM-DD)
    const expiryStr = expiry.toISOString().split('T')[0];
    const lastOpenedStr = vpsTime.toISOString();

    // Compute cryptographic signature including the initial activation time
    const signature = crypto
      .createHmac('sha256', LICENSE_SALT)
      .update(currentMachineId + expiryStr + licenseKey + lastOpenedStr)
      .digest('hex');

    // Save token locally for offline checks
    const licInfo = {
      licenseKey,
      machineId: currentMachineId,
      expiryDate: expiryStr,
      lastOpened: lastOpenedStr,
      signature
    };
    fs.writeFileSync(licensePath, JSON.stringify(licInfo, null, 2), 'utf8');

    // Automate Task Scheduler daily backups for local database setups
    const dbConfig = getDbConfig();
    if (dbConfig) {
      const isLocalHost = 
        dbConfig.server === 'localhost' || 
        dbConfig.server === '127.0.0.1' || 
        dbConfig.server === '.' || 
        dbConfig.server.startsWith('192.168.') || 
        dbConfig.server.startsWith('10.') || 
        dbConfig.server.startsWith('172.');

      if (isLocalHost) {
        console.log('Local database configuration detected. Extracting and registering scheduled backup task...');
        const { exec } = require('child_process');
        try {
          const originalScriptPath = path.join(__dirname, 'resources/setup-backup-task.ps1');
          const tempScriptPath = path.join(app.getPath('temp'), 'setup-backup-task.ps1');
          const scriptContent = fs.readFileSync(originalScriptPath, 'utf8');
          fs.writeFileSync(tempScriptPath, scriptContent, 'utf8');

          const cmd = `powershell.exe -ExecutionPolicy Bypass -File "${tempScriptPath}"`;
          exec(cmd, (execErr, stdout, stderr) => {
            // Clean up temp file
            try { fs.unlinkSync(tempScriptPath); } catch (e) {}
            if (execErr) {
              console.error('Failed to register scheduled backup task:', execErr);
            } else {
              console.log('Automated scheduled backup task registered successfully:', stdout);
            }
          });
        } catch (readErr) {
          console.error('Failed to prepare or run backup setup script:', readErr);
        }
      }
    }

    return { success: true, expiryDate: expiryStr };
  } catch (err) {
    console.error('Online license activation error', err);
    return { success: false, error: err.message || 'Connection timeout or database activation failure.' };
  }
});

// Secure Login Handler
ipcMain.handle('auth-login', async (event, { username, password }) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('username', sql.VarChar(50), username);
    
    const result = await request.query('SELECT id, username, password_hash, role, is_active FROM users WHERE username = @username');
    if (result.recordset.length === 0) {
      return { success: false, error: 'Invalid username or password.' };
    }
    
    const user = result.recordset[0];
    if (!user.is_active) {
      return { success: false, error: 'Account is deactivated. Contact administrator.' };
    }
    
    const inputHash = hashPassword(password);
    if (inputHash !== user.password_hash) {
      return { success: false, error: 'Invalid username or password.' };
    }
    
    return { 
      success: true, 
      user: { id: user.id, username: user.username, role: user.role } 
    };
  } catch (err) {
    console.error('Auth login error', err);
    return { success: false, error: err.message };
  }
});

// Bulk Import Students Transaction Handler
ipcMain.handle('db-bulk-import-students', async (event, { studentsList, deactivateLeavers, creatorId }) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    
    let added = 0;
    let updated = 0;
    const importedIds = [];
    
    for (const student of studentsList) {
      importedIds.push(student.student_id);
      
      const checkReq = new sql.Request(transaction);
      checkReq.input('chk_id', sql.VarChar(50), student.student_id);
      const checkRes = await checkReq.query('SELECT id FROM students WHERE student_id = @chk_id');
      
      const reqUpsert = new sql.Request(transaction);
      reqUpsert.input('student_id', sql.VarChar(50), student.student_id);
      reqUpsert.input('full_name', sql.VarChar(150), student.full_name);
      reqUpsert.input('dob', sql.Date, student.dob || null);
      reqUpsert.input('grade_class', sql.VarChar(50), student.grade_class.toUpperCase());
      reqUpsert.input('guardian_phone', sql.VarChar(20), student.guardian_phone);
      
      if (checkRes.recordset.length > 0) {
        await reqUpsert.query(`
          UPDATE students 
          SET full_name = @full_name, dob = @dob, grade_class = @grade_class, guardian_phone = @guardian_phone, is_active = 1
          WHERE student_id = @student_id
        `);
        updated++;
      } else {
        await reqUpsert.query(`
          INSERT INTO students (student_id, full_name, dob, grade_class, guardian_phone, is_active)
          VALUES (@student_id, @full_name, @dob, @grade_class, @guardian_phone, 1)
        `);
        added++;
      }
    }
    
    let deactivatedCount = 0;
    if (deactivateLeavers && importedIds.length > 0) {
      const leaverReq = new sql.Request(transaction);
      const escapedIds = importedIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
      const dRes = await leaverReq.query(`
        UPDATE students 
        SET is_active = 0 
        WHERE student_id NOT IN (${escapedIds}) AND is_active = 1
      `);
      deactivatedCount = dRes.rowsAffected[0] || 0;
    }
    
    await transaction.commit();
    return { success: true, added, updated, deactivated: deactivatedCount };
  } catch (err) {
    await transaction.rollback();
    console.error('Bulk import transaction failed, rolled back', err);
    return { success: false, error: err.message };
  }
});

// App print capabilities
ipcMain.handle('print-receipt', async (event, htmlContent, options = {}) => {
  // Create an offscreen window to render and print
  let workerWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false
    }
  });

  workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  
  return new Promise((resolve) => {
    workerWindow.webContents.once('did-finish-load', () => {
      // Print options customized for A5 / A4 / Thermal
      workerWindow.webContents.print({
        silent: false, // Open system printer settings/preview dialog
        printBackground: true,
        pageSize: options.pageSize || 'A5',
        margins: { marginType: 'default' }
      }, (success, failureReason) => {
        workerWindow.close();
        workerWindow = null;
        if (success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: failureReason });
        }
      });
    });
  });
});

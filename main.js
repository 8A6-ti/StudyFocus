const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('node:path');
const axios = require('axios');
const iconPath = path.join(__dirname, "build", "icon.png");

let splashWindow;
let mainWindow;
let dynIsland;
let notifOverlay;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    center: true,
    hasShadow: false,
    show: true,
    titleBarStyle: 'hidden',
    icon: iconPath
  });

  splashWindow.loadFile('splash.html');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: iconPath
  });

  mainWindow.loadURL('http://localhost:5000');

  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });
  ipcMain.on('maximize', () => {
    if (mainWindow) {
      mainWindow.setResizable(false);
      mainWindow.setBounds({ width: 1280, height: 720 }); 
      mainWindow.center();
    }
  });
  ipcMain.on('unmaximize', () => {
    if (mainWindow) {
      mainWindow.setResizable(true);
      mainWindow.setBounds({ width: 800, height: 600 }); 
      mainWindow.center();
    }
  });
  ipcMain.on('open-dynisland', () => {
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    createDynIsland();
  });
  ipcMain.on('open-notification-overlay', () => {
    createNotificationOverlay();
  });
}

function createDynIsland() {
  if (dynIsland) return;

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();

  dynIsland = new BrowserWindow({
    width: primaryDisplay.bounds.width,
    height: 100,
    x: 0,
    y: 0,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dynIsland.setIgnoreMouseEvents(true, { forward: true });

  dynIsland.loadURL('http://localhost:5000/dynisland.html');

  dynIsland.on('closed', () => {
    dynIsland = null;
  });
}

function createNotificationOverlay() {
  if (notifOverlay) return;

  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  
  notifOverlay = new BrowserWindow({
    width: 325,  
    height: 600, 
    x: display.bounds.width - 330,
    y: 5, 
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000", 
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  notifOverlay.setIgnoreMouseEvents(false);
  notifOverlay.loadURL('http://localhost:5000/notioverlay.html');

  notifOverlay.on('closed', () => {
    notifOverlay = null;
  });

  notifOverlay.webContents.once('did-finish-load', () => {
    // // Get actual content size and resize window
    // notifOverlay.webContents.executeJavaScript(`
    //   document.querySelector('.overlay-container').getBoundingClientRect();
    // `).then(rect => {
    //   notifOverlay.setBounds({
    //     width: Math.ceil(rect.width),
    //     height: Math.ceil(rect.height),
    //     x: display.bounds.width - Math.ceil(rect.width) - 20,
    //     y: display.bounds.height - Math.ceil(rect.height) - 40
    //   });
    // });

    // Fetch data and inject it
    axios.get('http://localhost:5000/api/getdata/all')
      .then(res => {
        const data = res.data;
        notifOverlay.webContents.executeJavaScript(`
          if (window && typeof window.updateOverlayData === 'function') {
            window.updateOverlayData(${JSON.stringify(data)});
          }
        `);
      })
      .catch(err => {
        console.error("Failed to fetch overlay data:", err.message);
      });
  });
}

app.whenReady().then(() => {
  createSplash();

  setTimeout(() => {
    createMainWindow();
    splashWindow.close();
  }, 3000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

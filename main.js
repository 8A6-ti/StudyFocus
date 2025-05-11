const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const os = require('node:os');
const path = require('node:path');
const axios = require('axios');
const iconPath = path.join(__dirname, "build", "icon.png");
const appPath = path.join(process.resourcesPath, 'studyfocus.exe');

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
  ipcMain.on('open-notification-overlay', () => {
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    createNotificationOverlay();
  });
}

function createNotificationOverlay() {
  if (notifOverlay) return;

  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  
  notifOverlay = new BrowserWindow({
    width: 325,  
    height: 145, 
    x: display.bounds.width - 330,
    y: 5, 
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000", 
    resizable: false,
    // skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: iconPath
  });

  notifOverlay.setIgnoreMouseEvents(false);
  notifOverlay.loadURL('http://localhost:5000/notioverlay.html');

  notifOverlay.on('closed', () => {
    notifOverlay = null;
  });

  ipcMain.on('hover-notif-overlay', () => {
    notifOverlay.setBounds({ width: 325, height: 425 });
  });

  ipcMain.on('notif-overlay', () => {
    notifOverlay.setBounds({ width: 325, height: 145 });
  });

  ipcMain.on('warn-notif-overlay', () => {
    notifOverlay.setBounds({ width: 325, height: 200 });
  });

  ipcMain.on('notif-overlay-close', () => {
    app.quit();
  });

  notifOverlay.webContents.once('did-finish-load', () => {
    // old, this probably does something =))
    // please dont touch cause it works
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
  console.log("splash screen");
  console.log(process.resourcesPath);
  spawn(path.join(process.resourcesPath, 'studyfocussystemcontroller.exe'), [], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  createSplash();
  // python file exec
  
  console.log("starting app")  
  console.log("platform: " + os.platform() + " build: " + os.release() + " os name: " + os.version() + " machine: " + os.machine());
  // check if system is windows
  if (os.platform() !== "win32") {
    dialog.showErrorBox("Unsupported OS", "StudyFocus is only supported on Windows.");
    app.quit();
  }

  setTimeout(() => {
    createMainWindow();
    splashWindow.close();
  }, 3000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', function () {
  axios.get('http://localhost:5000/api/byebye');
  if (process.platform !== 'darwin') app.quit();
});

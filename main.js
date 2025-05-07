const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
const os = require('node:os');
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

  notifOverlay.webContents.once('did-finish-load', () => {
    // // get actual content size and resize window
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
    // what is this for i forgot lol
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
  // python file exec
  // make later since no embedded python in the app
  // also remember to join path to file
  // exec('python path/to/python/file.py', (error, stdout, stderr) => {

  // console.log(os.platform() + os.release() + os.version() + os.machine());
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
  if (process.platform !== 'darwin') app.quit();
});

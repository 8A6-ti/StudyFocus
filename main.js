const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('node:path');
const iconPath = path.join(__dirname, "build", "icon.png");

let splashWindow;
let mainWindow;
let dynIsland;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    center: true,
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
      // mainWindow.maximize();
      mainWindow.setResizable(false);
      mainWindow.setBounds({ width: 1280, height: 720 }); 
      mainWindow.center();
    }
  });
  ipcMain.on('unmaximize', () => {
    if (mainWindow) {
      // mainWindow.unmaximize();
      mainWindow.setResizable(true);
      mainWindow.setBounds({ width: 800, height: 600 }); 
      mainWindow.center();
    }
  });
  ipcMain.on('open-dynisland', () => {  // init new window for dynisland
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    createDynIsland();
  });
}

function createDynIsland() {  // fullscreen but clickthru
  if (dynIsland) return;

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const screenWidth = primaryDisplay.bounds.width;

  dynIsland = new BrowserWindow({
    width: 600,
    height: 40,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true, // dont show on taskbar - uncomment on release
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  dynIsland.setIgnoreMouseEvents(true, { forward: true });
  dynIsland.maximize();
  dynIsland.loadURL('http://localhost:5000/dynisland.html');

  dynIsland.on('closed', () => {
    dynIsland = null;
  });
}

app.whenReady().then(() => {
  createSplash();

  // uncomment on release - exec py or compiled exe

  // exec('py main.py', (err, stdout, stderr) => {
  //   if (err) {
  //     console.error(`err: ${err.message}`);
  //     return;
  //   }
  // });


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

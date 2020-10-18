'use strict'

import { app, protocol, BrowserWindow, ipcMain ,nativeImage} from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'

const http = require('http');
const path = require('path')

const isDevelopment = process.env.NODE_ENV !== 'production'

let RpcConfig = {
  user: '',
  pass: '',
  host: '127.0.0.1',
  port: 17577
};

function runRpc(cmd) {
  return new Promise((resolve, reject) => {

    const options = {
      host: RpcConfig.host,
      path: '/',
      method: 'POST',
      port: RpcConfig.port
    };

    const req = http.request(options, function (res) {

      let buf = '';
      res.on('data', function (data) {
        buf += data;
      });

      res.on('end', function () {
        if (res.statusCode === 401) {
          reject('Connection Rejected: 401 Unauthorized. Please check user/pass')
        } else if (res.statusCode === 403) {
          reject('Connection Rejected: 403 Forbidden')
        } else if (res.statusCode === 500) {
          reject(buf.toString('utf8'))
        } else {
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            console.log(e.stack);
            console.log(buf);
            reject(`HTTP Status code: ${res.statusCode}`);
          }
        }
      });
    });

    req.on('error', function (e) {  
      reject(`Request Error: ${e.message}`)
    });

    const request = JSON.stringify(cmd);

    req.setHeader('Content-Length', request.length);
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Authorization', 'Basic ' + Buffer.from(`${RpcConfig.user}:${RpcConfig.pass}`).toString('base64'));
    req.write(request);
    req.end();
  });
}

ipcMain.handle('RpcConfig', (event, cfg) => {
  if(cfg)
    RpcConfig = cfg
  
  return RpcConfig
})

ipcMain.handle('rpc', async(event, cmd) => {
  try {
    const x = await runRpc(cmd)
    return {'success': true, 'result': x}
  } catch (error) {
    return {'success': false, 'result': error}
  }
})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
//global.sharedObj = {prop1: null};

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 850,
    height: 680,
    frame: true, 
    icon: nativeImage.createFromPath(path.join(__dirname, 'assets/kyanlogo64.png')),
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.removeMenu();

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    //if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }

  win.on('closed', () => {
    win = null
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

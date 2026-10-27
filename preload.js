const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  openDashboard: () => ipcRenderer.send("open-dashboard"),
  showReminder: () => ipcRenderer.send("show-reminder"),
  closeReminder: () => ipcRenderer.send("close-reminder"),
  fetchCalendar: (url, fromISO, toISO) => ipcRenderer.invoke("calendar-fetch", url, fromISO, toISO),
  fetchFeed: url => ipcRenderer.invoke("fetch-feed", url),
  getAutoStart: () => ipcRenderer.invoke("autostart-get"),
  autoBackup: data => ipcRenderer.invoke("backup-auto", data),
  listBackups: () => ipcRenderer.invoke("backup-list"),
  openBackupFolder: () => ipcRenderer.invoke("backup-folder"),
  exportBackup: data => ipcRenderer.invoke("backup-export", data),
  importBackup: () => ipcRenderer.invoke("backup-import"),
  checkForUpdates: () => ipcRenderer.invoke("update-check"),
  buddyMenu: () => ipcRenderer.send("buddy-menu"),
  setAutoStart: on => ipcRenderer.invoke("autostart-set", on),
});

const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const calendar = require("./calendar");
let autoUpdater = null;
try { ({ autoUpdater } = require("electron-updater")); } catch (e) {}

// Transparent windows on Linux need this switch.
if (process.platform === "linux") app.commandLine.appendSwitch("enable-transparent-visuals");
if (!app.requestSingleInstanceLock()) app.quit();

// The desktop player is a third of its old 240x340 size.
const BUDDY_W = 80, BUDDY_H = 112;
const REMIND_W = 420, REMIND_H = 230;
let dashboard = null, buddy = null, reminder = null, tray = null, quitting = false;
// buddySpot is where the person dragged the player; null means "the default corner".
let cfg = { onTop: true, showBuddy: true, buddyScreen: "second", buddySpot: null, firstRunDone: false, autoStart: true };

const cfgFile = () => path.join(app.getPath("userData"), "settings.json");
function loadCfg() { try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), "utf8")) }; } catch (e) {} }
function saveCfg() { try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)); } catch (e) {} }
const webPreferences = { preload: path.join(__dirname, "preload.js") };
const loginSupported = process.platform === "win32" || process.platform === "darwin";
// Launched by Windows at sign-in: start quietly with just the desktop player.
const startedAtLogin = process.argv.includes("--hidden") || (process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin);

// Start with the computer. Re-registered on every launch so it keeps pointing at the installed app after updates.
function applyAutoStart() {
  if (!loginSupported || !app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: cfg.autoStart !== false, openAsHidden: true, path: process.execPath, args: ["--hidden"] });
}
const autoStartOn = () => loginSupported && app.isPackaged && app.getLoginItemSettings({ path: process.execPath, args: ["--hidden"] }).openAtLogin;
function setAutoStart(on) { cfg.autoStart = !!on; saveCfg(); applyAutoStart(); buildMenu(); }

// Links (news articles, calendar) open in the normal web browser, never inside the app.
function keepLinksOutside(win) {
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); } });
}

// News feeds the app may read. Anything else is refused.
const FEED_HOSTS = new Set(["flipboard.com", "news.google.com", "feeds.npr.org", "www.theguardian.com", "feeds.bbci.co.uk"]);
async function fetchFeed(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !FEED_HOSTS.has(url.hostname)) throw new Error("That news source isn't allowed.");
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PitchPal", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`The feed answered with error ${res.status}.`);
  return res.text();
}

function openDashboard() {
  if (dashboard) { dashboard.show(); dashboard.focus(); return; }
  dashboard = new BrowserWindow({
    width: 1240, height: 860, minWidth: 420, title: "Pitch Pal",
    backgroundColor: "#0f1029", autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"), webPreferences,
  });
  keepLinksOutside(dashboard);
  dashboard.loadFile(path.join(__dirname, "index.html"));
  // Closing the dashboard only hides it; the app keeps running in the tray.
  dashboard.on("close", e => { if (!quitting) { e.preventDefault(); dashboard.hide(); } });
}

function onSomeScreen(p) {
  return p && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return p.x >= a.x - 50 && p.y >= a.y - 50 && p.x + BUDDY_W <= a.x + a.width + 50 && p.y + BUDDY_H <= a.y + a.height + 50;
  });
}

// Default corner: bottom-left of the second monitor, or of the main one when there's only one.
function buddyCorner() {
  const primary = screen.getPrimaryDisplay();
  const second = screen.getAllDisplays().find(d => d.id !== primary.id);
  const wa = (cfg.buddyScreen === "second" && second ? second : primary).workArea;
  return { x: wa.x + 12, y: wa.y + wa.height - BUDDY_H - 4 };
}
let userMoving = false;
function placeBuddy() {
  if (!buddy) return;
  const p = onSomeScreen(cfg.buddySpot) ? cfg.buddySpot : buddyCorner();
  buddy.setBounds({ x: p.x, y: p.y, width: BUDDY_W, height: BUDDY_H });
}

function createBuddy() {
  const pos = onSomeScreen(cfg.buddySpot) ? cfg.buddySpot : buddyCorner();
  buddy = new BrowserWindow({
    x: pos.x, y: pos.y, width: BUDDY_W, height: BUDDY_H,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: cfg.onTop, show: false,
    backgroundColor: "#00000000", webPreferences,
  });
  buddy.loadFile(path.join(__dirname, "widget.html"));
  buddy.once("ready-to-show", () => { if (cfg.showBuddy) buddy.showInactive(); });
  if (cfg.onTop) buddy.setAlwaysOnTop(true, "floating");
  // Only remember positions the person dragged to, not our own repositioning.
  buddy.on("will-move", () => { userMoving = true; });
  buddy.on("moved", () => {
    if (!userMoving) return;
    userMoving = false;
    const [x, y] = buddy.getPosition(); cfg.buddySpot = { x, y }; saveCfg();
  });
  buddy.on("close", e => { if (!quitting) { e.preventDefault(); buddy.hide(); cfg.showBuddy = false; saveCfg(); buildMenu(); } });
  // Right-clicking the draggable player opens Windows' own window menu; show ours instead.
  buddy.on("system-context-menu", e => { e.preventDefault(); showBuddyMenu(); });
}

// Daily reminder: a small popup in the bottom-left corner of the main screen.
function showReminder() {
  if (reminder) reminder.destroy();
  const wa = screen.getPrimaryDisplay().workArea;
  reminder = new BrowserWindow({
    x: wa.x + 16, y: wa.y + wa.height - REMIND_H - 16, width: REMIND_W, height: REMIND_H,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: true, show: false,
    backgroundColor: "#00000000", webPreferences,
  });
  reminder.setAlwaysOnTop(true, "pop-up-menu");
  reminder.loadFile(path.join(__dirname, "reminder.html"));
  reminder.once("ready-to-show", () => reminder && reminder.showInactive());
  reminder.on("closed", () => { reminder = null; });
}

// ---------- backups ----------
const backupDir = () => path.join(app.getPath("userData"), "backups");
const today = () => new Date().toISOString().slice(0, 10);
function autoBackup(data) {
  try {
    fs.mkdirSync(backupDir(), { recursive: true });
    const file = path.join(backupDir(), `pitchpal-${today()}.json`);
    fs.writeFileSync(file, data);
    // keep the newest 14 days
    fs.readdirSync(backupDir()).filter(f => /^pitchpal-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(14)
      .forEach(f => fs.unlinkSync(path.join(backupDir(), f)));
    return true;
  } catch (e) { return false; }
}
function backupList() {
  try { return fs.readdirSync(backupDir()).filter(f => f.endsWith(".json")).sort().reverse(); } catch (e) { return []; }
}

// ---------- updates ----------
// Active only in a build that has somewhere to download new versions from (app-update.yml).
const updatesConfigured = () => !!autoUpdater && app.isPackaged && fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
let updateState = { status: "idle", version: null };
function setupUpdater() {
  if (!updatesConfigured()) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on("checking-for-update", () => { updateState = { status: "checking" }; });
  autoUpdater.on("update-available", i => { updateState = { status: "downloading", version: i.version }; });
  autoUpdater.on("update-not-available", () => { updateState = { status: "current" }; });
  autoUpdater.on("update-downloaded", i => { updateState = { status: "ready", version: i.version }; buildMenu(); });
  autoUpdater.on("error", e => { updateState = { status: "error", message: String(e && e.message || e) }; });
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600e3);
}
async function checkForUpdates(fromMenu) {
  if (!updatesConfigured()) {
    if (fromMenu) dialog.showMessageBox({ type: "info", title: "Pitch Pal", message: `You have Pitch Pal ${app.getVersion()}.`, detail: "Automatic updates aren't set up for this copy yet. New versions come as an installer you run over this one." });
    return { configured: false, version: app.getVersion() };
  }
  try { await autoUpdater.checkForUpdates(); } catch (e) {}
  return { configured: true, version: app.getVersion(), ...updateState };
}

// ---------- right-click menu on the desktop player: tick off today's tasks ----------
async function showBuddyMenu() {
  if (!buddy) return;
  let tasks = [];
  try { tasks = JSON.parse(await buddy.webContents.executeJavaScript("JSON.stringify(PP.todayTasks(PP.load()).map(t => ({ id: t.id, name: t.name, done: t.done })))")); } catch (e) {}
  const toggle = (id, on) => buddy.webContents.executeJavaScript(`PP.toggleTask(${JSON.stringify(id)}, ${on}); window.afterQuickTick && window.afterQuickTick(${on});`).catch(() => {});
  const items = [
    { label: "Today's training", enabled: false },
    ...(tasks.length ? tasks.map(t => ({ label: t.name.length > 48 ? t.name.slice(0, 47) + "\u2026" : t.name, type: "checkbox", checked: t.done, click: i => toggle(t.id, i.checked) }))
      : [{ label: "Nothing scheduled today", enabled: false }]),
    { type: "separator" },
    { label: "Open Pitch Pal", click: openDashboard },
    { label: "Show today's reminder", click: showReminder },
  ];
  Menu.buildFromTemplate(items).popup({ window: buddy });
}

function buildMenu() {
  const items = [
    { label: "Open Pitch Pal", click: openDashboard },
    { label: "Show today's reminder now", click: showReminder },
    { type: "separator" },
    {
      label: "Show player on desktop", type: "checkbox", checked: cfg.showBuddy,
      click: i => { cfg.showBuddy = i.checked; saveCfg(); i.checked ? buddy.showInactive() : buddy.hide(); },
    },
    {
      label: "Keep player on top of windows", type: "checkbox", checked: cfg.onTop,
      click: i => { cfg.onTop = i.checked; saveCfg(); buddy.setAlwaysOnTop(i.checked, "floating"); },
    },
    {
      label: "Player's screen",
      submenu: [["second", "Second monitor"], ["main", "Main monitor"]].map(([id, label]) => ({
        label, type: "radio", checked: cfg.buddyScreen === id,
        click: () => { cfg.buddyScreen = id; cfg.buddySpot = null; saveCfg(); placeBuddy(); },
      })),
    },
    {
      label: "Put player back in the corner",
      click: () => { cfg.buddySpot = null; cfg.showBuddy = true; placeBuddy(); buddy.showInactive(); saveCfg(); buildMenu(); },
    },
  ];
  if (loginSupported) {
    items.push({ label: "Start when my computer starts", type: "checkbox", checked: cfg.autoStart !== false, click: i => setAutoStart(i.checked) });
  }
  items.push({ type: "separator" });
  if (updateState.status === "ready") items.push({ label: `Restart to update to ${updateState.version}`, click: () => { quitting = true; autoUpdater.quitAndInstall(); } });
  else items.push({ label: "Check for updates", click: () => checkForUpdates(true) });
  items.push({ label: "Quit Pitch Pal", click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

app.whenReady().then(() => {
  loadCfg();
  if (process.platform === "darwin") app.dock.hide();
  app.setAppUserModelId("com.pitchpal.app");

  const trayIcon = nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png"));
  tray = new Tray(trayIcon.resize({ width: process.platform === "darwin" ? 18 : 16 }));
  tray.setToolTip(`Pitch Pal ${app.getVersion()}`);
  tray.on("click", openDashboard);

  createBuddy();
  buildMenu();
  // Follow monitors being plugged in or unplugged.
  for (const ev of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(ev, placeBuddy);

  applyAutoStart();
  setupUpdater();
  // First launch, or opened by hand: show the dashboard. At sign-in, stay quiet.
  if (!cfg.firstRunDone || !startedAtLogin) {
    cfg.firstRunDone = true; saveCfg();
    openDashboard();
  }
});

ipcMain.on("open-dashboard", openDashboard);
ipcMain.on("show-reminder", showReminder);
ipcMain.on("close-reminder", () => { if (reminder) reminder.close(); });
ipcMain.handle("calendar-fetch", (_e, url, fromISO, toISO) => calendar.loadEvents(url, fromISO, toISO));
ipcMain.handle("fetch-feed", (_e, url) => fetchFeed(url));
ipcMain.handle("backup-auto", (_e, data) => autoBackup(data));
ipcMain.handle("backup-list", () => backupList());
ipcMain.handle("backup-folder", () => { fs.mkdirSync(backupDir(), { recursive: true }); return shell.openPath(backupDir()); });
ipcMain.handle("backup-export", async (e, data) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { title: "Save a Pitch Pal backup", defaultPath: path.join(app.getPath("documents"), `Pitch Pal backup ${today()}.json`), filters: [{ name: "Pitch Pal backup", extensions: ["json"] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, data); return r.filePath;
});
ipcMain.handle("backup-import", async e => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: "Restore a Pitch Pal backup", defaultPath: fs.existsSync(backupDir()) ? backupDir() : app.getPath("documents"), properties: ["openFile"], filters: [{ name: "Pitch Pal backup", extensions: ["json"] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], "utf8");
});
ipcMain.handle("update-check", () => checkForUpdates(false));
ipcMain.on("buddy-menu", showBuddyMenu);
ipcMain.handle("autostart-get", () => ({ supported: loginSupported, on: cfg.autoStart !== false, registered: autoStartOn() }));
ipcMain.handle("autostart-set", (_e, on) => { setAutoStart(on); return { on: cfg.autoStart !== false }; });
app.on("second-instance", openDashboard);
app.on("activate", openDashboard);
app.on("before-quit", () => { quitting = true; });
// Keep running in the background when every window is closed.
app.on("window-all-closed", () => {});

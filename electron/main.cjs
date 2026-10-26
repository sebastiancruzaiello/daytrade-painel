// Processo principal do DAYTRADE Painel.
// Regras: só lê. Não fala com corretora, não muda regras, limites nem estratégias, não roda comandos na VPS.
"use strict";

const { app, BrowserWindow, ipcMain, Menu, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { validarEndereco, lerFonte } = require("./fonte.cjs");

const { ligarAtualizacao } = require("./atualizar.cjs");

// O endereço de leitura não vem no código (o código é público): fica só no PC, em Ajustes, junto com a chave.

const arquivoAjustes = () => path.join(app.getPath("userData"), "ajustes.json");

function lerAjustes() {
  try { return JSON.parse(fs.readFileSync(arquivoAjustes(), "utf8")); } catch { return {}; }
}
function gravarAjustes(a) {
  fs.mkdirSync(path.dirname(arquivoAjustes()), { recursive: true });
  fs.writeFileSync(arquivoAjustes(), JSON.stringify(a, null, 2), { mode: 0o600 });
}
function chaveGuardada(a) {
  if (!a.chaveCifrada) return null;
  try { return safeStorage.decryptString(Buffer.from(a.chaveCifrada, "base64")); } catch { return null; }
}

ipcMain.handle("ajustes:ler", () => {
  const a = lerAjustes();
  return { endereco: a.endereco || "", temChave: !!a.chaveCifrada };
});

ipcMain.handle("ajustes:salvar", (_e, entrada) => {
  const a = lerAjustes();
  const v = validarEndereco(entrada && entrada.endereco);
  if (!v.ok) return v;
  a.endereco = v.endereco;
  const chave = entrada && typeof entrada.chave === "string" ? entrada.chave.trim() : "";
  if (chave) {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, erro: "o Windows não ofereceu cofre para guardar a chave" };
    a.chaveCifrada = safeStorage.encryptString(chave).toString("base64");
  }
  gravarAjustes(a);
  return { ok: true };
});

ipcMain.handle("ajustes:apagar", () => {
  try { fs.rmSync(arquivoAjustes(), { force: true }); } catch {}
  return { ok: true };
});

ipcMain.handle("fonte:ler", async () => {
  const a = lerAjustes();
  const chave = chaveGuardada(a);
  if (!chave || !a.endereco) return { ok: false, erro: "sem-endereco" };
  return lerFonte({ endereco: a.endereco, chave });
});

function criarJanela() {
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0e1316",
    title: "DAYTRADE Painel",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  // Nada de abrir outras páginas dentro do programa; links externos vão para o navegador.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  if (process.env.VITE_DEV_URL) win.loadURL(process.env.VITE_DEV_URL);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  return win;
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    ligarAtualizacao(criarJanela());
  });
  app.on("window-all-closed", () => app.quit());
}

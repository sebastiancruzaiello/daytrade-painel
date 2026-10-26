// Atualização automática. Só busca versões novas publicadas no repositório público do programa no GitHub
// (endereço gravado pelo instalador em app-update.yml). Não guarda senha nem token: o repositório é público.
// O arquivo baixado é conferido pelo sha512 do latest.yml antes de instalar.
"use strict";

const { app, ipcMain } = require("electron");

const DE_HORAS_EM_HORAS = 4 * 60 * 60 * 1000;

function ligarAtualizacao(win) {
  let estado = { fase: "parado", versao: app.getVersion() };
  const avisa = (mudanca) => {
    estado = { ...estado, ...mudanca };
    if (!win.isDestroyed()) win.webContents.send("atualizacao:estado", estado);
  };
  ipcMain.handle("atualizacao:ler", () => estado);

  // Rodando fora do instalador (desenvolvimento, portátil): não há o que atualizar.
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) {
    ipcMain.handle("atualizacao:reiniciar", () => ({ ok: false }));
    return;
  }

  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // se não clicar em "Reiniciar agora", instala ao fechar
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => avisa({ fase: "procurando" }));
  autoUpdater.on("update-not-available", () => avisa({ fase: "em-dia", conferidoEm: new Date().toISOString() }));
  autoUpdater.on("update-available", (i) => avisa({ fase: "baixando", nova: i.version, pct: 0 }));
  autoUpdater.on("download-progress", (p) => avisa({ fase: "baixando", pct: Math.round(p.percent || 0) }));
  autoUpdater.on("update-downloaded", (i) => avisa({ fase: "pronta", nova: i.version, notas: typeof i.releaseNotes === "string" ? i.releaseNotes.replace(/<[^>]+>/g, "").slice(0, 600) : "" }));
  autoUpdater.on("error", (e) => avisa({ fase: "erro", msg: String((e && e.message) || e).split("\n")[0].slice(0, 200) }));

  ipcMain.handle("atualizacao:reiniciar", () => {
    if (estado.fase !== "pronta") return { ok: false };
    setImmediate(() => autoUpdater.quitAndInstall(true, true)); // silencioso e abre de novo
    return { ok: true };
  });

  const conferir = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(conferir, 5000);
  setInterval(conferir, DE_HORAS_EM_HORAS);
}

module.exports = { ligarAtualizacao };

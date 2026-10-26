// Ponte mínima entre a tela e o processo principal: ler ajustes, guardar o endereço, ler a fonte e a atualização do próprio programa. Nada mais.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("daytrade", {
  lerAjustes: () => ipcRenderer.invoke("ajustes:ler"),
  salvarAjustes: (a) => ipcRenderer.invoke("ajustes:salvar", { endereco: a.endereco, chave: a.chave }),
  apagarAjustes: () => ipcRenderer.invoke("ajustes:apagar"),
  lerFonte: () => ipcRenderer.invoke("fonte:ler"),
  lerAtualizacao: () => ipcRenderer.invoke("atualizacao:ler"),
  aoAtualizar: (fn) => {
    const ouvinte = (_e, estado) => fn(estado);
    ipcRenderer.on("atualizacao:estado", ouvinte);
    return () => ipcRenderer.removeListener("atualizacao:estado", ouvinte);
  },
  reiniciarParaAtualizar: () => ipcRenderer.invoke("atualizacao:reiniciar"),
});

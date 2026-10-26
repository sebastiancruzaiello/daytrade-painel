# DAYTRADE Painel

Programa de Windows que mostra, só para olhar, uma simulação de robôs de trading (dinheiro de mentira).
Feito com Electron, React e componentes do [affectUI](https://github.com/flohoeller/affectui) (MIT).

- Só lê. Não fala com corretora, não muda regras nem limites, não tem IA nas decisões.
- Não traz endereço nem chave de nenhum servidor: quem usa cola os dois em Ajustes, e eles ficam só no PC,
  cifrados pelo Windows.
- Atualiza sozinho a partir dos lançamentos deste repositório (electron-updater). Cada lançamento é montado e publicado pelo
  GitHub Actions (`.github/workflows/publicar.yml`) quando a versão do `package.json` muda.

## Desenvolver

    npm ci
    npm test
    npm run dev          # tela no navegador
    npm run dist:win     # instalador local, sem publicar

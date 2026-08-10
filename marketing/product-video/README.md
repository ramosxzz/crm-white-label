# Vídeo do CRM W+

Projeto editável em Remotion usado para gerar o vídeo de apresentação da landing page.

## Comandos

```bash
npm install
npm run dev
npm run lint
npx remotion render src/index.ts SolaireCRMOverview ../../public/videos/crm-w-plus-overview.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p
```

A composição final tem 18 segundos, 30 fps e resolução de 1920×1080.

As capturas do produto ficam em `public/showcase/`. A versão renderizada usada pelo site fica em `../../public/videos/`.

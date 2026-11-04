import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

async function buildPortable() {
  console.log('1. Compilando CSS con Tailwind / Vite...');
  execSync('npx vite build', { stdio: 'inherit' });

  const distAssetsDir = path.resolve('dist/assets');
  const assetFiles = fs.readdirSync(distAssetsDir);
  const cssFile = assetFiles.find(f => f.endsWith('.css'));
  const cssContent = cssFile
    ? fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8')
    : '';

  console.log('2. Empaquetando aplicación completa como IIFE estándar (100% compatible con doble clic en file:// sin type="module")...');
  const result = await esbuild.build({
    entryPoints: ['src/main-portable.tsx'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    write: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window'
    }
  });

  const jsCode = result.outputFiles[0].text;
  const safeJsCode = jsCode.replace(/<\/script>/gi, '<\\/script>');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AttendancePRO v2.0 - Control de Asistencia y Nómina</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      ${cssContent}
    </style>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <div id="root"></div>
    <script>
      ${safeJsCode}
    </script>
  </body>
</html>`;

  const outPath = path.resolve('public/AttendancePRO_v10_Portable.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');

  // Guardar también como constante JS exportable para que la UI de la app web pueda descargarlo en memoria con saveAs sin hacer fetch a la red
  const outJsPath = path.resolve('src/services/portableHtmlData.ts');
  const encodedContent = Buffer.from(html, 'utf8').toString('base64');
  fs.writeFileSync(
    outJsPath,
    `/**\n * Archivo portable autocontenido en base64 para descarga instantánea desde memoria\n */\nexport const PORTABLE_HTML_BASE64 = "${encodedContent}";\n`,
    'utf8'
  );

  const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✓ Archivo portable generado con éxito: ${outPath} (${sizeMB} MB)`);
  console.log(`✓ Módulo de descarga directa generado: ${outJsPath}`);
}

buildPortable().catch(err => {
  console.error(err);
  process.exit(1);
});

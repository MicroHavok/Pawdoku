const fs=require('fs');
const eng=fs.readFileSync('engine.js','utf8').replace(/<\/script/gi,'<\\/script');
const face='data:image/webp;base64,'+fs.readFileSync('assets/ry-256.webp').toString('base64');
const tpl=fs.readFileSync('src/app.html','utf8').replace('/*ENGINE*/',()=>eng).replace('/*FACE*/',()=>face)
  .replace('/*IMG_WIN*/',()=>'data:image/webp;base64,'+fs.readFileSync('assets/ry-win.webp').toString('base64'))
  .replace('/*IMG_LAUGH*/',()=>'data:image/webp;base64,'+fs.readFileSync('assets/ry-laugh.webp').toString('base64'))
  .replace('/*IMG_FAIL*/',()=>'data:image/webp;base64,'+fs.readFileSync('assets/ry-fail.webp').toString('base64'));
const head=`<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">`;
const reg=`if ('serviceWorker' in navigator && location.protocol.startsWith('http')) { try { navigator.serviceWorker.register('sw.js'); } catch (e) {} }`;
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',tpl.replace('<!--PWA-HEAD-->',head).replace('<!--SW-REGISTER-->',reg));
fs.writeFileSync('rydoku-single.html',tpl.replace('<!--PWA-HEAD-->','').replace('<!--SW-REGISTER-->',''));
const art=tpl.replace('<!--PWA-HEAD-->','').replace('<!--SW-REGISTER-->','')
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i,'').replace(/<meta[^>]*>\s*/g,'')
  .replace('</head>','').replace('<body>','').replace('</body>','').replace('</html>','');
fs.writeFileSync('artifact/rydoku.html',art);
console.log('built');

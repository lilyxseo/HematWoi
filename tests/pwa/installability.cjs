const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const origin = new URL(process.env.PWA_TEST_URL || 'http://127.0.0.1:5180').origin;
(async()=>{
 const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hematwoi-pwa-'));
 const context = await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox'],viewport:{width:390,height:844}});
 try {
  const page = context.pages()[0] || await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.innerText.includes('Dashboard'));
  await page.waitForFunction(()=>navigator.serviceWorker.controller !== null);
  const state = await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.ready;
   const response=await fetch(document.querySelector('link[rel="manifest"]').href);
   const manifest=await response.json();
   const icons=await Promise.all(manifest.icons.map(async icon=>{const image=new Image();image.src=icon.src;await image.decode();return [image.naturalWidth,image.naturalHeight];}));
   return {manifest,icons,mime:response.headers.get('content-type'),worker:registration.active.scriptURL,scope:registration.scope,caches:await caches.keys()};
  });
  assert.equal(state.manifest.display,'standalone');assert.equal(state.manifest.scope,'/');assert.equal(state.manifest.start_url,'/');
  assert.deepEqual(state.icons,[[192,192],[512,512]]);assert.equal(state.scope,origin+'/');assert.match(state.mime,/application\/manifest\+json/);assert.deepEqual(state.caches,[]);
  const cdp=await context.newCDPSession(page);
  const manifest=await cdp.send('Page.getAppManifest');
  console.log('Chrome manifest errors:',JSON.stringify(manifest.errors));
  const installability=await cdp.send('Page.getInstallabilityErrors');
  console.log('Chrome installability:',JSON.stringify(installability));
  assert.equal(manifest.errors.length,0);assert.equal(installability.installabilityErrors.length,0);
  await page.goto(origin+'/settings',{waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).origin,origin);
  assert.deepEqual(errors,[]);
  console.log('PASS: production dashboard, valid standalone manifest, icons, root service-worker scope, settings navigation, no Cache Storage and no page errors.');
 } finally {await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

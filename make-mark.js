// Extracts the white mark from logo1.png into a tight, transparent assets/mark.png (128px)
const puppeteer = require('C:/Users/Utilisateur/aeye/node_modules/puppeteer-core');
const fs = require('fs');
const logo = fs.readFileSync('C:/Users/Utilisateur/Downloads/logo1.png').toString('base64');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const out = await p.evaluate(async logo => {
    const L = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + logo; });
    const c = document.createElement('canvas'); c.width = L.width; c.height = L.height;
    const x = c.getContext('2d'); x.drawImage(L, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    let minX = 1e9, minY = 1e9, maxX = 0, maxY = 0;
    for (let i = 0; i < a.length; i += 4) {
      const al = Math.max(0, Math.min(1, (Math.min(a[i], a[i + 1], a[i + 2]) - 200) / 30));
      a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = al * 255;
      if (al > 0.5) { const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width); minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
    }
    x.putImageData(d, 0, 0);
    const side = Math.max(maxX - minX, maxY - minY) + 8, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const o = document.createElement('canvas'); o.width = o.height = 128;
    const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
    ox.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, 128, 128);
    return o.toDataURL('image/png').split(',')[1];
  }, logo);
  fs.writeFileSync('C:/Users/Utilisateur/intercept-docs/assets/mark.png', Buffer.from(out, 'base64'));
  await b.close();
})();

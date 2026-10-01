import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';

const png = new Resvg(readFileSync('media/icon.svg', 'utf8'), { fitTo: { mode: 'width', value: 256 } }).render().asPng();
writeFileSync('media/icon.png', png);
console.log(`✓ media/icon.png (${png.length} bytes)`);

// vsce no admite SVG en el README: PNG de la mascota para la galería.
const speccy = new Resvg(readFileSync('media/speccy.svg', 'utf8'), { fitTo: { mode: 'width', value: 240 } }).render().asPng();
writeFileSync('media/speccy.png', speccy);
console.log(`✓ media/speccy.png (${speccy.length} bytes)`);

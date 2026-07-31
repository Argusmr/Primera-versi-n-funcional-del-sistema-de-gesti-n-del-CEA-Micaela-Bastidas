import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Function to generate high resolution shield PNG
function createShieldPNG(width, height) {
  const png = new PNG({ width, height, filterType: 4 });

  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.44;
  const ry = height * 0.48;
  const innerRx = width * 0.36;
  const innerRy = height * 0.39;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      
      // Normalized coordinates from center
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const distOuter = dx * dx + dy * dy;

      const idxInner = ((x - cx) / innerRx) ** 2 + ((y - cy) / innerRy) ** 2;

      if (distOuter <= 1.0) {
        if (idxInner > 1.0) {
          // Green outer ring (#00A651)
          png.data[idx] = 0;       // R
          png.data[idx + 1] = 166; // G
          png.data[idx + 2] = 81;  // B
          png.data[idx + 3] = 255; // Alpha
        } else {
          // Inner grey dotted texture
          const gridPattern = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
          const bg = gridPattern ? 220 : 235;
          png.data[idx] = bg;
          png.data[idx + 1] = bg;
          png.data[idx + 2] = bg + 5;
          png.data[idx + 3] = 255;

          // Portrait top white box check
          const portraitBoxLeft = cx - width * 0.22;
          const portraitBoxRight = cx + width * 0.22;
          const portraitBoxTop = cy - height * 0.35;
          const portraitBoxBottom = cy + height * 0.05;

          if (x >= portraitBoxLeft && x <= portraitBoxRight && y >= portraitBoxTop && y <= portraitBoxBottom) {
            // White rounded box
            png.data[idx] = 255;
            png.data[idx + 1] = 255;
            png.data[idx + 2] = 255;
            png.data[idx + 3] = 255;

            // Simple representation of portrait Micaela Bastidas inside box
            const pX = (x - portraitBoxLeft) / (portraitBoxRight - portraitBoxLeft);
            const pY = (y - portraitBoxTop) / (portraitBoxBottom - portraitBoxTop);

            // Red dress
            if (pY > 0.45 && pY < 0.75 && pX > 0.25 && pX < 0.75) {
              png.data[idx] = 190;
              png.data[idx + 1] = 30;
              png.data[idx + 2] = 35;
            }
            // Book (yellow triangle with text area)
            if (pY >= 0.70 && pY <= 0.95 && pX >= 0.25 && pX <= 0.75) {
              png.data[idx] = 245;
              png.data[idx + 1] = 210;
              png.data[idx + 2] = 60;
            }
            // Green leaf feather
            if (pX > 0.65 && pX < 0.85 && pY > 0.35 && pY < 0.75) {
              png.data[idx] = 34;
              png.data[idx + 1] = 139;
              png.data[idx + 2] = 34;
            }
            // Dark hair
            if (pY > 0.1 && pY < 0.45 && pX > 0.3 && pX < 0.7) {
              png.data[idx] = 40;
              png.data[idx + 1] = 20;
              png.data[idx + 2] = 20;
            }
            // Face tone
            if (pY > 0.2 && pY < 0.45 && pX > 0.38 && pX < 0.62) {
              png.data[idx] = 225;
              png.data[idx + 1] = 175;
              png.data[idx + 2] = 145;
            }
          }
        }
      } else {
        // Transparent outside oval
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }

  return png;
}

// Write shield PNG
const shieldPNG = createShieldPNG(512, 600);
fs.writeFileSync(path.join(publicDir, 'escudo-cea.png'), PNG.sync.write(shieldPNG));

// Create square icons with background and padding
function createSquareIcon(size) {
  const icon = new PNG({ width: size, height: size });
  const padding = Math.floor(size * 0.08);
  const targetW = size - padding * 2;
  const targetH = Math.floor(targetW * (600 / 512));
  
  const startX = padding;
  const startY = Math.floor((size - targetH) / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      
      // Canvas background #F5F8F7
      icon.data[idx] = 245;
      icon.data[idx + 1] = 248;
      icon.data[idx + 2] = 247;
      icon.data[idx + 3] = 255;

      // Draw scaled shield inside canvas
      if (x >= startX && x < startX + targetW && y >= startY && y < startY + targetH) {
        const srcX = Math.floor(((x - startX) / targetW) * 512);
        const srcY = Math.floor(((y - startY) / targetH) * 600);
        const srcIdx = (512 * srcY + srcX) << 2;

        const alpha = shieldPNG.data[srcIdx + 3];
        if (alpha > 0) {
          icon.data[idx] = shieldPNG.data[srcIdx];
          icon.data[idx + 1] = shieldPNG.data[srcIdx + 1];
          icon.data[idx + 2] = shieldPNG.data[srcIdx + 2];
          icon.data[idx + 3] = alpha;
        }
      }
    }
  }

  return icon;
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), PNG.sync.write(createSquareIcon(192)));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), PNG.sync.write(createSquareIcon(512)));
fs.writeFileSync(path.join(publicDir, 'maskable-512.png'), PNG.sync.write(createSquareIcon(512)));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), PNG.sync.write(createSquareIcon(180)));
fs.writeFileSync(path.join(publicDir, 'favicon.png'), PNG.sync.write(createSquareIcon(64)));

// Generate high quality SVG shield file in public directory as vector fallback
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600" width="100%" height="100%">
  <!-- Background transparent -->
  <g id="escudo-cea">
    <!-- Outer green ring -->
    <ellipse cx="250" cy="300" rx="230" ry="285" fill="#00A651" stroke="#007d3c" stroke-width="4" />
    <!-- Outer green ring text top -->
    <path id="text-path-top" d="M 50,300 A 200,240 0 0,1 450,300" fill="none" />
    <text font-family="Arial, sans-serif" font-weight="bold" font-size="24" fill="#FFFFFF" text-anchor="middle">
      <textPath href="#text-path-top" startOffset="50%">CENTRO DE EDUCACION ALTERNATIVA</textPath>
    </text>
    <!-- Outer green ring text bottom -->
    <path id="text-path-bottom" d="M 450,300 A 200,240 0 0,1 50,300" fill="none" />
    <text font-family="Arial, sans-serif" font-weight="bold" font-size="22" fill="#FFFFFF" text-anchor="middle">
      <textPath href="#text-path-bottom" startOffset="50%">POROMA - CHUQUISACA - BOLIVIA</textPath>
    </text>
    <!-- Inner grey textured area -->
    <ellipse cx="250" cy="300" rx="180" ry="225" fill="#E2E2E6" stroke="#00A651" stroke-width="3" />
    
    <!-- Top rounded white box with Micaela Bastidas -->
    <rect x="150" y="115" width="200" height="200" rx="30" fill="#FFFFFF" stroke="#D0D0D5" stroke-width="2" />
    
    <!-- Micaela Bastidas figure -->
    <!-- Dark hair -->
    <path d="M 210,140 Q 250,120 290,140 C 300,165 305,200 280,240 C 275,260 270,285 270,305" fill="#201010" />
    <!-- Skin face -->
    <ellipse cx="250" cy="180" rx="32" ry="40" fill="#E6AF91" />
    <!-- Eyes and eyebrow -->
    <ellipse cx="238" cy="175" rx="4" ry="3" fill="#331A10" />
    <ellipse cx="262" cy="175" rx="4" ry="3" fill="#331A10" />
    <!-- Lips -->
    <path d="M 242,198 Q 250,204 258,198" fill="none" stroke="#A84232" stroke-width="2" />
    <!-- Red blouse -->
    <path d="M 185,225 C 200,210 230,225 250,225 C 270,225 300,210 315,225 L 325,285 L 175,285 Z" fill="#C82828" />
    <!-- Blue undercollar -->
    <path d="M 230,225 Q 250,240 270,225 Z" fill="#1C4B82" />
    <!-- Yellow pyramid book -->
    <polygon points="250,240 195,295 305,295" fill="#F8C838" stroke="#D09E10" stroke-width="2" />
    <text x="250" y="260" font-family="Arial, sans-serif" font-weight="bold" font-size="10" fill="#111111" text-anchor="middle">ESTUDIO</text>
    <text x="250" y="272" font-family="Arial, sans-serif" font-weight="bold" font-size="10" fill="#111111" text-anchor="middle">- TRABAJO -</text>
    <text x="250" y="284" font-family="Arial, sans-serif" font-weight="bold" font-size="9" fill="#111111" text-anchor="middle">HONESTIDAD</text>
    
    <!-- Green feather leaf -->
    <path d="M 285,170 C 320,180 340,220 315,285 C 310,250 295,200 285,170 Z" fill="#1DB954" stroke="#0D7332" stroke-width="1.5" />

    <!-- Center text below portrait -->
    <text x="250" y="375" font-family="Georgia, serif" font-weight="bold" font-size="40" fill="#111111" text-anchor="middle">C.E.A.</text>
    <text x="250" y="425" font-family="Georgia, serif" font-weight="bold" font-size="30" fill="#111111" text-anchor="middle">“MICAELA BASTIDAS”</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'escudo-cea.svg'), svgContent);

console.log('Shield and PWA icons generated successfully in public/');

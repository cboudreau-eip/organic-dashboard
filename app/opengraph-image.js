import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Charlie in a red shirt beside Organic Growth — Performance Center';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const portrait = await readFile(join(process.cwd(), 'public/images/charlie.png'));
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: '#12372a', padding: '30px 65px', color: '#ffffff' }}>
      <img src={`data:image/png;base64,${portrait.toString('base64')}`} width={380} height={570} alt="" style={{ objectFit: 'contain' }} />
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 55 }}>
        <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.08 }}>Organic Growth</div>
        <div style={{ fontSize: 27, color: '#d4ec84', marginTop: 25, letterSpacing: 3 }}>PERFORMANCE CENTER</div>
      </div>
    </div>,
    { ...size },
  );
}


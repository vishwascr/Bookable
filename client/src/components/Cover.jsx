import { useState } from 'react';

// Amazon returns a 1x1 gif for missing covers; treat tiny images as missing.
export default function Cover({ src, size = 'md', title = '' }) {
  const [bad, setBad] = useState(!src);
  const onLoad = (e) => { if (e.currentTarget.naturalWidth < 5) setBad(true); };
  if (bad) return <div className={`cover ${size} placeholder`}>{title.slice(0, 1) || '📖'}</div>;
  return <img className={`cover ${size}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={onLoad} onError={() => setBad(true)} />;
}

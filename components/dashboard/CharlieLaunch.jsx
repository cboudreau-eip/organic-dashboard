'use client';
import { useEffect, useRef, useState } from 'react';

export default function CharlieLaunch({ onComplete }) {
  const [ready, setReady] = useState(false);
  const image = useRef(null);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth) setReady(true);
    // Never leave the dashboard trapped behind a missing image or animation.
    const timeout = setTimeout(onComplete, 7000);
    return () => clearTimeout(timeout);
  }, [onComplete]);
  return <div className="charlie-launch" role="status" aria-live="polite">
    <div className="charlie-launch-copy"><span>ORGANIC GROWTH</span><h1>Ready for liftoff?</h1><p>Charlie is getting your dashboard ready…</p></div>
    <div className="charlie-flight-lane" aria-hidden="true">
      <img ref={image} className={`charlie-rocket${ready ? ' is-flying' : ''}`} src="/images/charlie-rocket.png" alt="" width="1024" height="1536" fetchPriority="high" onLoad={() => setReady(true)} onError={onComplete} onAnimationEnd={onComplete} />
    </div>
  </div>;
}

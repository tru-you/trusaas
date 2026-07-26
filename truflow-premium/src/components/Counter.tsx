import React, { useEffect, useState, useRef } from 'react';

export default function Counter({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  // React 19's types require an explicit initial value — useRef<number>() with
  // no argument is an error rather than an implicit undefined.
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = displayValue;
    const diff = value - start;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayValue(Math.floor(start + diff * progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return (
    <div>
      {prefix}{displayValue.toLocaleString()}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export default function Counter({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const spring = useSpring(0, { stiffness: 100, damping: 20 });

  useEffect(() => {
    spring.set(value);
    return spring.on("change", (latest) => {
      setDisplayValue(Math.floor(latest));
    });
  }, [value, spring]);

  return (
    <motion.div>
      {prefix}{displayValue.toLocaleString()}
    </motion.div>
  );
}

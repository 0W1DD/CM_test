import { useEffect, useRef, useState } from "react";

export function useScrollDirection(threshold = 10) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;

      if (Math.abs(diff) < threshold) return;

      setHidden(diff > 0 && currentY > 56);
      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return hidden;
}

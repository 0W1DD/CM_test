import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/**
 * A thin progress bar that pins to the top of the viewport while a route
 * is transitioning OR while React Query has any fetch/mutation in flight.
 * Gives users immediate "your click registered" feedback during the gap
 * between click and the next page rendering.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const isLoading = navigation.state !== "idle" || fetching > 0 || mutating > 0;

  // Delay the bar slightly so instant-cached responses don't flash it.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 right-0 z-[60] h-0.5 overflow-hidden"
    >
      <div
        className={`h-full bg-gradient-to-r from-transparent via-primary to-transparent transition-opacity duration-200 ${
          visible
            ? "opacity-100 animate-[nav-progress_1.1s_ease-in-out_infinite]"
            : "opacity-0"
        }`}
      />
    </div>
  );
}

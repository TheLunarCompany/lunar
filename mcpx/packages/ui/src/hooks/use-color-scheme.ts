import { useEffect, useState } from "react";
/**
 * Custom hook to detect the user's color scheme preference.
 * It listens for changes in the color scheme and updates the state accordingly.
 *
 * @returns {("light" | "dark")} The current color scheme preference.
 */
export const useColorScheme = () => {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">(
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleMediaQueryChange);
    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, []);

  return colorScheme;
};

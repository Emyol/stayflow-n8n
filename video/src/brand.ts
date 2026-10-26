import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";

export const { fontFamily: displayFont } = loadDisplay("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

export const { fontFamily: bodyFont } = loadBody("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Same status colours as the StayFlow guest emails and the GuestRequests sheet.
export const colors = {
  night: "#0B1426",
  navy: "#1F3864",
  ink: "#E8EEF7",
  muted: "#8FA3BF",
  gold: "#F2B544",
  confirmed: "#2E7D32",
  confirmedGlow: "#4CAF50",
  alternative: "#B26A00",
  alternativeGlow: "#F0A030",
  review: "#1565C0",
  reviewGlow: "#4A90E2",
  danger: "#E25555",
};

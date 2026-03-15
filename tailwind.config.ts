import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        body: ["'Sora'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      },
      colors: {
        paper: "#f7f3eb",
        ink: "#1f2933",
        ember: "#d94824",
        moss: "#356859",
        slate: "#3e4c59"
      },
      boxShadow: {
        panel: "0 18px 50px -22px rgba(14, 30, 37, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;

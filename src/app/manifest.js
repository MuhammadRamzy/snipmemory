export default function manifest() {
  return {
    name: "SnipMemory Salon App",
    short_name: "SnipMemory",
    description: "4-Angle Styling Reference & Retention Platform for Hairdressers & Barbers",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0c0e",
    theme_color: "#d97706",
    orientation: "any",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      {
        src: "/icons.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/icons.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  };
}

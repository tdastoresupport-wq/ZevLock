import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zev Lock",
    short_name: "Zev",
    description: "Zev Lock — premium license platform",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05060f",
    theme_color: "#05060f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml", purpose: "any" },
      // Character artwork avatar — drop your art at public/zev-character.jpg to enable.
      { src: "/zev-character.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
    ],
  };
}

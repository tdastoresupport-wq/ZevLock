import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zev Lock",
    short_name: "Zev",
    description: "Zev Lock — premium license platform",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#05060f",
    theme_color: "#05060f",
    categories: ["utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      // Official ZEV character artwork (public/zev-character.png, served 200).
      { src: "/zev-character.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/zev-character.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

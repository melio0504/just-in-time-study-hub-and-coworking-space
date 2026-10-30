import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Just In Time Study Hub and Coworking Space",
    short_name: "JIT Study Hub",
    description: "Reserve a focused study or coworking space in Mendiola, Manila.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffcf7",
    theme_color: "#e5a930",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

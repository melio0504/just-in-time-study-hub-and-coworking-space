import Image from "next/image";

export default function Gallery() {
  const galleryImages = [
    {
      src: "/images/desk-help.jpg",
      title: "Reception & Help Desk",
      category: "Reception",
    },
    {
      src: "/images/solo-learner.jpg",
      title: "Study Pods with Natural Light",
      category: "Private Pods",
    },
    {
      src: "/images/individual.jpg",
      title: "Individual Study Spaces",
      category: "Private Pods",
    },
    {
      src: "/images/public.jpg",
      title: "Open Workspace",
      category: "Collaboration",
    },
    {
      src: "/images/sitting-down.jpg",
      title: "Quiet Zone",
      category: "Quiet Zones",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-block bg-[#fef3dc] px-4 py-2 rounded-full mb-6">
            <p className="text-sm text-[#e5a930] uppercase tracking-wider">The Precision Atelier</p>
          </div>
          <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
            Designed for Focus.
            <br />
            Built for Success.
          </h1>
          <p className="text-lg text-[#6b5e52] max-w-3xl mx-auto leading-relaxed">
            Every corner of Just In Time Study Hub is architecturally aligned with the Chronos
            Productivity System. Explore our high-performance environments.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleryImages.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              <Image
                src={image.src}
                alt={image.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="text-xs text-white/80 mb-1 uppercase tracking-wider">
                    {image.category}
                  </p>
                  <p className="text-white">{image.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { VirtualStreetView } from './_components/VirtualStreetView';

export default function VirtualTour() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-sm text-[#e5a930] uppercase tracking-wider mb-4">Virtual Tour</p>
          <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
            Explore Our Space
          </h1>
          <p className="text-lg text-[#6b5e52] max-w-2xl leading-relaxed">
            Take a look around our study hub and discover the perfect spot for your needs.
          </p>
        </div>

        {/* Virtual Tour */}
        <div className="mb-12">
          <VirtualStreetView />
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white/50 p-8 rounded-3xl text-center border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
            <p className="text-4xl text-[#e5a930] mb-2">14</p>
            <p className="text-sm text-[#6b5e52] uppercase tracking-wider">Pods Available</p>
          </div>
          <div className="bg-white/50 p-8 rounded-3xl text-center border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
            <p className="text-4xl text-[#d69520] mb-2">98%</p>
            <p className="text-sm text-[#6b5e52] uppercase tracking-wider">Quiet Score</p>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl mb-8 text-[#2d2520]">Every Space Designed for Purpose</h2>
          <p className="text-lg text-[#6b5e52] max-w-3xl mx-auto leading-relaxed">
            From focused quiet zones to collaborative meeting rooms, each environment is optimized
            for specific types of work and study. Choose the space that matches your task.
          </p>
        </div>
      </div>
    </div>
  );
}

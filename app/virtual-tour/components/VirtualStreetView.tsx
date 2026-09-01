"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import {
  BackSide,
  CanvasTexture,
  SpriteMaterial,
  TextureLoader,
  Vector3,
  type PerspectiveCamera as ThreePerspectiveCamera,
} from 'three';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Armchair, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { getReservedSeatsForDate } from '@/app/admin/lib/seats';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/dialog';
import {
  DEFAULT_TOUR_SEAT,
  getAvailableDirections,
  getNeighbor,
  getPanoramaForSeat,
  getSeatZoneLabel,
  PANORAMA_IMAGES,
  type PanoramaId,
  type TourDirection,
} from '../lib/tourGraph';
import { TourOverviewMap } from './TourOverviewMap';

type Scene = {
  id: PanoramaId;
  title: string;
  subtitle: string;
  image: string;
};

type SeatMarker = {
  id: string;
  u: number;
  v: number;
};

const scenes: Scene[] = [
  {
    id: 'lounge',
    title: 'Welcome Lounge',
    subtitle: 'Flexible seating near the entrance and upper study rows.',
    image: PANORAMA_IMAGES.lounge,
  },
  {
    id: 'study',
    title: 'Quiet Study Zone',
    subtitle: 'Focused desks along the right wall and bottom row.',
    image: PANORAMA_IMAGES.study,
  },
];

const DIRECTION_ARROWS: Record<TourDirection, typeof ArrowUp> = {
  north: ArrowUp,
  south: ArrowDown,
  east: ArrowRight,
  west: ArrowLeft,
};

const SPHERE_RADIUS = 480;
const SEAT_LABEL_OFFSET = new Vector3(0, 28, 0);

const PANORAMA_YAW_OFFSET: Record<PanoramaId, number> = {
  lounge: 0,
  study: 0,
};

const SEAT_MARKERS: Record<PanoramaId, SeatMarker[]> = {
  lounge: [
    { id: 'LA01', u: 0.054, v: 0.4622 },
    { id: 'LA02', u: 0.1397, v: 0.4859 },
    { id: 'LA03', u: 0.2338, v: 0.4994 },
    { id: 'LA04', u: 0.4305, v: 0.487 },
    { id: 'LA05', u: 0.5027, v: 0.4859 },
    { id: 'LA06', u: 0.5743, v: 0.487 },
    { id: 'LA07', u: 0.9773, v: 0.4949 },
    { id: 'LA08', u: 0.0156, v: 0.5118 },
    { id: 'LB01', u: 0.085, v: 0.5378 },
    { id: 'LB02', u: 0.2231, v: 0.6426 },
  ],
  study: [
    { id: 'RA01', u: 0.7614, v: 0.4532 },
    { id: 'RA02', u: 0.789, v: 0.4577 },
    { id: 'RA03', u: 0.4593, v: 0.4758 },
    { id: 'RA04', u: 0.5021, v: 0.4837 },
    { id: 'RB01', u: 0.5326, v: 0.4837 },
    { id: 'RB02', u: 0.4356, v: 0.5006 },
    { id: 'RB03', u: 0.5506, v: 0.5197 },
    { id: 'RB04', u: 0.5134, v: 0.5265 },
    { id: 'RC01', u: 0.9931, v: 0.5423 },
    { id: 'RC02', u: 0.9638, v: 0.5479 },
  ],
};

const toSpherePosition = (u: number, v: number, yawOffset = 0) => {
  const theta = (u - 0.5 + yawOffset) * Math.PI * 2;
  const phi = v * Math.PI;
  const sinPhi = Math.sin(phi);
  return new Vector3(
    SPHERE_RADIUS * sinPhi * Math.sin(theta),
    SPHERE_RADIUS * Math.cos(phi),
    -SPHERE_RADIUS * sinPhi * Math.cos(theta),
  );
};

function SeatLabel({
  id,
  position,
  isAvailable,
  onSelect,
  scaleBoost,
}: {
  id: string;
  position: Vector3;
  isAvailable: boolean;
  onSelect: (seatId: string) => void;
  scaleBoost: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { texture, scale } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeStyle = isAvailable ? 'rgba(167,243,208,0.6)' : 'rgba(254,202,202,0.6)';
      ctx.lineWidth = 4;

      const radius = 16;
      const boxX = 12;
      const boxY = 16;
      const boxW = 232;
      const boxH = 72;

      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.lineTo(boxX + boxW - radius, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
      ctx.lineTo(boxX + boxW, boxY + boxH - radius);
      ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
      ctx.lineTo(boxX + radius, boxY + boxH);
      ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
      ctx.lineTo(boxX, boxY + radius);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isAvailable ? '#34d399' : '#f87171';
      ctx.beginPath();
      ctx.arc(boxX + 20, boxY + 24, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(id, boxX + 36, boxY + 30);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px sans-serif';
      ctx.fillText(isAvailable ? 'Available' : 'Not available', boxX + 20, boxY + 54);

      ctx.fillStyle = isAvailable ? 'rgba(52,211,153,0.8)' : 'rgba(248,113,113,0.8)';
      ctx.beginPath();
      ctx.moveTo(boxX + boxW / 2 - 10, boxY + boxH);
      ctx.lineTo(boxX + boxW / 2 + 10, boxY + boxH);
      ctx.lineTo(boxX + boxW / 2, boxY + boxH + 14);
      ctx.closePath();
      ctx.fill();
    }

    const canvasTexture = new CanvasTexture(canvas);
    canvasTexture.needsUpdate = true;
    return { texture: canvasTexture, scale: [112, 56, 1] as [number, number, number] };
  }, [id, isAvailable]);

  const material = useMemo(
    () =>
      new SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [texture],
  );

  return (
    <sprite
      position={position}
      scale={
        isHovered
          ? [scale[0] * 1.12 * scaleBoost, scale[1] * 1.12 * scaleBoost, scale[2]]
          : [scale[0] * scaleBoost, scale[1] * scaleBoost, scale[2]]
      }
      material={material}
      renderOrder={10}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setIsHovered(false);
      }}
    />
  );
}

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function PanoramaSphere({
  image,
  opacity,
  active,
}: {
  image: string;
  opacity: number;
  active: boolean;
}) {
  const texture = useLoader(TextureLoader, image);

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 64]} />
      <meshBasicMaterial
        map={texture}
        side={BackSide}
        transparent
        opacity={opacity}
        depthWrite={active}
      />
    </mesh>
  );
}

function PanoramaScene({ current, next, progress }: { current: Scene; next: Scene | null; progress: number }) {
  return (
    <>
      <PanoramaSphere image={current.image} opacity={next ? 1 - progress : 1} active={!next} />
      {next ? <PanoramaSphere image={next.image} opacity={progress} active /> : null}
    </>
  );
}

export function VirtualStreetView() {
  const [activeSeatId, setActiveSeatId] = useState(DEFAULT_TOUR_SEAT);
  const [activePanoramaId, setActivePanoramaId] = useState<PanoramaId>(() =>
    getPanoramaForSeat(DEFAULT_TOUR_SEAT),
  );
  const [transitionTarget, setTransitionTarget] = useState<PanoramaId | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomTarget, setZoomTarget] = useState<number | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const minZoom = 0.75;
  const maxZoom = 1.8;
  const zoomStep = 0.16;
  const tourDate = getTodayString();

  const reservedSeats = useMemo(() => new Set(getReservedSeatsForDate(tourDate)), [tourDate]);
  const isSeatAvailable = !reservedSeats.has(activeSeatId);
  const availableDirections = useMemo(() => getAvailableDirections(activeSeatId), [activeSeatId]);
  const seatMarkers = useMemo(() => SEAT_MARKERS[activePanoramaId] ?? [], [activePanoramaId]);
  const yawOffset = PANORAMA_YAW_OFFSET[activePanoramaId] ?? 0;
  const selectedSeatAvailable = selectedSeatId ? !reservedSeats.has(selectedSeatId) : true;
  const selectedSeatZone = selectedSeatId ? getSeatZoneLabel(selectedSeatId) : '';

  useEffect(() => {
    if (zoomTarget === null) {
      return;
    }

    let frameId = 0;
    const startZoom = zoomLevel;
    const startTime = performance.now();
    const duration = 180;

    const tick = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextZoom = startZoom + (zoomTarget - startZoom) * eased;

      setZoomLevel(nextZoom);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      setZoomTarget(null);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [zoomTarget, zoomLevel]);

  useEffect(() => {
    if (!cameraRef.current) {
      return;
    }

    cameraRef.current.zoom = zoomLevel;
    cameraRef.current.updateProjectionMatrix();
  }, [zoomLevel]);

  const zoomIn = () => {
    setZoomTarget(Number((Math.min(maxZoom, zoomLevel + zoomStep)).toFixed(2)));
  };

  const zoomOut = () => {
    setZoomTarget(Number((Math.max(minZoom, zoomLevel - zoomStep)).toFixed(2)));
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!isPointerInside) {
        return;
      }

      event.preventDefault();
      setZoomTarget(null);

      if (event.deltaY > 0) {
        setZoomLevel((currentZoom) => Math.max(minZoom, Number((currentZoom - 0.1).toFixed(2))));
        return;
      }

      setZoomLevel((currentZoom) => Math.min(maxZoom, Number((currentZoom + 0.1).toFixed(2))));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isPointerInside]);

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activePanoramaId) ?? scenes[0],
    [activePanoramaId],
  );
  const nextScene = useMemo(
    () => (transitionTarget ? scenes.find((scene) => scene.id === transitionTarget) ?? null : null),
    [transitionTarget],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (transitionTarget === null) {
      return;
    }

    let frameId = 0;
    let startTime = 0;
    const duration = 900;

    const tick = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const nextProgress = Math.min(elapsed / duration, 1);
      setTransitionProgress(nextProgress);

      if (nextProgress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      setActivePanoramaId(transitionTarget);
      setTransitionTarget(null);
      setTransitionProgress(0);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [transitionTarget]);

  const navigateToSeat = useCallback(
    (seatId: string) => {
      if (seatId === activeSeatId || transitionTarget) {
        return;
      }

      const nextPanorama = getPanoramaForSeat(seatId);
      setActiveSeatId(seatId);

      if (nextPanorama !== activePanoramaId) {
        setTransitionTarget(nextPanorama);
        setTransitionProgress(0);
      }
    },
    [activeSeatId, activePanoramaId, transitionTarget],
  );

  const moveInDirection = (direction: TourDirection) => {
    const neighbor = getNeighbor(activeSeatId, direction);
    if (neighbor) {
      navigateToSeat(neighbor);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  };

  const zoneLabel = getSeatZoneLabel(activeSeatId);
  const handleSeatLabelClick = (seatId: string) => {
    navigateToSeat(seatId);
    setSelectedSeatId(seatId);
  };

  return (
    <div
      ref={containerRef}
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
      className={`relative w-full select-none touch-none overflow-hidden bg-[#120f0b] shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? 'h-dvh rounded-none border-0'
          : 'h-130 rounded-3xl border-4 border-[#e5a930] md:h-175'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,240,212,0.3),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_100%)] pointer-events-none" />

      {/* Header row */}
      <div className="absolute left-4 right-4 top-4 z-20 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-sm shrink-0 flex-col gap-3">
          <div className="rounded-2xl bg-black/35 px-4 py-3 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.3em] text-[#f5cf82]">360° Virtual Tour</p>
            <h3 className="mt-1 text-xl font-medium text-white md:text-2xl">{activeScene.title}</h3>
            <p className="mt-1 text-sm text-white/75">{zoneLabel}</p>
          </div>
          <TourOverviewMap
            activeSeatId={activeSeatId}
            date={tourDate}
            onSelectSeat={navigateToSeat}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-white/20 bg-black/35 backdrop-blur-md">
            <button
              type="button"
              onClick={zoomOut}
              className="px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              aria-label="Zoom out"
            >
              −
            </button>
            <div className="px-4 py-3 text-sm font-medium text-white/80">Zoom</div>
            <button
              type="button"
              onClick={zoomIn}
              className="px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/55"
          >
            <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>
        </div>
      </div>

      <div className="absolute inset-0">
        <Canvas
          gl={{ antialias: true, alpha: true }}
          raycaster={{ params: { Sprite: { threshold: isFullscreen ? 0.65 : 1.1 } } }}
          eventSource={containerRef}
          eventPrefix="client"
          className="touch-none"
        >
          <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0, 0.1]} fov={75} zoom={zoomLevel} />
          <color attach="background" args={['#120f0b']} />
          <ambientLight intensity={1} />
          <PanoramaScene current={activeScene} next={nextScene} progress={transitionProgress} />
          {seatMarkers.map((marker) => (
            <SeatLabel
              key={marker.id}
              id={marker.id}
              position={toSpherePosition(marker.u, marker.v, yawOffset).add(SEAT_LABEL_OFFSET)}
              isAvailable={!reservedSeats.has(marker.id)}
              onSelect={handleSeatLabelClick}
              scaleBoost={isFullscreen ? 1 : 1.12}
            />
          ))}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            rotateSpeed={isFullscreen ? -0.35 : -0.40}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.8}
          />
        </Canvas>

        {/* Seat indicator */}
        <div className="pointer-events-none absolute bottom-28 left-4 z-20 md:bottom-32">
          <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-white backdrop-blur-md shadow-lg">
            <div className="flex items-center gap-2 text-[#f5cf82]">
              <Armchair className="h-4 w-4" aria-hidden />
              <p className="text-xs font-medium uppercase tracking-[0.22em]">Seating</p>
            </div>
            <p className="mt-2 text-lg font-semibold tracking-wide">{activeSeatId}</p>
            <p className="mt-0.5 text-xs text-white/60">Seat number</p>
            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                isSeatAvailable
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-red-500/20 text-red-200'
              }`}
            >
              {isSeatAvailable ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Available
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                  Not available
                </>
              )}
            </div>
          </div>
        </div>

        {/* Street View–style navigation */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
          <div
            className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1 rounded-full border border-white/20 bg-black/55 p-2 backdrop-blur-md shadow-xl"
            role="group"
            aria-label="Move between seats"
          >
            {(['north', 'west', 'east', 'south'] as const).map((direction) => {
              const Icon = DIRECTION_ARROWS[direction];
              const neighbor = getNeighbor(activeSeatId, direction);
              const isAvailable = availableDirections.includes(direction);
              const gridClass =
                direction === 'north'
                  ? 'col-start-2 row-start-1'
                  : direction === 'west'
                    ? 'col-start-1 row-start-2'
                    : direction === 'east'
                      ? 'col-start-3 row-start-2'
                      : 'col-start-2 row-start-3';

              return (
                <button
                  key={direction}
                  type="button"
                  onClick={() => moveInDirection(direction)}
                  disabled={!isAvailable || Boolean(transitionTarget)}
                  title={neighbor ? `Go to ${neighbor}` : 'No seat this way'}
                  aria-label={
                    neighbor ? `Move ${direction} to seat ${neighbor}` : `No seat to the ${direction}`
                  }
                  className={`${gridClass} flex h-11 w-11 items-center justify-center rounded-full transition ${
                    isAvailable
                      ? 'bg-white/90 text-[#241b0f] hover:bg-white hover:scale-105 active:scale-95'
                      : 'cursor-not-allowed bg-white/10 text-white/25'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </button>
              );
            })}
            <div
              className="col-start-2 row-start-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#e5a930]/25 text-[10px] font-bold text-[#f5cf82]"
              aria-hidden
            >
              {activeSeatId.slice(2)}
            </div>
          </div>
        </div>

        {transitionTarget ? (
          <div className="pointer-events-none absolute inset-0 z-10 bg-black/10" />
        ) : null}
      </div>

      <Dialog
        open={Boolean(selectedSeatId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSeatId(null);
          }
        }}
      >
        <DialogContent
          className="bg-[#fff8ed] text-[#2d2520]"
          portalContainer={containerRef.current}
        >
          <DialogHeader>
            <DialogTitle>Seat {selectedSeatId ?? ''}</DialogTitle>
            <DialogDescription>
              {selectedSeatId
                ? `Located in ${selectedSeatZone}. ${
                    selectedSeatAvailable ? 'This seat is ready to reserve.' : 'This seat is taken.'
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-[#f3ede4] bg-white/80 p-4">
            <p className="text-sm text-[#6b5e52]">Status</p>
            <p className="mt-2 text-lg font-semibold">
              {selectedSeatAvailable ? 'Available' : 'Not available'}
            </p>
            <p className="mt-1 text-sm text-[#6b5e52]">Seat number: {selectedSeatId ?? ''}</p>
          </div>
          <DialogFooter>
            {selectedSeatAvailable ? (
              <Link
                href={selectedSeatId ? `/reserve?seat=${selectedSeatId}` : '/reserve'}
                className="inline-flex items-center justify-center rounded-full bg-[#e5a930] px-5 py-2 text-sm font-semibold text-[#241b0f] transition hover:bg-[#d69520]"
              >
                Add to reservation
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[#d1d5db] px-5 py-2 text-sm font-semibold text-[#6b5e52]"
                disabled
              >
                Not available
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

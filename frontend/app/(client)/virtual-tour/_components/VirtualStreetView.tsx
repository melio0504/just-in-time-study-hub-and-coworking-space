"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { BackSide, TextureLoader, type PerspectiveCamera as ThreePerspectiveCamera } from 'three';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PANORAMA_IMAGES, type PanoramaId } from '../_lib/tourGraph';

type Scene = {
  id: PanoramaId;
  title: string;
  subtitle: string;
  image: string;
};

const scenes: Scene[] = [
  {
    id: 'overview',
    title: 'Study Hub Overview',
    subtitle: 'Reception and the heart of the study hub.',
    image: PANORAMA_IMAGES.overview,
  },
  {
    id: 'pods',
    title: 'Private Study Pods',
    subtitle: 'Individual desks for distraction-free work.',
    image: PANORAMA_IMAGES.pods,
  },
  {
    id: 'lounge',
    title: 'Floor Desk Study',
    subtitle: 'Relaxed spaces for someone who loves seating',
    image: PANORAMA_IMAGES.lounge,
  },
  {
    id: 'study',
    title: 'Quiet Study Zone',
    subtitle: 'Shared tables and focused desks along the quiet wall.',
    image: PANORAMA_IMAGES.study,
  },
];

const CAMERA_FOV = 75;

const getVerticalCoverage = (aspectRatio: number) =>
  Math.min(Math.PI, (Math.PI * 2) / aspectRatio);

function PanoramaSphere({
  id,
  image,
  opacity,
  active,
  onAspectRatio,
}: {
  id: PanoramaId;
  image: string;
  opacity: number;
  active: boolean;
  onAspectRatio: (id: PanoramaId, aspectRatio: number) => void;
}) {
  const texture = useLoader(TextureLoader, image);
  const imageWidth = texture.image?.naturalWidth || texture.image?.width || 2;
  const imageHeight = texture.image?.naturalHeight || texture.image?.height || 1;
  const imageAspectRatio = imageWidth / imageHeight;
  const verticalCoverage = getVerticalCoverage(imageAspectRatio);
  const verticalStart = (Math.PI - verticalCoverage) / 2;

  useEffect(() => {
    onAspectRatio(id, imageAspectRatio);
  }, [id, imageAspectRatio, onAspectRatio]);

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 64, 0, Math.PI * 2, verticalStart, verticalCoverage]} />
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

function PanoramaScene({
  current,
  next,
  progress,
  onAspectRatio,
}: {
  current: Scene;
  next: Scene | null;
  progress: number;
  onAspectRatio: (id: PanoramaId, aspectRatio: number) => void;
}) {
  return (
    <>
      <PanoramaSphere
        id={current.id}
        image={current.image}
        opacity={next ? 1 - progress : 1}
        active={!next}
        onAspectRatio={onAspectRatio}
      />
      {next ? (
        <PanoramaSphere
          id={next.id}
          image={next.image}
          opacity={progress}
          active
          onAspectRatio={onAspectRatio}
        />
      ) : null}
    </>
  );
}

function TourNavigation({
  activeIndex,
  disabled,
  onPrevious,
  onNext,
  onSelect,
}: {
  activeIndex: number;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 md:bottom-7">
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-black/55 p-2 shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        role="group"
        aria-label="Choose a virtual tour view"
      >
        <button
          type="button"
          onClick={onPrevious}
          disabled={disabled}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-[#e5a930] hover:text-[#241b0f] active:scale-95 disabled:cursor-wait disabled:opacity-40"
          aria-label="Previous virtual tour view"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex items-center gap-1 px-1">
          {scenes.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(index)}
              disabled={disabled || index === activeIndex}
              className={`group flex h-11 items-center rounded-full px-2 transition sm:px-3 ${index === activeIndex
                ? 'bg-white text-[#2d2520]'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              aria-label={`Open ${scene.title}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            >
              <span
                className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-[#e5a930]' : 'w-2 bg-current group-hover:w-4'
                  }`}
              />
              <span className={`ml-2 text-xs font-semibold ${index === activeIndex ? '' : 'hidden sm:inline'}`}>
                {index + 1}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e5a930] text-[#241b0f] transition hover:bg-[#f5cf82] active:scale-95 disabled:cursor-wait disabled:opacity-40"
          aria-label="Next virtual tour view"
        >
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function VirtualStreetView() {
  const [activePanoramaId, setActivePanoramaId] = useState<PanoramaId>(scenes[0].id);
  const [transitionTarget, setTransitionTarget] = useState<PanoramaId | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomTarget, setZoomTarget] = useState<number | null>(null);
  const [panoramaAspectRatios, setPanoramaAspectRatios] = useState<Partial<Record<PanoramaId, number>>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [eventSource, setEventSource] = useState<HTMLDivElement | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const minZoom = 0.75;
  const maxZoom = 1.8;
  const zoomStep = 0.16;

  const setContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setEventSource(node);
  }, []);

  const activeSceneIndex = scenes.findIndex((scene) => scene.id === activePanoramaId);
  const activeScene = scenes[activeSceneIndex] ?? scenes[0];
  const nextScene = useMemo(
    () => (transitionTarget ? scenes.find((scene) => scene.id === transitionTarget) ?? null : null),
    [transitionTarget],
  );
  const activePanoramaAspectRatio = panoramaAspectRatios[activePanoramaId] ?? 2;
  const activeVerticalCoverage = getVerticalCoverage(activePanoramaAspectRatio);
  const widestCameraVerticalFov = 2 * Math.atan(Math.tan((CAMERA_FOV * Math.PI) / 360) / minZoom);
  const verticalLookRange = Math.max(0.04, (activeVerticalCoverage - widestCameraVerticalFov) / 2);
  const minPolarAngle = Math.PI / 2 - verticalLookRange;
  const maxPolarAngle = Math.PI / 2 + verticalLookRange;

  useEffect(() => {
    if (zoomTarget === null) return;

    let frameId = 0;
    const startZoom = zoomLevel;
    const startTime = performance.now();
    const duration = 180;

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setZoomLevel(startZoom + (zoomTarget - startZoom) * eased);

      if (progress < 1) frameId = window.requestAnimationFrame(tick);
      else setZoomTarget(null);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [zoomTarget, zoomLevel]);

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.zoom = zoomLevel;
    cameraRef.current.updateProjectionMatrix();
  }, [zoomLevel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (!isPointerInside) return;
      event.preventDefault();
      setZoomTarget(null);
      const change = event.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel((current) =>
        Math.min(maxZoom, Math.max(minZoom, Number((current + change).toFixed(2)))),
      );
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isPointerInside]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (transitionTarget === null) return;

    let frameId = 0;
    let startTime = 0;
    const duration = 650;

    const tick = (timestamp: number) => {
      if (startTime === 0) startTime = timestamp;
      const nextProgress = Math.min((timestamp - startTime) / duration, 1);
      setTransitionProgress(nextProgress);

      if (nextProgress < 1) frameId = window.requestAnimationFrame(tick);
      else {
        setActivePanoramaId(transitionTarget);
        setTransitionTarget(null);
        setTransitionProgress(0);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [transitionTarget]);

  const navigateToScene = useCallback(
    (index: number) => {
      const target = scenes[index];
      if (!target || target.id === activePanoramaId || transitionTarget) return;
      setTransitionTarget(target.id);
      setTransitionProgress(0);
    },
    [activePanoramaId, transitionTarget],
  );

  const navigateBy = (offset: number) => {
    navigateToScene((activeSceneIndex + offset + scenes.length) % scenes.length);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) await document.exitFullscreen();
    else await container.requestFullscreen();
  };

  const handlePanoramaAspectRatio = useCallback((id: PanoramaId, aspectRatio: number) => {
    setPanoramaAspectRatios((current) =>
      current[id] === aspectRatio ? current : { ...current, [id]: aspectRatio },
    );
  }, []);

  return (
    <div
      ref={setContainer}
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
      className={`relative w-full select-none touch-none overflow-hidden bg-[#120f0b] shadow-2xl transition-all duration-300 ${isFullscreen
        ? 'h-dvh rounded-none border-0'
        : 'h-130 rounded-3xl border-4 border-[#e5a930] md:h-175'
        }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,240,212,0.3),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_100%)]" />

      <div className="absolute left-4 right-4 top-4 z-20 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm rounded-2xl bg-black/35 px-4 py-3 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.3em] text-[#f5cf82]">360° Virtual Tour</p>
          <h3 className="mt-1 text-xl font-medium text-white md:text-2xl">{activeScene.title}</h3>
          <p className="mt-1 text-sm text-white/75">{activeScene.subtitle}</p>
        </div>

        <div className="flex shrink-0 gap-3">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-white/20 bg-black/35 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setZoomTarget(Number(Math.max(minZoom, zoomLevel - zoomStep).toFixed(2)))}
              className="px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              aria-label="Zoom out"
            >
              −
            </button>
            <div className="px-4 py-3 text-sm font-medium text-white/80">Zoom</div>
            <button
              type="button"
              onClick={() => setZoomTarget(Number(Math.min(maxZoom, zoomLevel + zoomStep).toFixed(2)))}
              className="px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-4 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/55"
          >
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
      </div>

      <div className="absolute inset-0">
        <Canvas
          gl={{ antialias: true, alpha: true }}
          eventSource={eventSource ?? undefined}
          eventPrefix="client"
          className="touch-none"
        >
          <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            position={[0, 0, 0.1]}
            fov={CAMERA_FOV}
            zoom={zoomLevel}
          />
          <color attach="background" args={['#120f0b']} />
          <PanoramaScene
            current={activeScene}
            next={nextScene}
            progress={transitionProgress}
            onAspectRatio={handlePanoramaAspectRatio}
          />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            rotateSpeed={isFullscreen ? -0.35 : -0.4}
            minPolarAngle={minPolarAngle}
            maxPolarAngle={maxPolarAngle}
          />
        </Canvas>

        <TourNavigation
          activeIndex={activeSceneIndex}
          disabled={Boolean(transitionTarget)}
          onPrevious={() => navigateBy(-1)}
          onNext={() => navigateBy(1)}
          onSelect={navigateToScene}
        />

        {transitionTarget ? (
          <div className="pointer-events-none absolute inset-0 z-10 bg-black/10" />
        ) : null}
      </div>
    </div>
  );
}

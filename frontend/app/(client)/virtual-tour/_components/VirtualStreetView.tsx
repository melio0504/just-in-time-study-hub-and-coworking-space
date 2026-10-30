"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BackSide,
  getConsoleFunction,
  setConsoleFunction,
  TextureLoader,
  type PerspectiveCamera as ThreePerspectiveCamera,
  Vector3,
} from "three";
import {
  type BookingSettings,
  type BusinessHours,
  DEFAULT_BOOKING_SETTINGS,
  formatTime,
  hoursAvailableFrom,
  meetsMinimumNotice,
  reservationDateForTime,
  reservationTimeOptions,
} from "@/lib/business-config";
import {
  formatReservedSeatWindow,
  getOperatingDayAvailabilityWindow,
  getReservationAvailabilityWindow,
  getSeatSelectionAvailabilityWindow,
  groupReservedSeatWindows,
  isReservationWindowFullyReserved,
  type ReservedSeatWindow,
  SEAT_AVAILABILITY_REFRESH_MS,
} from "@/lib/seatAvailability";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ReservationSelect } from "../../reserve/_components/ReservationSelect";
import { PANORAMA_IMAGES, type PanoramaId } from "../_lib/tourGraph";
import {
  VIRTUAL_PANORAMA_HEIGHT,
  VIRTUAL_PANORAMA_WIDTH,
  VIRTUAL_SEAT_MARKERS,
  VIRTUAL_SEAT_MARKERS_BY_PANORAMA,
  type VirtualSeatMarker,
} from "../_lib/virtualSeats";

type Scene = {
  id: PanoramaId;
  title: string;
  subtitle: string;
  image: string;
};

const scenes: Scene[] = [
  {
    id: "pods",
    title: "Private Study Pods",
    subtitle: "Individual desks for distraction-free work.",
    image: PANORAMA_IMAGES.overview,
  },
  {
    id: "overview",
    title: "Study Hub Overview",
    subtitle: "Reception and the heart of the study hub.",
    image: PANORAMA_IMAGES.pods,
  },
  {
    id: "lounge",
    title: "Floor Desk Study",
    subtitle: "Relaxed spaces for someone who loves seating",
    image: PANORAMA_IMAGES.lounge,
  },
  {
    id: "study",
    title: "Quiet Study Zone",
    subtitle: "Shared tables and focused desks along the quiet wall.",
    image: PANORAMA_IMAGES.study,
  },
];

const CAMERA_FOV = 75;
const CAMERA_ORBIT_RADIUS = 0.1;
const PODS_LEFT_CAMERA_POSITION: [number, number, number] = [0.008, 0, -CAMERA_ORBIT_RADIUS];
const OVERVIEW_LEFT_CAMERA_POSITION: [number, number, number] = [CAMERA_ORBIT_RADIUS, 0, 0];
const LEFT_CAMERA_POSITION: [number, number, number] = [0.072, 0, 0.069];
const PANORAMA_RADIUS = 500;
const MARKER_RADIUS = 480;
const MARKER_HORIZONTAL_OFFSET = 70;
const MARKER_VERTICAL_OFFSET = 40;

type SeatDisplayStatus = "free" | "reserved" | "in_use";

type SeatDisplay = {
  code: string;
  name: string;
  status: SeatDisplayStatus;
};

const STATUS_DETAILS: Record<
  SeatDisplayStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  free: {
    label: "Free",
    dotClass: "bg-emerald-500 ring-emerald-200",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
  reserved: {
    label: "Reserved",
    dotClass: "bg-amber-500 ring-amber-200",
    badgeClass: "bg-amber-50 text-amber-800",
  },
  in_use: {
    label: "Used currently",
    dotClass: "bg-rose-500 ring-rose-200",
    badgeClass: "bg-rose-50 text-rose-700",
  },
};

const getManilaDateString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getVerticalCoverage = (aspectRatio: number) => Math.min(Math.PI, (Math.PI * 2) / aspectRatio);
const REACT_THREE_CLOCK_DEPRECATION =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";

const getEndTimeDetails = (startTime: string, durationHours: string) => {
  if (!startTime || !durationHours) return { label: "", time: "", nextDay: false };

  const [startHour, startMinute] = startTime.slice(0, 5).split(":").map(Number);
  const absoluteEndMinutes = startHour * 60 + startMinute + Number(durationHours) * 60;
  const endMinutes = absoluteEndMinutes % 1440;
  const time = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  const nextDay = absoluteEndMinutes >= 1440;

  return {
    label: `${formatTime(time)}${nextDay ? " (next day)" : ""}`,
    time,
    nextDay,
  };
};

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
      <sphereGeometry
        args={[PANORAMA_RADIUS, 64, 64, 0, Math.PI * 2, verticalStart, verticalCoverage]}
      />
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

function markerPosition(marker: VirtualSeatMarker): [number, number, number] {
  const verticalCoverage = getVerticalCoverage(VIRTUAL_PANORAMA_WIDTH / VIRTUAL_PANORAMA_HEIGHT);
  const theta =
    (Math.PI - verticalCoverage) / 2 +
    ((marker.y + MARKER_VERTICAL_OFFSET + (marker.yOffset ?? 0)) / VIRTUAL_PANORAMA_HEIGHT) *
      verticalCoverage;
  const longitude =
    ((marker.x + MARKER_HORIZONTAL_OFFSET + (marker.xOffset ?? 0)) / VIRTUAL_PANORAMA_WIDTH) *
    Math.PI *
    2;
  const sinTheta = Math.sin(theta);

  return [
    MARKER_RADIUS * Math.cos(longitude) * sinTheta,
    MARKER_RADIUS * Math.cos(theta),
    MARKER_RADIUS * Math.sin(longitude) * sinTheta,
  ];
}

function CameraOrientation({
  panoramaId,
  cameraRef,
}: {
  panoramaId: PanoramaId;
  cameraRef: { current: ThreePerspectiveCamera | null };
}) {
  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const position =
      panoramaId === "pods"
        ? PODS_LEFT_CAMERA_POSITION
        : panoramaId === "overview"
          ? OVERVIEW_LEFT_CAMERA_POSITION
          : LEFT_CAMERA_POSITION;
    camera.position.set(...position);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [cameraRef, panoramaId]);

  return null;
}

function SeatMarkerProjection({
  markers,
  markerElements,
}: {
  markers: VirtualSeatMarker[];
  markerElements: React.RefObject<Map<string, HTMLDivElement>>;
}) {
  const worldPositions = useMemo(
    () => new Map(markers.map((marker) => [marker.code, new Vector3(...markerPosition(marker))])),
    [markers],
  );
  const projectedPosition = useMemo(() => new Vector3(), []);
  const cameraDirection = useMemo(() => new Vector3(), []);
  const markerDirection = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    camera.getWorldDirection(cameraDirection);

    for (const marker of markers) {
      const element = markerElements.current.get(marker.code);
      const worldPosition = worldPositions.get(marker.code);
      if (!element || !worldPosition) continue;

      markerDirection.copy(worldPosition).sub(camera.position);
      projectedPosition.copy(worldPosition).project(camera);
      const visible =
        markerDirection.dot(cameraDirection) > 0 &&
        projectedPosition.z >= -1 &&
        projectedPosition.z <= 1;
      if (!visible) {
        element.style.visibility = "hidden";
        continue;
      }

      const x = (projectedPosition.x * 0.5 + 0.5) * size.width;
      const y = (-projectedPosition.y * 0.5 + 0.5) * size.height;
      element.style.visibility = "visible";
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
  });

  return null;
}

function SeatMarkerOverlay({
  markers,
  seats,
  selectedSeats,
  reservedSeatWindows,
  onOpenSeat,
  markerElements,
}: {
  markers: VirtualSeatMarker[];
  seats: Map<string, SeatDisplay>;
  selectedSeats: Set<string>;
  reservedSeatWindows: Record<string, ReservedSeatWindow[]>;
  onOpenSeat: (seat: SeatDisplay) => void;
  markerElements: React.RefObject<Map<string, HTMLDivElement>>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      {markers.map((marker) => {
        const seat = seats.get(marker.code);
        if (!seat) return null;

        const details = STATUS_DETAILS[seat.status];
        const isSelected = selectedSeats.has(seat.code);
        const reservedWindows = reservedSeatWindows[seat.code] ?? [];
        const reservedTimeLabel = reservedWindows.map(formatReservedSeatWindow).join(", ");
        return (
          <div
            key={marker.code}
            ref={(element) => {
              if (element) markerElements.current.set(marker.code, element);
              else markerElements.current.delete(marker.code);
            }}
            className="invisible absolute left-0 top-0 will-change-transform"
          >
            <button
              type="button"
              aria-pressed={isSelected}
              aria-label={`${seat.name}: ${isSelected ? "selected" : details.label}`}
              title={
                seat.status === "reserved" && reservedTimeLabel
                  ? `Reserved ${reservedTimeLabel}`
                  : undefined
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onOpenSeat(seat);
              }}
              className="group pointer-events-auto relative flex -translate-y-12 cursor-pointer flex-col items-center focus:outline-none"
            >
              {seat.status === "reserved" && reservedWindows.length > 0 ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-[#241b0f]/95 px-3 py-2 text-left text-[10px] font-medium leading-4 text-white shadow-xl group-hover:block group-focus-visible:block"
                >
                  Reserved: {reservedTimeLabel}
                </span>
              ) : null}
              <div
                className={`min-w-20 rounded-lg border px-2.5 py-1.5 text-center shadow-[0_5px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-400"
                    : "border-white/70 bg-white/95 group-hover:border-[#f5cf82] group-hover:ring-2 group-hover:ring-[#e5a930]"
                }`}
              >
                <p className="whitespace-nowrap text-[11px] font-bold leading-tight text-[#2d2520]">
                  Seat {seat.code}
                </p>
                <span
                  className={`mt-1 inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold leading-tight ${
                    isSelected ? "bg-blue-100 text-blue-700" : details.badgeClass
                  }`}
                >
                  {isSelected ? "Selected" : details.label}
                </span>
              </div>
              <span className="h-2 w-px bg-white/90 shadow-sm" aria-hidden />
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-sm transition ${
                  isSelected ? "scale-110 bg-blue-600" : "bg-black/70 group-hover:scale-110"
                }`}
              >
                {isSelected ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <MapPin className="h-4 w-4" aria-hidden />
                )}
                <span
                  className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ${details.dotClass}`}
                />
              </div>
            </button>
          </div>
        );
      })}
    </div>
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
              className={`group flex h-11 items-center rounded-full px-2 transition sm:px-3 ${
                index === activeIndex
                  ? "bg-white text-[#2d2520]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              aria-label={`Open ${scene.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              <span
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-[#e5a930]" : "w-2 bg-current group-hover:w-4"
                }`}
              />
              <span
                className={`ml-2 text-xs font-semibold ${index === activeIndex ? "" : "hidden sm:inline"}`}
              >
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
  const router = useRouter();
  const [isThreeConsoleReady, setIsThreeConsoleReady] = useState(false);
  const [activePanoramaId, setActivePanoramaId] = useState<PanoramaId>(scenes[0].id);
  const [transitionTarget, setTransitionTarget] = useState<PanoramaId | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomTarget, setZoomTarget] = useState<number | null>(null);
  const [panoramaAspectRatios, setPanoramaAspectRatios] = useState<
    Partial<Record<PanoramaId, number>>
  >({});
  const [selectedDate, setSelectedDate] = useState(getManilaDateString);
  const [seatAvailability, setSeatAvailability] = useState<Map<string, SeatDisplay>>(new Map());
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(isSupabaseConfigured);
  const [availabilityError, setAvailabilityError] = useState(
    isSupabaseConfigured ? "" : "Seat availability is temporarily unavailable.",
  );
  const [reservedSeatWindows, setReservedSeatWindows] = useState<
    Record<string, ReservedSeatWindow[]>
  >({});
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [configurationLoading, setConfigurationLoading] = useState(isSupabaseConfigured);
  const [configurationError, setConfigurationError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("");
  const [activeSeatCode, setActiveSeatCode] = useState<string | null>(null);
  const [draftStartTime, setDraftStartTime] = useState("");
  const [draftDuration, setDraftDuration] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    isSupabaseConfigured ? null : false,
  );
  const [isSignInPromptOpen, setIsSignInPromptOpen] = useState(false);
  const [selectedSeatCodes, setSelectedSeatCodes] = useState<string[]>([]);
  const [isReservePromptOpen, setIsReservePromptOpen] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [eventSource, setEventSource] = useState<HTMLDivElement | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const markerElementsRef = useRef(new Map<string, HTMLDivElement>());
  const minZoom = 0.75;
  const maxZoom = 1.8;
  const zoomStep = 0.16;
  const today = getManilaDateString();

  useLayoutEffect(() => {
    const previousConsoleFunction = getConsoleFunction();
    setConsoleFunction((type, message, ...params) => {
      if (type === "warn" && message === REACT_THREE_CLOCK_DEPRECATION) return;
      if (previousConsoleFunction) {
        previousConsoleFunction(type, message, ...params);
        return;
      }
      console[type](message, ...params);
    });
    setIsThreeConsoleReady(true);

    return () => setConsoleFunction(previousConsoleFunction);
  }, []);

  const setContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setEventSource(node);
  }, []);

  const activeSceneIndex = scenes.findIndex((scene) => scene.id === activePanoramaId);
  const activeScene = scenes[activeSceneIndex] ?? scenes[0];
  const nextScene = useMemo(
    () =>
      transitionTarget ? (scenes.find((scene) => scene.id === transitionTarget) ?? null) : null,
    [transitionTarget],
  );
  const activePanoramaAspectRatio = panoramaAspectRatios[activePanoramaId] ?? 2;
  const activeVerticalCoverage = getVerticalCoverage(activePanoramaAspectRatio);
  const widestCameraVerticalFov = 2 * Math.atan(Math.tan((CAMERA_FOV * Math.PI) / 360) / minZoom);
  const verticalLookRange = Math.max(0.04, (activeVerticalCoverage - widestCameraVerticalFov) / 2);
  const minPolarAngle = Math.PI / 2 - verticalLookRange;
  const maxPolarAngle = Math.PI / 2 + verticalLookRange;
  const selectedSeatSet = useMemo(() => new Set(selectedSeatCodes), [selectedSeatCodes]);
  const activeSeatMarkers = VIRTUAL_SEAT_MARKERS_BY_PANORAMA[activePanoramaId] ?? [];
  const activeSeat = activeSeatCode ? (seatAvailability.get(activeSeatCode) ?? null) : null;
  const maxSeatCount = bookingSettings.max_seats_per_booking;
  const selectedEndTime = getEndTimeDetails(selectedStartTime, selectedDuration);
  const selectedTimeRange =
    selectedStartTime && selectedDuration
      ? `${formatTime(selectedStartTime)} – ${selectedEndTime.label}`
      : "Choose a seat to select a time";

  const handleOpenSeat = useCallback(
    async (seat: SeatDisplay) => {
      let signedIn = isAuthenticated;
      if (signedIn === null && isSupabaseConfigured) {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        signedIn = Boolean(user);
        setIsAuthenticated(signedIn);
      }
      if (!signedIn) {
        setActiveSeatCode(null);
        setIsSignInPromptOpen(true);
        return;
      }

      setActiveSeatCode(seat.code);
      setDraftStartTime(selectedStartTime);
      setDraftDuration(selectedDuration);
      setSelectionError("");
    },
    [isAuthenticated, selectedDuration, selectedStartTime],
  );

  const clearSelectedSeats = useCallback(() => {
    setSelectedSeatCodes([]);
    setSelectionError("");
    setIsReservePromptOpen(false);
  }, []);

  const removeActiveSeat = useCallback(() => {
    if (!activeSeatCode) return;
    setSelectedSeatCodes((current) => current.filter((code) => code !== activeSeatCode));
    setActiveSeatCode(null);
    setSelectionError("");
  }, [activeSeatCode]);

  const continueToReservation = useCallback(async () => {
    if (selectedSeatCodes.length === 0) return;

    const params = new URLSearchParams({
      seats: selectedSeatCodes.join(","),
      date: selectedDate,
      focus: "schedule",
    });
    if (selectedStartTime && selectedDuration) {
      params.set("time", selectedStartTime);
      params.set("duration", selectedDuration);
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    router.push(`/reserve?${params.toString()}`);
  }, [router, selectedDate, selectedDuration, selectedSeatCodes, selectedStartTime]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const loadConfiguration = async () => {
      const supabase = createClient();
      const [hoursResult, settingsResult] = await Promise.all([
        supabase.from("business_hours").select().order("day_of_week"),
        supabase
          .from("booking_settings")
          .select(
            "max_seats_per_booking, min_duration_hours, max_duration_hours, minimum_notice_minutes, maximum_advance_days",
          )
          .eq("singleton", true)
          .single(),
      ]);
      if (cancelled) return;

      const error = hoursResult.error || settingsResult.error;
      setConfigurationError(error ? `Unable to load booking hours: ${error.message}` : "");
      setBusinessHours(hoursResult.data ?? []);
      if (settingsResult.data) setBookingSettings(settingsResult.data);
      setConfigurationLoading(false);
    };

    void loadConfiguration();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setIsAuthenticated(Boolean(data.user));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session?.user);
      setIsAuthenticated(signedIn);
      if (!signedIn) {
        setActiveSeatCode(null);
        clearSelectedSeats();
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [clearSelectedSeats]);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(new Date());
    const refreshInterval = window.setInterval(updateCurrentTime, 30_000);
    window.addEventListener("focus", updateCurrentTime);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", updateCurrentTime);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const loadSeatAvailability = async (showLoading = false) => {
      if (showLoading) setIsAvailabilityLoading(true);
      setAvailabilityError("");

      const supabase = createClient();
      const bookingDate = selectedStartTime
        ? reservationDateForTime(selectedDate, selectedStartTime, businessHours)
        : selectedDate;
      const { startsAt, endsAt } = getSeatSelectionAvailabilityWindow(
        bookingDate,
        selectedStartTime,
        selectedDuration,
        bookingSettings.min_duration_hours,
      );
      const operatingDay = getOperatingDayAvailabilityWindow(selectedDate);
      const markerCodes = VIRTUAL_SEAT_MARKERS.map(({ code }) => code);
      const [availableResult, seatsResult, reservationDetailsResult] = await Promise.all([
        supabase.rpc("get_available_seats", {
          p_starts_at: startsAt,
          p_ends_at: endsAt,
        }),
        supabase.from("seats").select("code, name, status").in("code", markerCodes),
        supabase.rpc("get_reserved_seat_windows", {
          p_starts_at: operatingDay.startsAt,
          p_ends_at: operatingDay.endsAt,
        }),
      ]);

      if (cancelled) return;
      if (availableResult.error || seatsResult.error || reservationDetailsResult.error) {
        setAvailabilityError(
          availableResult.error?.message ??
            seatsResult.error?.message ??
            reservationDetailsResult.error?.message ??
            "Unable to load seat availability.",
        );
        if (showLoading) {
          setSeatAvailability(new Map());
          setReservedSeatWindows({});
        }
        setIsAvailabilityLoading(false);
        return;
      }

      const availableCodes = new Set((availableResult.data ?? []).map(({ code }) => code));
      const isToday = selectedDate === today;
      const nextAvailability = new Map<string, SeatDisplay>(
        (seatsResult.data ?? []).map((seat): [string, SeatDisplay] => [
          seat.code,
          {
            code: seat.code,
            name: seat.name,
            status:
              isToday && seat.status === "occupied"
                ? "in_use"
                : availableCodes.has(seat.code)
                  ? "free"
                  : "reserved",
          },
        ]),
      );
      setSeatAvailability(nextAvailability);
      setReservedSeatWindows(groupReservedSeatWindows(reservationDetailsResult.data ?? []));
      setSelectedSeatCodes((current) =>
        current.filter((code) => nextAvailability.get(code)?.status === "free"),
      );
      setIsAvailabilityLoading(false);
    };

    const refreshAvailability = () => void loadSeatAvailability();
    const refreshInterval = window.setInterval(refreshAvailability, SEAT_AVAILABILITY_REFRESH_MS);
    window.addEventListener("focus", refreshAvailability);

    void loadSeatAvailability(true);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshAvailability);
    };
  }, [
    bookingSettings.min_duration_hours,
    businessHours,
    selectedDate,
    selectedDuration,
    selectedStartTime,
    today,
  ]);

  useEffect(() => {
    if (zoomTarget === null) return;

    let frameId = 0;
    const startZoom = zoomLevel;
    const startTime = performance.now();
    const duration = 180;

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
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

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [isPointerInside]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
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

  const activeSeatReservedWindows = activeSeatCode
    ? (reservedSeatWindows[activeSeatCode] ?? [])
    : [];
  const activeSeatHasNoSchedule =
    activeSeat?.status === "in_use" ||
    (activeSeat?.status === "reserved" && activeSeatReservedWindows.length === 0);
  const draftBookingDate = draftStartTime
    ? reservationDateForTime(selectedDate, draftStartTime, businessHours)
    : selectedDate;
  const draftReservationWindow = getReservationAvailabilityWindow(
    draftBookingDate,
    draftStartTime,
    draftDuration,
  );
  const draftTimeIsReserved = Boolean(
    activeSeatCode &&
      draftStartTime &&
      draftDuration &&
      isReservationWindowFullyReserved(
        reservedSeatWindows,
        [activeSeatCode],
        draftReservationWindow,
      ),
  );
  const modalTimeOptions = reservationTimeOptions(selectedDate, businessHours)
    .filter(([time]) =>
      meetsMinimumNotice(
        reservationDateForTime(selectedDate, time, businessHours),
        time,
        bookingSettings.minimum_notice_minutes,
        currentTime,
      ),
    )
    .map(([time, label]) => {
      const bookingDate = reservationDateForTime(selectedDate, time, businessHours);
      const minimumWindow = getReservationAvailabilityWindow(
        bookingDate,
        time,
        String(bookingSettings.min_duration_hours),
      );
      const reserved = Boolean(
        activeSeatCode &&
          isReservationWindowFullyReserved(reservedSeatWindows, [activeSeatCode], minimumWindow),
      );
      const disabled = activeSeatHasNoSchedule || reserved;

      return [time, disabled ? `${label} (Reserved)` : label, disabled] as const;
    });
  const hoursUntilClosing = draftStartTime
    ? hoursAvailableFrom(selectedDate, draftStartTime, businessHours)
    : 0;
  const modalEndTimeOptions = Array.from(
    {
      length: Math.max(
        0,
        Math.min(bookingSettings.max_duration_hours, hoursUntilClosing) -
          bookingSettings.min_duration_hours +
          1,
      ),
    },
    (_, index) => bookingSettings.min_duration_hours + index,
  ).map((durationHours) => {
    const duration = String(durationHours);
    const bookingDate = reservationDateForTime(selectedDate, draftStartTime, businessHours);
    const window = getReservationAvailabilityWindow(bookingDate, draftStartTime, duration);
    const reserved = Boolean(
      activeSeatCode &&
        isReservationWindowFullyReserved(reservedSeatWindows, [activeSeatCode], window),
    );
    const end = getEndTimeDetails(draftStartTime, duration);

    return [duration, reserved ? `${end.label} (Reserved)` : end.label, reserved] as const;
  });
  const canApplySeatTime = Boolean(
    activeSeat &&
      draftStartTime &&
      draftDuration &&
      !activeSeatHasNoSchedule &&
      !draftTimeIsReserved &&
      !configurationError,
  );

  const applySeatTime = () => {
    if (!activeSeatCode || !canApplySeatTime) return;

    const nextBookingDate = reservationDateForTime(selectedDate, draftStartTime, businessHours);
    const nextWindow = getReservationAvailabilityWindow(
      nextBookingDate,
      draftStartTime,
      draftDuration,
    );
    const availableSelections = selectedSeatCodes.filter(
      (code) =>
        code === activeSeatCode ||
        !isReservationWindowFullyReserved(reservedSeatWindows, [code], nextWindow),
    );
    if (!availableSelections.includes(activeSeatCode)) {
      if (availableSelections.length >= maxSeatCount) {
        setSelectionError(`You can select up to ${maxSeatCount} seats only.`);
        return;
      }
      availableSelections.push(activeSeatCode);
    }
    setSelectedStartTime(draftStartTime);
    setSelectedDuration(draftDuration);
    setSelectedSeatCodes(availableSelections);
    setSelectionError("");
    setActiveSeatCode(null);
  };

  useEffect(() => {
    if (!activeSeatCode && !isSignInPromptOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveSeatCode(null);
        setIsSignInPromptOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeSeatCode, isSignInPromptOpen]);

  return (
    <div
      ref={setContainer}
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
      className={`relative isolate w-full select-none touch-none overflow-hidden bg-[#120f0b] shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? "h-dvh rounded-none border-0"
          : "h-130 rounded-3xl border-4 border-[#e5a930] md:h-175"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,240,212,0.3),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_100%)]" />

      <div className="absolute left-4 right-4 top-4 z-20 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-fit max-w-full self-start rounded-2xl bg-black/35 px-4 py-3 backdrop-blur-md sm:max-w-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[#f5cf82]">360° Virtual Tour</p>
          <h3 className="mt-1 text-xl font-medium text-white md:text-2xl">{activeScene.title}</h3>
          <p className="mt-1 text-sm text-white/75">{activeScene.subtitle}</p>
          <label className="mt-3 flex items-center gap-2 border-t border-white/15 pt-3 text-xs font-medium text-white/80">
            <CalendarDays className="h-4 w-4 text-[#f5cf82]" aria-hidden />
            <span>Seat availability</span>
            <input
              type="date"
              min={today}
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value >= today) {
                  setSelectedDate(event.target.value);
                  setSelectedStartTime("");
                  setSelectedDuration("");
                  clearSelectedSeats();
                }
              }}
              className="min-w-0 rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-xs text-white scheme-dark outline-none focus:border-[#f5cf82]"
              aria-label="Choose a date to check seat availability"
            />
          </label>
          {availabilityError ? (
            <p className="mt-2 text-xs text-rose-200" role="alert">
              {availabilityError}
            </p>
          ) : (
            <div
              className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-white/80"
              aria-live="polite"
            >
              {isAvailabilityLoading ? (
                <span>Checking seats…</span>
              ) : (
                Object.entries(STATUS_DETAILS).map(([status, details]) => (
                  <span key={status} className="inline-flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ring-1 ${details.dotClass}`} />
                    {details.label}
                  </span>
                ))
              )}
            </div>
          )}
          <div className="mt-3 flex items-start gap-2 border-t border-white/15 pt-3 text-xs text-white/80">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#f5cf82]" aria-hidden />
            <div>
              <p className="font-medium text-white">{selectedTimeRange}</p>
              <p className="mt-0.5 text-[10px] text-white/65">
                Click a seat marker to choose its start and end time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-white/20 bg-black/35 backdrop-blur-md">
            <button
              type="button"
              onClick={() =>
                setZoomTarget(Number(Math.max(minZoom, zoomLevel - zoomStep).toFixed(2)))
              }
              className="px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              aria-label="Zoom out"
            >
              −
            </button>
            <div className="px-4 py-3 text-sm font-medium text-white/80">Zoom</div>
            <button
              type="button"
              onClick={() =>
                setZoomTarget(Number(Math.min(maxZoom, zoomLevel + zoomStep).toFixed(2)))
              }
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
            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>
      </div>

      <div className="absolute inset-0">
        {isThreeConsoleReady ? (
          <Canvas
            gl={{ antialias: true, alpha: true }}
            eventSource={eventSource ?? undefined}
            eventPrefix="client"
            className="touch-none"
          >
            <PerspectiveCamera
              ref={cameraRef}
              makeDefault
              position={PODS_LEFT_CAMERA_POSITION}
              fov={CAMERA_FOV}
              zoom={zoomLevel}
            />
            <CameraOrientation panoramaId={activePanoramaId} cameraRef={cameraRef} />
            <color attach="background" args={["#120f0b"]} />
            <PanoramaScene
              current={activeScene}
              next={nextScene}
              progress={transitionProgress}
              onAspectRatio={handlePanoramaAspectRatio}
            />
            {activeSeatMarkers.length > 0 &&
            !transitionTarget &&
            !isAvailabilityLoading &&
            !availabilityError ? (
              <SeatMarkerProjection
                key={activePanoramaId}
                markers={activeSeatMarkers}
                markerElements={markerElementsRef}
              />
            ) : null}
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              rotateSpeed={isFullscreen ? -0.35 : -0.4}
              minPolarAngle={minPolarAngle}
              maxPolarAngle={maxPolarAngle}
            />
          </Canvas>
        ) : null}

        {activeSeatMarkers.length > 0 &&
        !transitionTarget &&
        !isAvailabilityLoading &&
        !availabilityError ? (
          <SeatMarkerOverlay
            key={activePanoramaId}
            markers={activeSeatMarkers}
            seats={seatAvailability}
            selectedSeats={selectedSeatSet}
            reservedSeatWindows={reservedSeatWindows}
            onOpenSeat={handleOpenSeat}
            markerElements={markerElementsRef}
          />
        ) : null}

        <TourNavigation
          activeIndex={activeSceneIndex}
          disabled={Boolean(transitionTarget)}
          onPrevious={() => navigateBy(-1)}
          onNext={() => navigateBy(1)}
          onSelect={navigateToScene}
        />

        {selectedSeatCodes.length > 0 ? (
          <div className="absolute bottom-20 left-4 z-30 rounded-2xl border border-white/20 bg-black/70 p-3 text-white shadow-xl backdrop-blur-md md:bottom-6">
            <p className="text-xs font-semibold">
              Selected seats ({selectedSeatCodes.length}/{maxSeatCount})
            </p>
            <p className="mt-1 max-w-56 truncate text-xs text-white/75">
              {selectedSeatCodes.join(", ")}
            </p>
            {selectedStartTime && selectedDuration ? (
              <p className="mt-1 text-xs text-[#f5cf82]">{selectedTimeRange}</p>
            ) : null}
            {selectionError ? (
              <p className="mt-2 text-xs text-rose-200" role="alert">
                {selectionError}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsReservePromptOpen(true)}
                className="rounded-full bg-[#e5a930] px-3 py-1.5 text-xs font-semibold text-[#241b0f] transition hover:bg-[#f5cf82]"
              >
                Reserve selected
              </button>
              <button
                type="button"
                onClick={clearSelectedSeats}
                className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {transitionTarget ? (
          <div className="pointer-events-none absolute inset-0 z-10 bg-black/10" />
        ) : null}
      </div>

      {isSignInPromptOpen ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setIsSignInPromptOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-sign-in-title"
            aria-describedby="seat-sign-in-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c98d17]">
                  Member access
                </p>
                <h3 id="seat-sign-in-title" className="mt-2 text-2xl font-semibold">
                  Sign in to choose a seat time
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSignInPromptOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ded4c7] text-[#6b5e52] transition hover:bg-[#f8f3ec]"
                aria-label="Close sign-in prompt"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <p id="seat-sign-in-description" className="mt-3 text-sm leading-6 text-[#6b5e52]">
              Please sign in before selecting a time range. This keeps your chosen seat and booking
              details connected to your account.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsSignInPromptOpen(false)}
                className="rounded-full border border-[#ded4c7] px-5 py-2.5 text-sm font-semibold text-[#6b5e52] transition hover:bg-[#f8f3ec]"
              >
                Not now
              </button>
              <Link
                href="/register"
                className="rounded-full border border-[#e5a930] px-5 py-2.5 text-center text-sm font-semibold text-[#9a6a0d] transition hover:bg-[#fff8ed]"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-[#e5a930] px-5 py-2.5 text-center text-sm font-semibold text-[#241b0f] transition hover:bg-[#f5cf82]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {activeSeat ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setActiveSeatCode(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-time-title"
            aria-describedby="seat-time-description"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c98d17]">
                  Seat {activeSeat.code}
                </p>
                <h3 id="seat-time-title" className="mt-2 text-2xl font-semibold">
                  Choose your time range
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSeatCode(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ded4c7] text-[#6b5e52] transition hover:bg-[#f8f3ec]"
                aria-label="Close seat time picker"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <p id="seat-time-description" className="mt-2 text-sm leading-6 text-[#6b5e52]">
              Select when you want to use {activeSeat.name} on{" "}
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-PH", {
                dateStyle: "long",
              })}
              . Reserved choices are disabled.
            </p>

            {activeSeatReservedWindows.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Reserved times
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-950">
                  {activeSeatReservedWindows.map((window) => (
                    <li key={`${window.startsAt}-${window.endsAt}`}>
                      {formatReservedSeatWindow(window)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {configurationError ? (
              <p
                className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {configurationError}
              </p>
            ) : null}
            {activeSeatHasNoSchedule ? (
              <p
                className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="status"
              >
                This seat is currently unavailable. Please choose another seat.
              </p>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="virtual-tour-start-time"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6b5e52]"
                >
                  Start Time
                </label>
                <ReservationSelect
                  id="virtual-tour-start-time"
                  name="virtualTourStartTime"
                  value={draftStartTime}
                  options={modalTimeOptions}
                  onChange={(value) => {
                    setDraftStartTime(value);
                    setDraftDuration("");
                  }}
                  disabled={
                    configurationLoading || Boolean(configurationError) || activeSeatHasNoSchedule
                  }
                  placeholder={configurationLoading ? "Loading times…" : "Select start time"}
                  listboxLabel={`Available start times for seat ${activeSeat.code}`}
                  emptyMessage="No start times are available for this date."
                  portalMenu
                  separateNextDay
                />
              </div>
              <div>
                <label
                  htmlFor="virtual-tour-end-time"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6b5e52]"
                >
                  End Time
                </label>
                <ReservationSelect
                  id="virtual-tour-end-time"
                  name="virtualTourEndTime"
                  value={draftDuration}
                  options={modalEndTimeOptions}
                  onChange={setDraftDuration}
                  disabled={!draftStartTime || activeSeatHasNoSchedule}
                  placeholder={draftStartTime ? "Select end time" : "Select a start time first"}
                  listboxLabel={`Available end times for seat ${activeSeat.code}`}
                  emptyMessage="No end times are available for this start time."
                  portalMenu
                />
              </div>
            </div>

            {draftTimeIsReserved ? (
              <p className="mt-4 text-sm text-amber-800" role="status">
                Seat {activeSeat.code} is reserved during this range. Choose another end time.
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div>
                {selectedSeatSet.has(activeSeat.code) ? (
                  <button
                    type="button"
                    onClick={removeActiveSeat}
                    className="w-full rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 sm:w-auto"
                  >
                    Remove seat
                  </button>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setActiveSeatCode(null)}
                  className="rounded-full border border-[#ded4c7] px-5 py-2.5 text-sm font-semibold text-[#6b5e52] transition hover:bg-[#f8f3ec]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applySeatTime}
                  disabled={!canApplySeatTime}
                  className="rounded-full bg-[#e5a930] px-5 py-2.5 text-sm font-semibold text-[#241b0f] transition hover:bg-[#f5cf82] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use time &amp; select seat
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isReservePromptOpen && selectedSeatCodes.length > 0 ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserve-seat-title"
            aria-describedby="reserve-seat-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c98d17]">
              Selected {selectedSeatCodes.length}/{maxSeatCount}
            </p>
            <h3 id="reserve-seat-title" className="mt-2 text-2xl font-semibold">
              Reserve these seats?
            </h3>
            <p id="reserve-seat-description" className="mt-2 text-sm leading-6 text-[#6b5e52]">
              {selectedSeatCodes.join(", ")} will be carried to the reservation form for{" "}
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-PH", {
                dateStyle: "long",
              })}
              .
            </p>
            <div className="mt-5 rounded-2xl bg-[#fff8ed] px-4 py-3 text-sm text-[#6b5e52]">
              {selectedStartTime && selectedDuration
                ? `${selectedTimeRange}. You can still adjust the schedule on the reservation page.`
                : `You can reserve up to ${maxSeatCount} seats together. Choose more seats or continue to select a time and duration.`}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsReservePromptOpen(false)}
                className="rounded-full border border-[#ded4c7] px-5 py-2.5 text-sm font-semibold text-[#6b5e52] transition hover:bg-[#f8f3ec]"
              >
                Choose more seats
              </button>
              <button
                type="button"
                onClick={() => void continueToReservation()}
                className="rounded-full bg-[#e5a930] px-5 py-2.5 text-sm font-semibold text-[#241b0f] transition hover:bg-[#f5cf82]"
              >
                Yes, reserve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const MAX_MENU_HEIGHT = 240;
const MIN_DESIRED_MENU_HEIGHT = 96;
const OPTION_HEIGHT = 44;
const VIEWPORT_MARGIN = 16;

type DropdownLayoutInput = {
  optionCount: number;
  triggerBottom: number;
  triggerTop: number;
  viewportHeight: number;
};

const timeValueInMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
};

export function hasReservationTimeGap(previousValue: string, currentValue: string) {
  const previousMinutes = timeValueInMinutes(previousValue);
  const currentMinutes = timeValueInMinutes(currentValue);

  return previousMinutes !== null
    && currentMinutes !== null
    && currentMinutes - previousMinutes > 60;
}

export function getReservationDropdownLayout({
  optionCount,
  triggerBottom,
  triggerTop,
  viewportHeight,
}: DropdownLayoutInput) {
  const desiredHeight = Math.min(
    MAX_MENU_HEIGHT,
    Math.max(MIN_DESIRED_MENU_HEIGHT, optionCount * OPTION_HEIGHT + 8),
  );
  const spaceAbove = Math.max(0, triggerTop - VIEWPORT_MARGIN);
  const spaceBelow = Math.max(0, viewportHeight - triggerBottom - VIEWPORT_MARGIN);
  const opensAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
  const availableSpace = opensAbove ? spaceAbove : spaceBelow;

  return {
    maxHeight: Math.max(1, Math.min(desiredHeight, availableSpace)),
    opensAbove,
  };
}

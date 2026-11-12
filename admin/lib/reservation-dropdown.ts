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

type ReservationOption = readonly [value: string, label: string, disabled?: boolean];

export function findEnabledReservationOptionIndex(
  options: ReservationOption[],
  startIndex: number,
  direction: 1 | -1,
) {
  let index = Math.max(0, Math.min(startIndex, options.length - 1));

  while (index >= 0 && index < options.length) {
    if (!options[index]?.[2]) return index;
    index += direction;
  }

  return -1;
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

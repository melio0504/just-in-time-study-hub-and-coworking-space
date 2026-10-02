import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

const VIRTUAL_INTERFACE_PATTERN = /^(br-|docker|veth|virbr|vmnet|tailscale|zt)/i;
const PHYSICAL_INTERFACE_PATTERN = /^(en|eth|wlan|wlp|wifi|wi-fi)/i;

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function addressScore(name: string, address: string) {
  let score = 0;
  if (PHYSICAL_INTERFACE_PATTERN.test(name)) score += 100;
  if (VIRTUAL_INTERFACE_PATTERN.test(name)) score -= 100;
  if (address.startsWith("192.168.")) score += 30;
  else if (address.startsWith("10.")) score += 20;
  else score += 10;
  return score;
}

export function getPrivateLanIpv4Addresses(
  interfaces?: NodeJS.Dict<NetworkInterfaceInfo[]>,
) {
  let availableInterfaces = interfaces;
  if (!availableInterfaces) {
    try {
      availableInterfaces = networkInterfaces();
    } catch (error) {
      console.warn("Unable to inspect network interfaces.", error);
      return [];
    }
  }

  return Object.entries(availableInterfaces)
    .flatMap(([name, addresses]) => (addresses ?? []).map((address) => ({ name, ...address })))
    .filter((entry) => entry.family === "IPv4" && !entry.internal && isPrivateIpv4(entry.address))
    .sort((left, right) => addressScore(right.name, right.address) - addressScore(left.name, left.address))
    .map((entry) => entry.address);
}

export function getPreferredLanIpv4Address() {
  return getPrivateLanIpv4Addresses()[0] ?? null;
}

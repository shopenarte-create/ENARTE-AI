import { adjustMarkerToCeiling } from "../app/services/placement/ceiling-plane.server.js";

const plane = {
  ceilingYMinPercent: 0,
  ceilingYMaxPercent: 36,
  preferredMountYPercent: 14,
  ceilingCenterXPercent: 50,
};

const exact = adjustMarkerToCeiling({ x: 47.2, y: 12.5 }, plane);
const offCeiling = adjustMarkerToCeiling({ x: 40, y: 55 }, plane);

console.log(
  JSON.stringify(
    {
      exact,
      offCeiling,
      exactPreserved: exact.x === 47.2 && exact.y === 12.5 && !exact.adjusted,
    },
    null,
    2,
  ),
);

if (!(exact.x === 47.2 && exact.y === 12.5 && !exact.adjusted)) {
  process.exit(1);
}

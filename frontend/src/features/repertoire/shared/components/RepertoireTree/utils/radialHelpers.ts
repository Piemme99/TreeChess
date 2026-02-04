import type { Point, PolarPoint } from './types';
import { NODE_RADIUS } from '../constants';

/**
 * Converts polar coordinates (angle, radius) to Cartesian coordinates (x, y).
 * Angle is in radians, with 0 pointing up and increasing clockwise.
 */
export function radialToCartesian(angle: number, radius: number): Point {
  // Rotate by -PI/2 so that 0 radians points up
  const adjustedAngle = angle - Math.PI / 2;
  return {
    x: Math.cos(adjustedAngle) * radius,
    y: Math.sin(adjustedAngle) * radius
  };
}

/**
 * Creates a radial link path between parent and child nodes.
 * Uses a curved path that follows the radial structure.
 */
export function createRadialLinkPath(
  fromPolar: PolarPoint,
  toPolar: PolarPoint
): string {
  const from = radialToCartesian(fromPolar.angle, fromPolar.radius);
  const to = radialToCartesian(toPolar.angle, toPolar.radius);

  // Calculate offset from node edge
  const fromAngle = fromPolar.angle - Math.PI / 2;
  const toAngle = toPolar.angle - Math.PI / 2;

  const startX = from.x + Math.cos(fromAngle) * NODE_RADIUS;
  const startY = from.y + Math.sin(fromAngle) * NODE_RADIUS;
  const endX = to.x - Math.cos(toAngle) * NODE_RADIUS;
  const endY = to.y - Math.sin(toAngle) * NODE_RADIUS;

  // Use a quadratic curve through a control point at mid-radius
  const midRadius = (fromPolar.radius + toPolar.radius) / 2;

  // If angles are very different, we might need to handle wraparound
  let angleDiff = toPolar.angle - fromPolar.angle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  const controlPoint = radialToCartesian(
    fromPolar.angle + angleDiff / 2,
    midRadius
  );

  return `M ${startX} ${startY} Q ${controlPoint.x} ${controlPoint.y} ${endX} ${endY}`;
}

/**
 * Creates a simple straight line path for radial links.
 * More suitable for radial trees where nodes are close.
 */
export function createSimpleRadialPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return '';

  // Calculate unit vector
  const ux = dx / dist;
  const uy = dy / dist;

  // Start and end offset by node radius
  const startX = from.x + ux * NODE_RADIUS;
  const startY = from.y + uy * NODE_RADIUS;
  const endX = to.x - ux * NODE_RADIUS;
  const endY = to.y - uy * NODE_RADIUS;

  // Create a subtle curve
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Perpendicular offset for curve
  const curveOffset = Math.min(15, dist * 0.1);
  const perpX = -uy * curveOffset;
  const perpY = ux * curveOffset;

  return `M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`;
}

/**
 * Creates a curved path for merge/transposition edges in radial layout.
 * The curve arcs outward to avoid crossing other nodes.
 */
export function createRadialMergePath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return '';

  // Calculate unit vector
  const ux = dx / dist;
  const uy = dy / dist;

  // Start from edge of source node
  const startX = from.x + ux * NODE_RADIUS;
  const startY = from.y + uy * NODE_RADIUS;

  // End at edge of target node
  const endX = to.x - ux * NODE_RADIUS;
  const endY = to.y - uy * NODE_RADIUS;

  // Create an outward arc - perpendicular to the line connecting nodes
  // Arc outward (away from center)
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Determine which direction is "outward" (away from center)
  const fromDist = Math.sqrt(from.x * from.x + from.y * from.y);
  const toDist = Math.sqrt(to.x * to.x + to.y * to.y);
  const avgDist = (fromDist + toDist) / 2;

  // Perpendicular direction
  const perpX = -uy;
  const perpY = ux;

  // Check which perpendicular direction is more "outward"
  const testX = midX + perpX;
  const testY = midY + perpY;
  const testDist = Math.sqrt(testX * testX + testY * testY);

  const outwardSign = testDist > avgDist ? 1 : -1;
  const curveAmount = Math.max(30, dist * 0.3);

  const controlX = midX + perpX * curveAmount * outwardSign;
  const controlY = midY + perpY * curveAmount * outwardSign;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

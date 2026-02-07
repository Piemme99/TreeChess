/** Radius of each tree node circle/square */
export const NODE_RADIUS = 16;

/** Minimum radius from center for first level nodes */
export const MIN_RADIUS = 60;

/** Radius increment per depth level */
export const RADIUS_PER_DEPTH = 70;

/** Animation duration in milliseconds */
export const ANIMATION_DURATION = 300;

/** Default dimensions for initial render */
export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 400;

/** Zoom limits */
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 10;

/** Branch color palette for visual distinction */
export const BRANCH_COLORS = [
  { id: 'red',    hex: '#E74C3C', label: 'Red' },
  { id: 'orange', hex: '#E67E22', label: 'Orange' },
  { id: 'yellow', hex: '#F1C40F', label: 'Yellow' },
  { id: 'green',  hex: '#27AE60', label: 'Green' },
  { id: 'teal',   hex: '#1ABC9C', label: 'Teal' },
  { id: 'blue',   hex: '#3498DB', label: 'Blue' },
  { id: 'purple', hex: '#9B59B6', label: 'Purple' },
  { id: 'pink',   hex: '#E91E8F', label: 'Pink' },
] as const;

/** Tidy tree (top-to-bottom) constants */
export const NODE_SPACING_X = 80;  // Horizontal spacing between siblings
export const NODE_SPACING_Y = 80;  // Vertical spacing between levels
export const ROOT_OFFSET_X = 60;   // Left margin
export const ROOT_OFFSET_Y = 40;   // Top margin

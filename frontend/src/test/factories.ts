/**
 * Test factories for building domain objects with sensible defaults.
 * Every property can be overridden via the `overrides` parameter.
 */
import type {
  User,
  AuthResponse,
  Repertoire,
  RepertoireNode,
  RepertoireMetadata,
  Category,
  Color,
  ShortColor,
  SyncResult,
} from '../types';
import { STARTING_FEN } from '../shared/utils/chess';

// --- Counters for unique IDs ---
let idCounter = 0;
function nextId(prefix = 'id'): string {
  return `${prefix}-${++idCounter}`;
}

/** Reset the ID counter (call in beforeEach if needed). */
export function resetFactoryIds(): void {
  idCounter = 0;
}

// --- User ---

export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: nextId('user'),
    username: 'testuser',
    email: 'test@example.com',
    lichessLinked: false,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- Auth ---

export function createAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    token: 'test-access-token',
    user: createUser(),
    ...overrides,
  };
}

export function createSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    lichessGamesImported: 0,
    chesscomGamesImported: 0,
    ...overrides,
  };
}

// --- Category ---

export function createCategory(overrides: Partial<Category> = {}): Category {
  const id = overrides.id ?? nextId('cat');
  return {
    id,
    name: `Category ${id}`,
    color: 'white' as Color,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- RepertoireNode ---

export function createRepertoireNode(
  overrides: Partial<RepertoireNode> = {},
  children: RepertoireNode[] = [],
): RepertoireNode {
  return {
    id: nextId('node'),
    fen: STARTING_FEN,
    move: null,
    moveNumber: 1,
    colorToMove: 'w' as ShortColor,
    parentId: null,
    children,
    ...overrides,
  };
}

/**
 * Build a chain of nodes representing a sequence of moves.
 * Returns the root node with children linked.
 *
 * Example:
 *   createNodeChain([
 *     { move: null, fen: STARTING_FEN, colorToMove: 'w' },  // root
 *     { move: 'e4', fen: FEN_AFTER_E4, colorToMove: 'b' },
 *     { move: 'e5', fen: FEN_AFTER_E5, colorToMove: 'w' },
 *   ])
 */
export function createNodeChain(
  moves: Array<Partial<RepertoireNode>>,
): RepertoireNode {
  if (moves.length === 0) {
    return createRepertoireNode();
  }

  // Build bottom-up
  const nodes: RepertoireNode[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const child = i < moves.length - 1 ? nodes[0] : undefined;
    const node = createRepertoireNode(
      {
        ...moves[i],
        id: moves[i].id ?? nextId('node'),
      },
      child ? [child] : [],
    );
    if (child) {
      child.parentId = node.id;
    }
    nodes.unshift(node);
  }
  return nodes[0];
}

// --- RepertoireMetadata ---

export function createMetadata(overrides: Partial<RepertoireMetadata> = {}): RepertoireMetadata {
  return {
    totalNodes: 1,
    totalMoves: 0,
    deepestDepth: 0,
    ...overrides,
  };
}

// --- Repertoire ---

export function createRepertoire(overrides: Partial<Repertoire> = {}): Repertoire {
  const id = overrides.id ?? nextId('rep');
  return {
    id,
    name: `Repertoire ${id}`,
    description: '',
    color: 'white' as Color,
    isPublic: false,
    treeData: createRepertoireNode(),
    metadata: createMetadata(),
    version: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

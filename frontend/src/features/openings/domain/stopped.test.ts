import { describe, expect, it } from 'vitest';
import { playedGamesFixture } from '../fixtures/playedGames';
import { REPLAY_START, repertoiresOf } from '../replay/replaySetup';
import type { PlayedGame } from './playedGame';
import { withAdditions } from './addition';
import { createRepertoire, positionKey } from './repertoire';
import { stoppedMoves } from './stopped';

const games = (moves: string, count: number, playedAt: string): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side: 'b', moves: moves.split(' '), score: 1, playedAt }));

// Contre 1.e4, le joueur alternait la Caro-Kann et la Sicilienne d'une partie à l'autre.
const history = Array.from({ length: 10 }, (_, day) => [...games('e4 c6', 1, `2025-06-${10 + day}`), ...games('e4 c5', 1, `2025-06-${10 + day}`)]).flat();
const repertoire = createRepertoire(history, 'b', '2026-01-01');
const offered = (played: readonly PlayedGame[], kept: Parameters<typeof stoppedMoves>[3] = []) =>
  stoppedMoves(repertoire, [...history, ...played], '2026-01-01', kept).map((move) => move.san);

describe('stoppedMoves', () => {
  it('offers a move for removal once the player played something else the last 5 times they reached its position', () => {
    expect(offered(games('e4 c6', 4, '2026-02-01'))).toEqual([]);
    expect(offered(games('e4 c6', 5, '2026-02-01'))).toEqual(['c5']);
  });

  it('takes nothing from a player who stops playing: games are counted, not months', () => {
    expect(offered(games('e4 c6', 1, '2027-02-01'))).toEqual([]);
  });

  it('offers a kept move again only once the player played it again then left it 5 more times', () => {
    const kept = [{ side: 'b' as const, position: stoppedMoves(repertoire, [...history, ...games('e4 c6', 5, '2026-02-01')], '2026-01-01')[0].position, san: 'c5', keptAt: '2026-02-01' }];

    expect(offered([...games('e4 c6', 5, '2026-02-01'), ...games('e4 c6', 20, '2026-03-01')], kept)).toEqual([]);
    expect(offered([...games('e4 c6', 5, '2026-02-01'), ...games('e4 c5', 1, '2026-03-01'), ...games('e4 c6', 5, '2026-04-01')], kept)).toEqual(['c5']);
  });

  it('waits for 5 arrivals after a move was added before offering it for removal', () => {
    const afterE4 = positionKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    const grown = withAdditions(createRepertoire(games('e4 c6', 10, '2025-06-01'), 'b', '2026-01-01'), [{ side: 'b', addedAt: '2026-02-01', moves: [{ position: afterE4, san: 'c5', source: 'habit' }] }]);
    const offeredOn = (played: readonly PlayedGame[]) => stoppedMoves(grown, [...games('e4 c6', 10, '2025-06-01'), ...played], '2026-01-01').map((move) => move.san);

    expect(offeredOn(games('e4 c6', 4, '2026-03-01'))).toEqual([]);
    expect(offeredOn(games('e4 c6', 5, '2026-03-01'))).toEqual(['c5']);
  });

  it('on PMG\'s games, offers 1.d4, abandoned for 1.e4 in May 2025, as soon as the repertoire is created', () => {
    const created = repertoiresOf(playedGamesFixture, REPLAY_START);
    const known = playedGamesFixture.filter((game) => game.playedAt < REPLAY_START);

    expect(stoppedMoves(created.w, known, REPLAY_START).map((move) => [...move.path, move.san].join(' '))).toContain('d4');
  });
});

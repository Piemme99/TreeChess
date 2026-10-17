import type { PlayedGame } from '../domain/playedGame';
import games from './played-games.json';

// Parties réelles de Piemme78 (chess.com, blitz + rapide), figées par
// scripts/generate-played-games-fixture.mjs en attendant l'import.
export const playedGamesFixture = games as PlayedGame[];

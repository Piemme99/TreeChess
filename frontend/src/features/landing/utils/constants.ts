export const PIECE_MAP: Record<string, string> = {
  wr: "\u2656", wn: "\u2658", wb: "\u2657", wq: "\u2655", wk: "\u2654", wp: "\u2659",
  br: "\u265C", bn: "\u265E", bb: "\u265D", bq: "\u265B", bk: "\u265A", bp: "\u265F",
};

export const INITIAL_BOARD: (string | null)[][] = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
];

export const HOVER_ARROWS: Record<string, [number, number, number, number][]> = {
  "6,4": [[6, 4, 4, 4]],   // e2-e4
  "6,3": [[6, 3, 4, 3]],   // d2-d4
  "7,1": [[7, 1, 5, 2]],   // Nb1-c3
  "7,6": [[7, 6, 5, 5]],   // Ng1-f3
  "1,4": [[1, 4, 3, 4]],   // e7-e5
  "1,3": [[1, 3, 3, 3]],   // d7-d5
  "0,1": [[0, 1, 2, 2]],   // Nb8-c6
  "0,6": [[0, 6, 2, 5]],   // Ng8-f6
  "6,2": [[6, 2, 4, 2]],   // c2-c4
};

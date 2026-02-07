import { useState } from 'react';
import { motion } from 'framer-motion';
import { PIECE_MAP, INITIAL_BOARD, HOVER_ARROWS } from '../utils/constants';

export function MiniChessBoard() {
  const [hovered, setHovered] = useState<string | null>(null);
  const sqSize = 100 / 8;

  const arrows = hovered && HOVER_ARROWS[hovered] ? HOVER_ARROWS[hovered] : [];

  return (
    <div className="relative w-full aspect-square max-w-[340px] rounded-2xl overflow-hidden shadow-lg shadow-primary/15 border border-primary-light/60">
      {/* Board squares */}
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
        {INITIAL_BOARD.map((row, r) =>
          row.map((piece, c) => {
            const isLight = (r + c) % 2 === 0;
            const key = `${r},${c}`;
            const isHov = hovered === key;
            return (
              <div
                key={key}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                className="relative flex items-center justify-center transition-colors duration-200 cursor-pointer select-none"
                style={{
                  backgroundColor: isHov
                    ? 'rgba(230, 126, 34, 0.25)'
                    : isLight
                    ? '#fdf6ed'
                    : '#e8cfa8',
                  fontSize: 'min(3.6vw, 32px)',
                }}
              >
                {piece && (
                  <span className="drop-shadow-sm leading-none" style={{ lineHeight: 1 }}>
                    {PIECE_MAP[piece]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SVG Arrows */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
        <defs>
          <marker id="ah" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
            <polygon points="0 0, 3 1.5, 0 3" className="fill-primary" />
          </marker>
        </defs>
        {arrows.map(([r1, c1, r2, c2], i) => (
          <motion.line
            key={i}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 0.3 }}
            x1={c1 * sqSize + sqSize / 2}
            y1={r1 * sqSize + sqSize / 2}
            x2={c2 * sqSize + sqSize / 2}
            y2={r2 * sqSize + sqSize / 2}
            className="stroke-primary"
            strokeWidth="1.2"
            strokeLinecap="round"
            markerEnd="url(#ah)"
          />
        ))}
      </svg>
    </div>
  );
}

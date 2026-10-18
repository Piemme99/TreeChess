import { MotionConfig, motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { buildOpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame } from '../domain/playedGame';
import { findPriorities, type Priority } from '../domain/priorities';
import { figurineLine } from '../domain/notation';
import { replayLine } from '../position/replay';
import { ReplayBar } from '../replay/ReplayBar';
import { PageHeader } from '../workshop/PageHeader';
import { COLOURS, FONT_FAMILY, raised, SPRING } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { useReplayedSession } from './useReplayedSession';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;

export function HomePage() {
  useWorkshopFont();
  const { replay, known, steps, forgetIgnored, forgetAdditions } = useReplayedSession();
  const priority = useFirstPriority(known, replay.day);
  const reset = replay.reset && (() => {
    replay.reset!();
    forgetIgnored();
    forgetAdditions();
  });
  const positions = `${steps.length} ${steps.length === 1 ? 'position' : 'positions'} to settle`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-20" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <span className="sm:ml-auto">
            <ReplayBar replay={{ ...replay, reset }} />
          </span>
        </PageHeader>
        <main className="mx-auto flex max-w-[30rem] flex-col gap-4 px-4 pt-8">
          <Door
            to={steps.length ? '/dev/session' : undefined}
            title="I just played"
            detail={
              replay.index
                ? `${replay.gamesThatDay} ${replay.gamesThatDay === 1 ? 'game' : 'games'} today · ${steps.length ? positions : 'nothing to settle'}`
                : 'No game yet: your repertoire was just created'
            }
          />
          <Door
            title="I want to work"
            detail={priority ? <PriorityLabel priority={priority} /> : 'No priority'}
            note="Next brick"
          />
        </main>
      </div>
    </MotionConfig>
  );
}

function Door({ to, title, detail, note }: { to?: string; title: string; detail: ReactNode; note?: string }) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[24px] font-extrabold tracking-[-0.02em]">{title}</span>
        {to && <span className="text-[22px] font-bold">→</span>}
        {note && (
          <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            {note}
          </span>
        )}
      </span>
      <span className="text-[15px]" style={{ color: to ? undefined : COLOURS.leafSoft }}>
        {detail}
      </span>
    </>
  );
  const className = 'flex flex-col gap-1.5 rounded-3xl p-5';
  if (!to) {
    return (
      <section aria-label={title} className={className} style={{ ...raised(false), opacity: 0.7 }}>
        {body}
      </section>
    );
  }
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={SPRING}>
      <Link to={to} aria-label={title} className={className} style={raised(true)}>
        {body}
      </Link>
    </motion.div>
  );
}

function PriorityLabel({ priority }: { priority: Priority }) {
  const fens = useMemo(() => replayLine(priority.path).fens, [priority.path]);
  const opening = useOpeningName(fens);
  return (
    <>
      {[priority.side === 'w' ? 'White' : 'Black', opening?.name, figurineLine(priority.path)].filter(Boolean).join(' · ')}
    </>
  );
}

function useFirstPriority(known: readonly PlayedGame[], day: string): Priority | undefined {
  return useMemo(() => {
    const recent = gamesOfLastMonths(known, RECENT_MONTHS, new Date(day));
    const trees = (games: readonly PlayedGame[]) => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    return findPriorities(trees(known), trees(recent), 1)[0];
  }, [known, day]);
}

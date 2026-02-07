import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderTree, FileDown, RefreshCw, BookOpen } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';
import { TreeScreen } from './featureScreens/TreeScreen';
import { ImportScreen } from './featureScreens/ImportScreen';
import { SyncScreen } from './featureScreens/SyncScreen';
import { StudiesScreen } from './featureScreens/StudiesScreen';

const TABS = [
  {
    id: 'tree',
    label: 'Move Tree',
    icon: FolderTree,
    description: 'Build opening repertoires as interactive, branching move trees. See every variation at a glance.',
    screen: TreeScreen,
  },
  {
    id: 'import',
    label: 'Import PGN',
    icon: FileDown,
    description: 'Drop any PGN file to instantly parse and visualize your games. Find where you deviated from your repertoire.',
    screen: ImportScreen,
  },
  {
    id: 'sync',
    label: 'Auto-Sync',
    icon: RefreshCw,
    description: 'Connect Lichess or Chess.com and let TreeChess auto-import your games. Never miss a deviation again.',
    screen: SyncScreen,
  },
  {
    id: 'studies',
    label: 'Lichess Studies',
    icon: BookOpen,
    description: 'Import your Lichess studies directly as repertoires. All chapters, annotations, and variations preserved.',
    screen: StudiesScreen,
  },
];

export function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const ActiveScreen = TABS[active].screen;

  return (
    <Section id="features" className="relative z-10 px-6 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <motion.div variants={fadeUp} className="text-center mb-14">
          <span className="text-xs font-bold text-primary tracking-widest uppercase mb-3 block">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 font-display text-text">
            Everything you need to master openings
          </h2>
          <p className="text-text-muted max-w-xl mx-auto leading-relaxed">
            From importing your games to building complete repertoires, TreeChess
            gives you the tools to study smarter.
          </p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Tabs */}
            <div className="space-y-3">
              {TABS.map((tab, i) => {
                const Icon = tab.icon;
                const isActive = active === i;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActive(i)}
                    className={`w-full text-left flex items-start gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'bg-white border-primary/30 shadow-md shadow-primary/10'
                        : 'bg-transparent border-transparent hover:bg-white/60 hover:border-gray-100'
                    }`}
                    whileHover={{ scale: isActive ? 1 : 1.01 }}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                        isActive ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted'
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <h4
                        className={`text-base font-semibold mb-1 transition-colors duration-300 font-body ${
                          isActive ? 'text-text' : 'text-text-muted'
                        }`}
                      >
                        {tab.label}
                      </h4>
                      <AnimatePresence mode="wait">
                        {isActive && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-sm text-text-muted leading-relaxed font-body"
                          >
                            {tab.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Screen preview */}
            <div className="relative min-h-[380px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.97 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full"
                >
                  <ActiveScreen />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

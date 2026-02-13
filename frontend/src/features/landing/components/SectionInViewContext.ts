import { createContext, useContext } from 'react';

/** Context that tells children whether their parent Section is in view */
export const SectionInViewContext = createContext(true);
export const useSectionInView = () => useContext(SectionInViewContext);

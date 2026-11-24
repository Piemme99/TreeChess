import { OpeningsPage as Openings } from '../OpeningsPage';
import { PracticePage as Practice } from '../practice/PracticePage';
import { ReviewPage as Review } from '../review/ReviewPage';
import { TreePage as Tree } from '../tree/TreePage';
import { SourceGate } from './SourceContext';

// Ces pages lisent les parties du joueur : sans elles, Home dit quoi faire.
export function TreePage() {
  return (
    <SourceGate>
      <Tree />
    </SourceGate>
  );
}

export function ReviewPage() {
  return (
    <SourceGate>
      <Review />
    </SourceGate>
  );
}

export function PracticePage() {
  return (
    <SourceGate>
      <Practice />
    </SourceGate>
  );
}

export function OpeningsPage() {
  return (
    <SourceGate>
      <Openings />
    </SourceGate>
  );
}

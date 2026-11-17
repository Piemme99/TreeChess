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

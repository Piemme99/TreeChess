import { PageHeader } from './PageHeader';
import { COLOURS, FONT_FAMILY } from './theme';

/** Ce qui s'affiche pendant que la page et les parties du joueur se chargent : l'en-tête déjà là, la forme de l'écran. */
export function PageSkeleton() {
  return (
    <div className="min-h-screen" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }} aria-busy="true">
      <PageHeader />
      <main className="mx-auto grid max-w-[84rem] gap-5 px-4 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="h-[60vh] animate-pulse rounded-3xl lg:h-[calc(100vh-11rem)]" style={{ background: COLOURS.paper }} />
        <div className="hidden flex-col gap-4 lg:flex">
          <div className="h-10 w-2/3 animate-pulse rounded-xl" style={{ background: COLOURS.sand }} />
          <div className="aspect-square w-full animate-pulse rounded-[18px]" style={{ background: COLOURS.sand }} />
        </div>
        <p className="text-[14px] font-semibold lg:col-span-2" style={{ color: COLOURS.leafSoft }}>
          Loading your games…
        </p>
      </main>
    </div>
  );
}

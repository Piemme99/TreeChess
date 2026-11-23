/**
 * Sur un grand écran (au-delà de 100rem), le volet se partage : l'échiquier dans sa colonne, aussi haut que la carte,
 * puis une colonne étroite pour ce que la position porte. En dessous, rien ne change : le volet empile tout.
 *
 * L'échiquier suit la hauteur de la carte (`100dvh - 9rem`), sans prendre à la carte plus que la largeur ne le permet,
 * ni grossir au-delà de ce qui reste lisible à côté d'un texte de 14px.
 */

/** Le conteneur du volet : une colonne, puis une rangée. */
export const SPLIT_PANE = 'min-[100rem]:flex-row min-[100rem]:items-start min-[100rem]:gap-5';

/** L'échiquier, toujours en premier. */
export const SPLIT_BOARD = 'min-[100rem]:order-first min-[100rem]:mx-0 min-[100rem]:w-[min(calc(100dvh_-_9rem),calc(100vw_-_72rem),56rem)] min-[100rem]:max-w-none min-[100rem]:shrink-0';

/** Le reste : sans boîte quand le volet empile (l'ordre des enfants vaut alors pour tout le volet), une colonne sinon. */
export const SPLIT_SIDE = 'contents min-[100rem]:flex min-[100rem]:w-[22rem] min-[100rem]:shrink-0 min-[100rem]:flex-col';

/**
 * Sur un grand écran (au-delà de 100rem), le volet se partage : l'échiquier dans sa colonne, aussi haut que la carte,
 * puis une colonne de 22rem pour ce que la position porte. En dessous, rien ne change : le volet empile tout.
 *
 * L'échiquier suit la hauteur de la carte (`100dvh - 9rem`), sans prendre à la carte plus que la largeur ne le permet,
 * ni grossir au-delà de ce qui reste lisible à côté d'un texte de 14px, ni rapetisser sous 16rem.
 */

/** La largeur de l'échiquier, la même dans le volet et en construction : la carte ne bouge pas quand on construit. */
export const SPLIT_BOARD = 'min-[100rem]:mx-0 min-[100rem]:w-[max(16rem,min(calc(100dvh_-_9rem),calc(100vw_-_72rem),56rem))] min-[100rem]:max-w-none min-[100rem]:shrink-0';

/** En construction, l'échiquier puis le panneau, côte à côte. */
export const SPLIT_ROW = 'min-[100rem]:flex-row min-[100rem]:items-start min-[100rem]:gap-5';

/** La colonne de droite. */
export const SPLIT_SIDE = 'min-[100rem]:w-[22rem] min-[100rem]:shrink-0';

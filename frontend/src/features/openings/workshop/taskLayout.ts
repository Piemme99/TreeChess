// Au téléphone, une tâche est une colonne ; sur grand écran, l'échiquier passe à gauche et ce qui l'accompagne à droite.
export const TASK_MAIN = 'mx-auto flex max-w-[30rem] flex-col gap-3 px-4 pt-4 lg:max-w-[74rem] lg:px-8 lg:pt-8';

// Sur un ordinateur c'est la hauteur qui manque : l'échiquier remplit l'écran sous la barre de tâche, sans défiler.
export const BOARD_BESIDE =
  'flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,min(calc(100dvh_-_8rem),46rem))_minmax(18rem,22rem)] lg:grid-rows-[auto_1fr] lg:justify-center lg:gap-x-10';

// Le même, avec la ligne et les coups sous l'échiquier : il laisse leur place.
export const BOARD_BESIDE_WITH_MOVES =
  'flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,min(calc(100dvh_-_16rem),42rem))_minmax(20rem,24rem)] lg:grid-rows-[auto_1fr] lg:justify-center lg:gap-x-10';

export const BOARD_CELL = 'lg:col-start-1 lg:row-span-2 lg:row-start-1';
export const SIDE_TOP = 'lg:col-start-2 lg:row-start-1';
export const SIDE_BELOW = 'lg:col-start-2 lg:row-start-2 lg:self-start';

// Чистая игровая логика без UI и без зависимостей от DOM/Node.
// Тут будут жить ход времени, ресурсы, формулы добычи, апгрейды, события.

import { GAME_NAME } from '@oil-tycoon/shared';

export function engineGreeting(): string {
  return `${GAME_NAME} engine ready`;
}

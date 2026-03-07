import { renderChapterWith } from './chapterBase.js?v=20260307i';
import { mountStateMachine } from '../simulations/stateMachine.js';

const SIM_MOUNTS = {
  stateMachine: mountStateMachine,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

import { renderChapterWith } from '../chapterBase.js';
import { mountStateMachine } from '../simulations/stateMachine.js';

const SIM_MOUNTS = {
  stateMachine: mountStateMachine,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

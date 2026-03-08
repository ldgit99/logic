import { renderChapterWith } from './chapterBase.js?v=20260307i';
import { mountStateMachine } from '../simulations/stateMachine.js';
import { mountFlipFlopSim } from '../simulations/flipFlopSim.js';

const SIM_MOUNTS = {
  stateMachine: mountStateMachine,
  flipFlopSim: mountFlipFlopSim,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

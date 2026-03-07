import { renderChapterWith } from './chapterBase.js';
import { mountFlipFlopSim } from '../simulations/flipFlopSim.js';

const SIM_MOUNTS = {
  flipFlopSim: mountFlipFlopSim,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

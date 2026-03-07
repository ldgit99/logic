import { renderChapterWith } from '../chapterBase.js';
import { mountMemorySim } from '../simulations/memorySim.js';

const SIM_MOUNTS = {
  memorySim: mountMemorySim,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

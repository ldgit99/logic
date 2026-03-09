import { renderChapterWith } from './chapterBase.js?v=20260309e';
import { mountCounterSim } from '../simulations/counterSim.js';
import { mountShiftRegister } from '../simulations/shiftRegister.js';

const SIM_MOUNTS = {
  counterSim: mountCounterSim,
  shiftRegister: mountShiftRegister,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

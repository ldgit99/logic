import { renderChapterWith } from './chapterBase.js';
import { mountHalfFullAdder } from '../simulations/halfFullAdder.js';
import { mountDecoderSim } from '../simulations/decoderSim.js';
import { mountMultiplexerSim } from '../simulations/multiplexerSim.js';

const SIM_MOUNTS = {
  halfFullAdder: mountHalfFullAdder,
  decoderSim: mountDecoderSim,
  multiplexerSim: mountMultiplexerSim,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

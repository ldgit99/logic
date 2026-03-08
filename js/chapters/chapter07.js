import { renderChapterWith } from './chapterBase.js?v=20260307i';
import { mountHalfFullAdder } from '../simulations/halfFullAdder.js';
import { mountDecoderSim } from '../simulations/decoderSim.js';
import { mountMultiplexerSim } from '../simulations/multiplexerSim.js';
import { mountParityBit } from '../simulations/parityBit.js';

const SIM_MOUNTS = {
  halfFullAdder: mountHalfFullAdder,
  decoderSim: mountDecoderSim,
  multiplexerSim: mountMultiplexerSim,
  parityBit: mountParityBit,
};

export async function renderChapter(data) {
  renderChapterWith(data, SIM_MOUNTS);
}

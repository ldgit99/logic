import { renderChapterWith } from './chapterBase.js';
import { mountBooleanEval } from '../simulations/booleanEval.js';
import { mountBooleanLaws } from '../simulations/booleanLaws.js';
import { mountMintermMaxterm } from '../simulations/mintermMaxterm.js';

const SIM_MOUNTS = {
  booleanEval:    mountBooleanEval,
  booleanLaws:    mountBooleanLaws,
  mintermMaxterm: mountMintermMaxterm,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

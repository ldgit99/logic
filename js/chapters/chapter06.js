import { renderChapterWith } from './chapterBase.js?v=20260309e';
import { mountKarnaughMap } from '../simulations/karnaughMap.js';
import { mountNandNorConvert } from '../simulations/nandNorConvert.js';

const SIM_MOUNTS = {
  karnaughMap:    mountKarnaughMap,
  nandNorConvert: mountNandNorConvert,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

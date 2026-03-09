import { renderChapterWith } from './chapterBase.js?v=20260309d';
import { mountBcdCode } from '../simulations/bcdCode.js';
import { mountGrayCode } from '../simulations/grayCode.js';
import { mountParityBit } from '../simulations/parityBit.js';
import { mountHammingCode } from '../simulations/hammingCode.js';
import { mountAsciiCode } from '../simulations/asciiCode.js';

const SIM_MOUNTS = {
  bcdCode: mountBcdCode,
  grayCode: mountGrayCode,
  parityBit: mountParityBit,
  hammingCode: mountHammingCode,
  asciiCode: mountAsciiCode,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

import { renderChapterWith } from './chapterBase.js';
import { mountBaseConverter } from '../simulations/baseConverter.js';
import { mountTwosComplement } from '../simulations/twosComplement.js';
import { mountBinaryArithmetic } from '../simulations/binaryArithmetic.js';
import { mountIeee754 } from '../simulations/ieee754.js';

const SIM_MOUNTS = {
  baseConverter: mountBaseConverter,
  twosComplement: mountTwosComplement,
  binaryArithmetic: mountBinaryArithmetic,
  ieee754: mountIeee754,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

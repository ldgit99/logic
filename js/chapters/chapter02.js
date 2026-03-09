import { renderChapterWith } from './chapterBase.js?v=20260309d';
import { mountBaseConverter } from '../simulations/baseConverter.js';
import { mountTwosComplement } from '../simulations/twosComplement.js';
import { mountBinaryArithmetic } from '../simulations/binaryArithmetic.js';
import { mountSignedOverflowLab } from '../simulations/signedOverflowLab.js';
import { mountIeee754 } from '../simulations/ieee754.js';

const SIM_MOUNTS = {
  baseConverter: mountBaseConverter,
  twosComplement: mountTwosComplement,
  binaryArithmetic: mountBinaryArithmetic,
  signedOverflowLab: mountSignedOverflowLab,
  ieee754: mountIeee754,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

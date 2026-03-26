import { renderChapterWith } from './chapterBase.js?v=20260309e';
import { mountBaseConverter } from '../simulations/baseConverter.js';
import { mountFractionConverter } from '../simulations/fractionConverter.js';
import { mountTwosComplement } from '../simulations/twosComplement.js';
import { mountBinaryArithmetic } from '../simulations/binaryArithmetic.js';
import { mountBinarySubtraction } from '../simulations/binarySubtraction.js';
import { mountSignedOverflowLab } from '../simulations/signedOverflowLab.js';
import { mountIeee754 } from '../simulations/ieee754.js';

const SIM_MOUNTS = {
  baseConverter: mountBaseConverter,
  fractionConverter: mountFractionConverter,
  twosComplement: mountTwosComplement,
  binaryArithmetic: mountBinaryArithmetic,
  binarySubtraction: mountBinarySubtraction,
  signedOverflowLab: mountSignedOverflowLab,
  ieee754: mountIeee754,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

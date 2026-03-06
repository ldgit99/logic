import { renderChapterWith } from './chapterBase.js';
import { mountAnalogDigital } from '../simulations/analogDigital.js';
import { mountPulseWave } from '../simulations/pulseWave.js';
import { mountAdcSampling } from '../simulations/adcSampling.js';
import { mountUnitConverter } from '../simulations/unitConverter.js';

const SIM_MOUNTS = {
  analogDigital: mountAnalogDigital,
  pulseWave: mountPulseWave,
  adcSampling: mountAdcSampling,
  unitConverter: mountUnitConverter,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}

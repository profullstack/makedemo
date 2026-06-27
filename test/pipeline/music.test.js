import { expect } from 'chai';
import { buildMusicFilter } from '../../src/pipeline/music.js';

describe('music ducking filter', () => {
  it('splits the voiceover into a final track and a sidechain key', () => {
    const f = buildMusicFilter();
    expect(f).to.include('[0:a]asplit=2[vo][key]');
  });

  it('lowers the music bed volume and sidechain-compresses it by the voice', () => {
    const f = buildMusicFilter({ musicVolume: 0.35 });
    expect(f).to.include('volume=0.35[bed]');
    expect(f).to.include('sidechaincompress');
    expect(f).to.include('[bed][key]sidechaincompress');
  });

  it('mixes the voice and the ducked bed into [aout]', () => {
    const f = buildMusicFilter();
    expect(f).to.include('[vo][ducked]amix=inputs=2');
    expect(f).to.match(/\[aout\]$/);
  });

  it('honors custom compressor parameters', () => {
    const f = buildMusicFilter({ threshold: 0.1, ratio: 12, attack: 5, release: 400 });
    expect(f).to.include('threshold=0.1');
    expect(f).to.include('ratio=12');
    expect(f).to.include('attack=5');
    expect(f).to.include('release=400');
  });
});

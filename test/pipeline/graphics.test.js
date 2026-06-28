import { expect } from 'chai';
import { escapeDrawtext } from '../../packages/core/src/pipeline/graphics.js';

describe('escapeDrawtext', () => {
  it('escapes colons (ffmpeg drawtext option separator)', () => {
    expect(escapeDrawtext('a:b')).to.equal('a\\:b');
  });

  it('escapes percent signs', () => {
    expect(escapeDrawtext('100%')).to.equal('100\\%');
  });

  it('escapes backslashes', () => {
    expect(escapeDrawtext('a\\b')).to.equal('a\\\\b');
  });

  it('replaces straight apostrophes (which break the quoted text arg)', () => {
    expect(escapeDrawtext("it's")).to.equal('it’s');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeDrawtext(null)).to.equal('');
    expect(escapeDrawtext(undefined)).to.equal('');
  });
});

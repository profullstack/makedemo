import { expect } from 'chai';
import { globToRegExp, isExcluded, normalize } from '../../packages/core/src/pipeline/url-utils.js';

describe('crawl helpers', () => {
  it('converts a glob to an anchored regexp', () => {
    const re = globToRegExp('/blog/*');
    expect(re.test('/blog/hello')).to.equal(true);
    expect(re.test('/blogger')).to.equal(false);
    expect(re.test('/docs/blog/x')).to.equal(false);
  });

  it('excludes paths matching any pattern', () => {
    const patterns = ['/blog/*', '/legal/*'].map(globToRegExp);
    expect(isExcluded('https://x.com/blog/a', patterns)).to.equal(true);
    expect(isExcluded('https://x.com/legal/terms', patterns)).to.equal(true);
    expect(isExcluded('https://x.com/app/dashboard', patterns)).to.equal(false);
  });

  it('returns false when there are no patterns', () => {
    expect(isExcluded('https://x.com/anything', [])).to.equal(false);
  });

  it('strips the hash fragment when normalizing', () => {
    expect(normalize('https://x.com/a#section')).to.equal('https://x.com/a');
  });
});

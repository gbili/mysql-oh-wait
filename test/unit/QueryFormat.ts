import { expect } from 'chai';
import { Connection } from 'mysql';
import { logger } from 'saylo';
import QueryFormat from '../../src/QueryFormat';

const fakeEscape = { escape: (v: string) => `'${v}'`, };

describe(`QueryFormat`, function() {

  logger.turnOn('debug');

  describe(`QueryFormat.constructor(connection)`, function() {
    it('should be able to get a QueryFormat instance', async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat).to.be.an.instanceof(QueryFormat);
    });
  });

  describe(`QueryFormat.queryFormat(':ph1, :ph2', { ph1: 'a', ph2: 'b' })`, function() {
    const expected = "'a', 'b'";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':ph1, :ph2', { ph1: 'a', ph2: 'b' })).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat('(:ph1, :ph2)', { ph1: 'a', ph2: 'b' })`, function() {
    const expected = "('a', 'b')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat('(:ph1, :ph2)', { ph1: 'a', ph2: 'b' })).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':?, :?', [ 'a', 'b' ])`, function() {
    const expected = "'a', 'b'";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':?, :?', [ 'a', 'b' ])).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat('(:?, :?)', [ 'a', 'b' ])`, function() {
    const expected = "('a', 'b')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat('(:?, :?)', [ 'a', 'b' ])).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':ph1', { ph1: ['a', 'b'] })`, function() {
    const expected = "('a', 'b')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':ph1', { ph1: ['a', 'b'] })).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':ph1, :ph2', { ph1: ['a', 'b'], ph2: ['c', 'd'] })`, function() {
    const expected = "('a', 'b'), ('c', 'd')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':ph1, :ph2', { ph1: ['a', 'b'], ph2: ['c', 'd'] })).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':?', [ ['a', 'b'] ])`, function() {
    const expected = "('a', 'b')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':?', [ ['a', 'b'] ])).to.be.equal(expected);
    });
  });

  // Needs special case that knows it needs to pass the full values array instead of popping when single qmark in query
  describe(`QueryFormat.queryFormat(':?', [ ['a', 'b'], ['c', 'd'] ])`, function() {
    const expected = "('a', 'b'), ('c', 'd')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':?', [ ['a', 'b'], ['c', 'd'] ])).to.be.equal(expected);
    });
  });

  // Needs special case that knows it needs to pass the full values array instead of popping when single qmark in query
  describe(`QueryFormat.queryFormat(':?, :?', [ ['a', 'b'], ['c', 'd'] ])`, function() {
    const expected = "('a', 'b'), ('c', 'd')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':?, :?', [ ['a', 'b'], ['c', 'd'] ])).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':ph1', { ph1: [ ['a', 'b'], ['c', 'd'] ] })`, function() {
    const expected = "('a', 'b'), ('c', 'd')";
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':ph1', { ph1: [ ['a', 'b'], ['c', 'd'] ] })).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':?', { ph1: 'a', ph2: 'b'})`, function() {
    const expected = `ph1 = 'a' AND ph2 = 'b'`;
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':?', { ph1: 'a', ph2: 'b'})).to.be.equal(expected);
    });
  });

  describe(`QueryFormat.queryFormat(':ph1 and :ph2', { ph1: ['a', 'b'] })`, function() {
    const expected = `('a', 'b') AND 'c'`;
    it(`should return ${expected}`, async function() {
      const queryFormat = new QueryFormat((fakeEscape as Connection));
      expect(queryFormat.queryFormat(':ph1 AND :ph2', { ph1: ['a', 'b'], ph2: 'c' })).to.be.equal(expected);
    });
  });

});

import { expect } from 'chai';
import QueryFormat from '../../src/QueryFormat'; // Adjust the path as needed

// Define fakeEscape to mimic mysql2's escape behavior
const fakeEscape = (v: string | number) => {
  if (typeof v === 'string') {
    return `'${v.replace(/'/g, "''")}'`;
  } else if (typeof v === 'number') {
    return v.toString();
  } else {
    throw new Error(`Unsupported type for escape: ${typeof v}`);
  }
};

// Mock connection
const mockConnection = {
  escape: fakeEscape,
} as any;

describe('QueryFormat', () => {
  let queryFormat: QueryFormat;

  beforeEach(() => {
    queryFormat = new QueryFormat(mockConnection);
  });

  // **Basic Placeholder Replacement**
  it('should replace named placeholders with scalars', () => {
    const query = ':ph1, :ph2';
    const values = { ph1: 'a', ph2: 'b' };
    const expected = "'a', 'b'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace named placeholders with scalars in parentheses', () => {
    const query = '(:ph1, :ph2)';
    const values = { ph1: 'a', ph2: 'b' };
    const expected = "('a', 'b')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace multiple positional placeholders with array values', () => {
    const query = ':?, :?';
    const values = ['a', 'b'];
    const expected = "'a', 'b'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace single positional placeholder with array for tuple', () => {
    const query = '(:?, :?)';
    const values = ['a', 'b'];
    const expected = "('a', 'b')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  // **Array Handling**
  it('should replace named placeholder with array for IN clause', () => {
    const query = ':ph1';
    const values = { ph1: ['a', 'b'] };
    const expected = "('a', 'b')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace multiple named placeholders with arrays for batch inserts', () => {
    const query = ':ph1, :ph2';
    const values = { ph1: ['a', 'b'], ph2: ['c', 'd'] };
    const expected = "('a', 'b'), ('c', 'd')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace single positional placeholder with array of arrays for batch inserts', () => {
    const query = ':?';
    const values = [['a', 'b'], ['c', 'd']];
    const expected = "('a', 'b'), ('c', 'd')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace multiple positional placeholders with array of arrays', () => {
    const query = ':?, :?';
    const values = [['a', 'b'], ['c', 'd']];
    const expected = "('a', 'b'), ('c', 'd')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should replace named placeholder with array of arrays for batch inserts', () => {
    const query = ':ph1';
    const values = { ph1: [['a', 'b'], ['c', 'd']] };
    const expected = "('a', 'b'), ('c', 'd')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  // **Condition Generation**
  it('should generate conditions with positional placeholder and object', () => {
    const query = ':?';
    const values = { ph1: 'a', ph2: 'b' };
    const expected = "ph1 = 'a' AND ph2 = 'b'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle null in conditions', () => {
    const query = ':?';
    const values = { ph1: null, ph2: 'b' };
    const expected = "ph1 IS NULL AND ph2 = 'b'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  // **Mixed Types and Special Data**
  it('should handle mixed types in named placeholders', () => {
    const query = ':ph1 AND :ph2';
    const values = { ph1: ['a', 'b'], ph2: 'c' };
    const expected = "('a', 'b') AND 'c'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle null in arrays for named placeholders', () => {
    const query = ':ph1 AND :ph2';
    const values = { ph1: [null, 'b'], ph2: 'c' };
    const expected = "(NULL, 'b') AND 'c'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle mixed data types in arrays', () => {
    const query = ':?';
    const date1 = new Date('2020-03-01T09:40:16.767Z');
    const date2 = new Date('2020-04-01T09:40:16.767Z');
    const values = [['a', 'b', false, date1], ['c', 'd', 1, date2]];
    const expected = `('a', 'b', 0, '${QueryFormat.toMysqlDatetime(date1)}'), ('c', 'd', 1, '${QueryFormat.toMysqlDatetime(date2)}')`;
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle null in arrays for positional placeholders', () => {
    const query = ':?';
    const values = [['a', 'b', null, 4], ['c', 'd', 'e', 33]];
    const expected = "('a', 'b', NULL, 4), ('c', 'd', 'e', 33)";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle booleans and dates in named placeholders', () => {
    const query = 'INSERT INTO table (col1, col2, col3) VALUES (:ph1, :ph2, :ph3)';
    const date = new Date('2023-10-01T12:00:00Z');
    const values = { ph1: true, ph2: false, ph3: date };
    const expected = `INSERT INTO table (col1, col2, col3) VALUES (1, 0, '${QueryFormat.toMysqlDatetime(date)}')`;
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle strings with special characters in named placeholders', () => {
    const query = 'SELECT * FROM table WHERE col1 = :ph1';
    const values = { ph1: "O'Reilly" };
    const expected = "SELECT * FROM table WHERE col1 = 'O''Reilly'";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  // **Realistic Query Examples**
  it('should handle named placeholders with scalars in a SELECT query', () => {
    const query = 'SELECT * FROM table WHERE col1 = :ph1 AND col2 = :ph2';
    const values = { ph1: 'a', ph2: 2 };
    const expected = "SELECT * FROM table WHERE col1 = 'a' AND col2 = 2";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle named placeholders with arrays for IN clauses in a SELECT query', () => {
    const query = 'SELECT * FROM table WHERE col1 IN :ph1';
    const values = { ph1: ['a', 'b', 'c'] };
    const expected = "SELECT * FROM table WHERE col1 IN ('a', 'b', 'c')";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle named placeholders with arrays of arrays for batch inserts in an INSERT query', () => {
    const query = 'INSERT INTO table (col1, col2) VALUES :ph1';
    const values = { ph1: [['a', 1], ['b', 2], ['c', 3]] };
    const expected = "INSERT INTO table (col1, col2) VALUES ('a', 1), ('b', 2), ('c', 3)";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle single positional placeholder with array of arrays for batch inserts in an INSERT query', () => {
    const query = 'INSERT INTO table (col1, col2) VALUES :?';
    const values = [['a', 1], ['b', 2], ['c', 3]];
    const expected = "INSERT INTO table (col1, col2) VALUES ('a', 1), ('b', 2), ('c', 3)";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle multiple positional placeholders with array in a SELECT query', () => {
    const query = 'SELECT * FROM table WHERE col1 = :? OR col2 = :?';
    const values = ['a', 2];
    const expected = "SELECT * FROM table WHERE col1 = 'a' OR col2 = 2";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle positional placeholder with object for conditions in a SELECT query', () => {
    const query = 'SELECT * FROM table WHERE :?';
    const values = { col1: 'a', col2: 2 };
    const expected = "SELECT * FROM table WHERE col1 = 'a' AND col2 = 2";
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  it('should handle dates in arrays for positional placeholders', () => {
    const query = 'INSERT INTO table (col1, col2) VALUES :?';
    const date1 = new Date('2023-10-01T12:00:00Z');
    const date2 = new Date('2023-10-02T12:00:00Z');
    const values = [[date1, 1], [date2, 2]];
    const expected = `INSERT INTO table (col1, col2) VALUES ('${QueryFormat.toMysqlDatetime(date1)}', 1), ('${QueryFormat.toMysqlDatetime(date2)}', 2)`;
    expect(queryFormat.queryFormat(query, values)).to.equal(expected);
  });

  // **Error Handling**
  it('should throw error when named placeholder has no corresponding value', () => {
    const query = 'SELECT * FROM table WHERE col1 = :ph1';
    const values = {};
    expect(() => queryFormat.queryFormat(query, values)).to.throw(/Provided named ref: ':ph1' without corresponding value/);
  });

  it('should throw error when using unsupported type for named placeholder', () => {
    const query = 'SELECT * FROM table WHERE col1 = :ph1';
    const values = { ph1: { key: 'value' } };
    expect(() => queryFormat.queryFormat(query, values as any)).to.throw(/Provided named ref: ':ph1' with unsupported value: \[object Object\]/);
  });

  it('should throw error when passing empty array for named placeholder', () => {
    const query = 'SELECT * FROM table WHERE col1 IN :ph1';
    const values = { ph1: [] };
    expect(() => queryFormat.queryFormat(query, values)).to.throw(/Provided named ref: ':ph1' with unsupported value:/);
  });

  it('should throw error when query has no placeholders', () => {
    const query = 'SELECT * FROM table';
    const values = { ph1: 'a' };
    expect(() => queryFormat.queryFormat(query, values)).to.throw(/Your query does not contain any placeholder/);
  });

  it('should throw error when more positional placeholders than values', () => {
    const query = 'SELECT * FROM table WHERE col1 = :? AND col2 = :?';
    const values = ['a'];
    expect(() => queryFormat.queryFormat(query, values)).to.throw(/More question marks than elements/);
  });
});
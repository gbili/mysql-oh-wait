import { Connection } from "mysql";

type Escape = Connection["escape"];

type ObjOf<T> = { [k: string]: T; }
type Stringable = string | boolean | number;
type StringableObject = ObjOf<Stringable> | ObjOf<Stringable[]> | ObjOf<Stringable[][]>
type StringableObj = ObjOf<Stringable>
type StringableArrayObj = ObjOf<Stringable[]>
type StringableArrayArrayObj = ObjOf<Stringable[][]>
export type Values = StringableObject | Stringable[] | Stringable[][];

function isStringable(val: any): val is Stringable {
  return typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';
}
function isStringableArray(val: any): val is Stringable[] {
  return val instanceof Array && (val.length > 0 && elementsAreOfType<Stringable>(val, isStringable));
}
function isStringableArrayArray(val: any): val is Stringable[][] {
  return val instanceof Array && (val.length > 0 && elementsAreOfType<Stringable[]>(val, isStringableArray));
}
function isStringableObj(val: any): val is StringableObj {
    return isObjectAndAllValuesAreOfType<Stringable>(val, isStringable);
}
function isStringableArrayObj(val: any): val is StringableArrayObj {
    return isObjectAndAllValuesAreOfType<Stringable[]>(val, isStringableArray);
}
function isStringableArrayArrayObj(val: any): val is StringableArrayArrayObj {
    return isObjectAndAllValuesAreOfType<Stringable[][]>(val, isStringableArrayArray);
}
function isObjectAndAllValuesAreOfType<T>(val: any, typecheck: (x: any) => boolean): val is ObjOf<T> {
  return typeof val === "object"
    && !(val instanceof Array)
    && elementsAreOfType<T>(Object.values(val), typecheck);
} 
function elementsAreOfType<T>(els: any[], typeCheck: (x: any) => boolean): els is T[] {
  return els.filter((x: any) => typeCheck(x)).length === els.length 
}

export default class QueryFormat {

  public escape: Escape;
  public matchesCount: number | null = null;
  public values: Values | null = null;
  public copyOfValuesWhenArray: Stringable[] | Stringable[][] | null = null;

  constructor(connection: Connection) {
    this.escape = connection.escape.bind(connection);
    this.replacer = this.replacer.bind(this);
  }

  mapEscape(val: Stringable, depth: number, isQuestionMark: boolean, ref?: string): string 
  mapEscape(val: Stringable[], depth: number, isQuestionMark: boolean, ref?: string): string[]
  mapEscape(val: Stringable[][], depth: number, isQuestionMark: boolean, ref?: string): string[][]
  mapEscape(val: Stringable | Stringable[] | Stringable[][], depth: number, isQuestionMark: boolean, ref?: string): string | string[] | string[][] {
    if (isStringable(val)) {
      return this.escape(val);
    }

    if (!(val instanceof Array)) {
      throw new Error(`Unsupported custom placeholder value for ref : ${ref}, type of value: ${typeof val}`);
    }

    if (val.length <= 0) {
      throw new Error('Cannot pass empty arrays as values');
    }

    if (depth > 2) {
      throw new Error('Supplied value has too many depth levels, max supported is 2 for INSERT VALUES :ref or 1 for IN (:ref)');
    }

    if (isStringableArray(val)) {
      return val.map((el: Stringable) => this.mapEscape(el, depth + 1, isQuestionMark));
    } else if (isStringableArrayArray(val)) {
      return val.map((el: Stringable[]) => this.mapEscape(el, depth + 1, isQuestionMark));
    } else {
      return val;
    }
  }


  joinUseParenthesis(escapedValues: string): string
  joinUseParenthesis(escapedValues: string[]): string
  joinUseParenthesis(escapedValues: string[][]): string
  joinUseParenthesis(escapedValues: string | string[] | string[][]): string {
    if (typeof escapedValues === 'string') {
      return escapedValues;
    }

    if (escapedValues.length <= 0) {
      throw new Error('Empty arrays are not allowed as value');
    }

    const glueColonsSurroundParents = (el: string[]) => `(${el.join(', ')})`;

    if (isStringableArrayArray(escapedValues)) {
      escapedValues = escapedValues.map(glueColonsSurroundParents)
      return escapedValues.join(', ')
    } else {
      if (escapedValues[0][0] === '(') {
        return escapedValues.join(', ')
      }
      return glueColonsSurroundParents(escapedValues);
    }
  }

  queryFormat(query: string, values?: Values): string {

    if (!query) throw new Error('A query must be provided');
    if (!values) return query;

    this.values = values;

    if (this.values instanceof Array) {
      this.copyOfValuesWhenArray = Object.assign([], values);
    }

    const regex = /\:([A-Za-z0-9_?]+)/g;

    const matches = query.match(regex);

    if (matches === null) {
      throw new Error('There is an error in your regex');
    }

    this.matchesCount = matches.length;

    return query.replace(regex, this.replacer);
  }

  replacer(ref: string, key: string): string {
    if (this.values === null) throw new Error('Need to pass the values in first');
    let ret;
    // question mark
    if (key === '?') {
      // single :?
        // a) stringable array array
        // b) object stringable
      // many :?, :?
        // c) stringable array
        // d) stringable array array
      if (isStringableObj(this.values)) {
        // b) object stringable
        return Object.keys(this.values).map((k: string) =>`${k} = ${this.escape((this.values as StringableObj)[k])}`).join(' AND ');
      } else if (!this.copyOfValuesWhenArray) {
        throw new Error('the :? placeholder requires values to be an array');
      }
      // is stringable array (why not put ourselves in else of isStringableObject above?)
      if (this.matchesCount === 1) {
        if (isStringableArrayArray(this.copyOfValuesWhenArray)) {
          // a) stringable array array
          ret = this.mapEscape(this.copyOfValuesWhenArray, 0, true, ref); // string[][]
        } else {
          // -> unknown case)
          ret = this.mapEscape(this.copyOfValuesWhenArray, 0, true, ref); // string[]
        }
      } else { // matchesCount =0 or >=2
        // c) stringable array
        // d) stringable array array
        if (this.copyOfValuesWhenArray === null) throw new Error('This should have been set before');
        const replaceWithNext = this.copyOfValuesWhenArray.shift();
        if (replaceWithNext === undefined) {
          throw new Error('More question marks than elements');
        } else if (isStringableArray(replaceWithNext))  {
          ret = this.mapEscape(replaceWithNext, 0, true, ref); // stringable[]
        } else if (isStringable(replaceWithNext)) {
          ret = this.mapEscape(replaceWithNext, 0, true, ref); // stringable
        }
      }
      // single :ref
        // e) object stringable array
        // f) object stringable array array
      // many :ref, :ref
        // g) object stringable
        // h) object stringable array
    } else if (isStringableObj(this.values) && this.values.hasOwnProperty(key)) {// Not question mark aka -> named palceholders
        // g) object stringable
      ret = this.mapEscape(this.values[key], 0, false, ref); // stringable
    } else if (isStringableArrayObj(this.values) && this.values.hasOwnProperty(key)) {
        // e) object stringable array
        // h) object stringable array
      ret = this.mapEscape(this.values[key], 0, false, ref); // stringable[]
    } else if (isStringableArrayArrayObj(this.values) && this.values.hasOwnProperty(key)) {
        // f) object stringable array array
      ret = this.mapEscape(this.values[key], 0, false, ref); // stringable[]
    } else {// named ref not present in values (dont replace anything)
      return ref;
    }

    // for ts overload recognition
    if (typeof ret === 'string') {
      return this.joinUseParenthesis(ret);
    } else if (isStringableArray(ret)) {
      return this.joinUseParenthesis(ret);
    } else if (isStringableArrayArray(ret)) {
      return this.joinUseParenthesis(ret);
    } else {
      throw new Error('Ret is somehow undefined, not all cases have been handled, you are trying an unsupported usecase');
    }
  }
}
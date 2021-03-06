'use strict';
const NQPInt = require('./nqp-int.js');
const NQPNum = require('./nqp-num.js');
const NQPStr = require('./nqp-str.js');

const Null = require('./null.js');

const nativeArgs = require('./native-args.js');

const MAX_ARITY = 4;
const MAX_PER_ARITY = 16;

const NativeIntArg = nativeArgs.NativeIntArg;
const NativeNumArg = nativeArgs.NativeNumArg;
const NativeStrArg = nativeArgs.NativeStrArg;

const reprs = require('./reprs.js');

class MultiCache {
  constructor() {
    this.cache = [];
    for (let i = 0; i < MAX_ARITY; i++) {
      this.cache[i] = [];
    }
  }

  $$serializeAsNull() {
    return 1;
  }
};

/*async*/ function posTypes(ctx, capture) {
  const arity = capture.pos.length;
  const types = new Array(arity);
  for (let i = 0; i < arity; i++) {
    const obj = capture.pos[i];

    if (obj instanceof NQPStr) {
      types[i] = 3;
    } else if (obj.$$STable) {
      const deconted = /*await*/ obj.$$decont(ctx);

      /* TODO - think if having flags wouldn't be faster/cleaner then weird objects */
      if (obj.$$isrwcont()) {
        if (obj.$$STable.REPR instanceof reprs.NativeRef) {
          types[i] = obj.$$STable;
        } else {
          if (deconted.$$typeObject) {
            if (deconted.$$STable.typeObjectCachedAsRW === undefined) {
              deconted.$$STable.typeObjectCachedAsRW = {};
            }
            types[i] = deconted.$$STable.typeObjectCachedAsRW;
          } else {
            if (deconted.$$STable.cachedAsRW === undefined) {
              deconted.$$STable.cachedAsRW = {};
            }
            types[i] = deconted.$$STable.cachedAsRW;
          }
        }
      } else {
        types[i] = deconted.$$typeObject ? deconted : deconted.$$STable;
      }
    } else if (obj instanceof NativeIntArg) {
      types[i] = 1;
    } else if (obj instanceof NativeNumArg) {
      types[i] = 2;
    } else if (obj instanceof NativeStrArg) {
      types[i] = 3;
    } else if (obj instanceof NQPInt) {
      types[i] = 1;
    } else if (obj instanceof NQPNum) {
      types[i] = 2;
    }
  }
  return types;
}

const op = {};

op.multicachefind = /*async*/ function(ctx, cache, capture) {
  if (!(cache instanceof MultiCache)) return Null;
  const arity = capture.pos.length;
  if (capture.named) return Null;

  if (arity == 0) {
    if (cache.zeroArity) {
      return cache.zeroArity;
    } else {
      return Null;
    }
  }

  if (arity > MAX_ARITY) return Null;

  const types = /*await*/ posTypes(ctx, capture);

  const arityCache = cache.cache[arity - 1];

  CANDIDATES: for (let i = 0; i < arityCache.length; i++) {
    for (let j = 0; j < arityCache[i].types.length; j++) {
      if (arityCache[i].types[j] !== types[j]) continue CANDIDATES;
    }
    return arityCache[i].result;
  }

  return Null;
};

op.multicacheadd = /*async*/ function(ctx, cache, capture, result) {
  const c = cache instanceof MultiCache ? cache : new MultiCache();
  if (c.named) return c;
  const arity = capture.pos.length;

  if (arity == 0) {
    c.zeroArity = result;
    return c;
  }

  if (arity > MAX_ARITY || c.cache[arity - 1].length > MAX_PER_ARITY) {
    return c;
  }

  c.cache[arity - 1].push({types: /*await*/ posTypes(ctx, capture), result: result});
  return c;
};

exports.op = op;
exports.MultiCache = MultiCache;

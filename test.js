const t = require('ava');
const { collectModules } = require('./source/run');
const { isArray, isObject } = require('util');
const { fromMaybe, isJust, isNothing } = require('sanctuary');
const keys = Object.keys;

t('collectModules', ct => {
  const result = collectModules({ sourceDir: '.', ignore: ['node_modules', 'test.js'] });
  ct.true(isObject(result));
});


const checkTypes = Boolean(process.env['CHECK_TYPES']);
const S_ = require('sanctuary');
const $ = require('sanctuary-def');
const S = S_.create({env: S_.env, checkTypes });
const def = $.create({env: $.env.concat(S_.env), checkTypes });
const repl = require('repl');
const vm = require('vm');
const fs = require('fs');
const { resolve } = require('path');
const { Pair, encase, maybeToNullable, Nothing, splitOnRegex, pipe, filter, trim } = S;
const logger = log = require('debug')('repl-me:child');
const freeze = Object.freeze;
const { CHILD_CLOSING, CHILD_STARTED, CHILD_ERR } = require('./shared');


logger('Checking Types:', checkTypes)

//    attemptRequire :: String -> Maybe Pair
const attemptRequire = encase((path) => Pair (require(path)) (path) );

const send = code => process.send({ code });

const installReplHistory = (replServer, replFilePath) => {
  try {
    fs.statSync(replFilePath);
    fs.readFileSync(replFilePath)
      .toString('utf8')
      .split('\n')
      .reverse()
      .filter(line => line.trim())
      .forEach(line => replServer.history.push(line));
  } catch (e) {
    logger('Cannot load REPL history', e);
  }
}

const saveReplHistory = (replServer, replFilePath) => {
  try {
    fs.appendFileSync(replFilePath, replServer.lines.join('\n'));
  } catch (e) {
    logger('Could not save REPL history', e);
  }
};

const splitPathToKeys = pipe
  ([
    trim,
    (string) => string.replace(/^\./g, ''),
    (string) => string.replace(/(index\.js|\.js)$/g, ''),
    splitOnRegex(/(\/|\\)/g),
    filter(val => val != '')
  ]);

//    collectModules :: String -> Maybe Array String
const collectModules =
  def('collectModules')
  ({})
  ([$.Object, $.Object ])
  (({ sourceDir, ignore }) => {
    if (!sourceDir || !fs.existsSync(sourceDir)) return Nothing;
    const modules = Object.create(null);
    const assignPathToModules = (entry, mod) => {
      modules[entry] = mod;
    };

    const recursivelyScanDir = (dir = '.') => {
      const arr = fs.readdirSync(dir)
      .filter(entry => !~ignore.indexOf(entry));
      for (let entry of arr) {
        const entryWithPrefix = resolve(dir, entry);
        if (fs.statSync(entryWithPrefix).isDirectory()) {
          recursivelyScanDir(dir + '/' + entry);
        }
        if ((/\.js$/).test(entry)) {
          const serialized = maybeToNullable(attemptRequire(entryWithPrefix));
          if (serialized) {
            const path = splitPathToKeys(dir + '/' + entry);
            assignPathToModules(path.slice(-1), serialized.fst);
          }
        }
      }
    };
    recursivelyScanDir(sourceDir);
    freeze(modules);
    return modules;
  });

//    runProgram :: Object -> Unit
const runProgram =
  def('runProgram')
  ({})
  ([$.Unknown, $.Undefined])
  (({input, output, sourceDir = '.', ignore = [], ignoreDefault = ['node_modules', 'test.js'], replHistory}) => {
    const modules = collectModules({sourceDir, ignore: ignore.concat(ignoreDefault)});
    r = repl.start({ output });

    logger('Installing history from', replHistory);
    installReplHistory(r, replHistory)

    r.context = vm.createContext({app: modules});

    process.on('exit', () => {
      saveReplHistory(r, replHistory);
      send(CHILD_CLOSING);
    });

    return;
  });

module.exports = {
  collectModules,
};

if (require.main == module) {
  const isSendableSubProcess = () => Boolean(process && process.send);

  // Running as sub-process?
  if (isSendableSubProcess()) {
    logger('Detected sendable sub-process...');
  }

  try {
    runProgram({
      sourceDir: '.',
      input: process.stdin,
      ouput: process.stdout,
      replHistory: process.env.NODE_REPL_HISTORY,
    });
    send(CHILD_STARTED);
  } catch(e) {
    console.log(e);
    send(CHILD_ERR);
  }
}
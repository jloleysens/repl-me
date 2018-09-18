const logger = require('debug')('repl-me:main');
const cp = require('child_process');
const chokidar = require('chokidar');
const { CHILD_CLOSING, CHILD_ERRORED } = require('./shared');
const HOME_DIR = require('os').homedir();

(function main() {
  let child, childErrored;

  const killChild =  () => {
    if (child && !childErrored) {
      logger(`Killing child: ${child.pid}`)
      process.kill(child.pid);
    }
    child = null;
  };

  const starter = (options) => () => {
    killChild();
    try {
      child = cp.fork(
        './source/run.js',
        [],
        { cwd: options.pwd,
          stdio: 'inherit',
          detached: true,
          env: options.env
        }
      );


      child.on('message', (message) => {
        logger('Received', message);
        if (message.code === CHILD_CLOSING) {
          process.kill(-child.pid);
          process.nextTick(() => {
            process.exit(0);
          });
        } else if (message.code === CHILD_ERRORED) {
          childErrored = true;
        }
      });
    } catch (e) {
      console.log(e);
    }
  }

  if (require.main == module) {
    const pwd = process.env.PWD || __dirname;

    logger('Running main...');
    logger('Present working directory', pwd);
    logger('User home', HOME_DIR);

    const restart = starter(
      {pwd,
        in: process.stdin,
        out: process.stdout,
        env: {...process.env,
          NODE_REPL_HISTORY: HOME_DIR + '/.node_repl_history'}});
    const fsWatcher = chokidar.watch(process.env.PWD);
    fsWatcher.on('change', restart)
    restart();

    process.on('SIGINT', () => {
      logger('Received SIGINT.');
      fsWatcher.close();
      process.nextTick(() => {
        process.exit(0);
      });
    });
  }
})();


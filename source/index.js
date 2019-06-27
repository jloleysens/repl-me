const logger = require('debug')('repl-me:main');
const cp = require('child_process');
const chokidar = require('chokidar');
const { CHILD_CLOSING, CHILD_STARTED, CHILD_ERR } = require('./shared');
const HOME_DIR = require('os').homedir();

(function main() {
  let child;

  const killChild = () => {
    if (child) {
      logger(`Killing child: ${child.pid}`)
      // process.kill(child.pid);
      child.kill();
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
        if (!message) return;

        switch (message.code) {
          case CHILD_CLOSING:
            process.nextTick(() => {
              process.exit(0);
            });
            break;
          case CHILD_STARTED:
            logger(`${child.pid} started...`);
            break;
          case CHILD_ERR:
            console.log('App has errors... REPL will restart once errors have been fixed');
            break;
          default:
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
    fsWatcher.on('change', (path) => {
      logger('Change on path', path);
      console.log('Change detected, reloading app...');
      restart();
    });
    restart();

    process.on('exit', () => {
      logger('Exiting...');
      fsWatcher.close();
      process.nextTick(() => {
        process.exit(0);
      });
    });
  }
})();


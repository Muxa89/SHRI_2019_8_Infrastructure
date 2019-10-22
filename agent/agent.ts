import { config } from './config';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import { promises } from 'fs';
const { mkdtemp } = promises;

import { sep } from 'path';

import * as express from 'express';
import axios from 'axios';

import { Readable } from 'stream';

enum BuildState {
  PENDING = 'pending',
  IN_PROGRESS = 'inProgress',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export interface BuildCommand {
  buildId: number;
  path: string;
  hash: string;
  command: string;
}

export interface BuildResult {
  buildId: number;
  state: BuildState;
  stdout: string;
  stderr: string;
}

const app = express();
app.use(express.json());

app.post('/build', (req, res) => {
  const command: BuildCommand = req.body;
  console.log(`Received build command: ${JSON.stringify(command)}`);
  console.log('Build started...');
  console.log('');
  res.sendStatus(200);

  run(command).then((buildResult: BuildResult) => sendBuildResult(buildResult));
});

app.get('/isAlive', (req, res) => {
  res.sendStatus(200);
});

app.listen(config.port, () =>
  console.log(`Agent started on localhost:${config.port}`)
);

const registration = (() => {
  let registrationCount = 1;
  const maxRegistrationCount = 5;
  const timeout = 3000;

  return () => {
    axios
      .post(`http://localhost:${config.hostPort}/notify_agent`, {
        host: 'localhost',
        port: config.port,
      })
      .then(() => console.log(`Agent successfully registered`))
      .catch(err => {
        console.log(`Error occured during registration: ${err}`);

        if (registrationCount > maxRegistrationCount) {
          console.log(
            `Could not connect to server in ${maxRegistrationCount} attempts. Shutting down.`
          );
          process.exit(1);
        }

        console.log(`Retrying after ${timeout} ms...`);
        registrationCount++;
        setTimeout(registration, timeout);
      });
  };
})();
registration();

interface RunResult {
  code: number;
  stdout: StringBuffer;
  stderr: StringBuffer;
}

class StringBuffer {
  private buffer: string;

  constructor() {
    this.buffer = '';
  }

  append(data: string) {
    this.buffer += data;
  }

  toString() {
    return this.buffer;
  }
}

const consoleLogAndBuffer = (prefix: string, stringBuffer: StringBuffer) => (
  data: string
) => {
  console.log(`${prefix}: ${data}`);
  stringBuffer.append(data);
};

const processStream = (stream: Readable, prefix: string) => {
  const buffer = new StringBuffer();
  stream.setEncoding('utf8');
  stream.on('data', consoleLogAndBuffer(prefix, buffer));
  return buffer;
};

const bufferizeChildProcessOutput = (
  childProcess: ChildProcessWithoutNullStreams,
  prefix: string
): [StringBuffer, StringBuffer] => {
  return [
    processStream(childProcess.stdout, `${prefix} STDOUT`),
    processStream(childProcess.stderr, `${prefix} STDERR`),
  ];
};

const runResultToBuildResult = (
  runResult: RunResult,
  command: BuildCommand
): BuildResult => ({
  buildId: command.buildId,
  state: runResult.code === 0 ? BuildState.SUCCESS : BuildState.FAILURE,
  stdout: runResult.stdout.toString(),
  stderr: runResult.stderr.toString(),
});

interface Spawner {
  (): ChildProcessWithoutNullStreams;
}

const bufferizeSpawn = (prefix: string, spawner: Spawner) => (
  runResult?: RunResult
) =>
  new Promise((res, rej) => {
    if (!runResult) {
      runResult = {
        code: 0,
        stdout: new StringBuffer(),
        stderr: new StringBuffer(),
      };
    } else {
      runResult = Object.assign({}, runResult);
    }

    const process = spawner();

    const [stdout, stderr] = bufferizeChildProcessOutput(process, prefix);

    process.on('close', code => {
      runResult.code = code;
      runResult.stdout.append(stdout.toString());
      runResult.stderr.append(stderr.toString());

      if (code !== 0) {
        rej(runResult);
      } else {
        res(runResult);
      }
    });

    process.on('error', err => {
      runResult.code = -1;
      runResult.stderr.append(
        `${prefix} Error: ${err.name}\n${err.message}\n${err.stack}\n`
      );
      rej(runResult);
    });
  });

const gitClone = (command: BuildCommand, folder: string) =>
  bufferizeSpawn('CLONE', () => spawn('git', ['clone', command.path, folder]));

const gitCheckout = (command: BuildCommand) =>
  bufferizeSpawn('CHECKOUT', () => spawn('git', ['checkout', command.hash]));

const run = (command: BuildCommand) => {
  let tempFolder;
  return (
    mkdtemp(`${__dirname}${sep}`)
      .then(folder => {
        tempFolder = tempFolder;
        return null;
      })
      .then(gitClone(command, tempFolder))
      .then(gitCheckout(command))
      // git checkout
      // return (
      //   new Promise((res, rej) => {
      //     const checkout = spawn('git', ['checkout', command.hash], {
      //       cwd: command.path,
      //     });

      //     const [stdout, stderr] = bufferizeChildProcessOutput(
      //       checkout,
      //       'CHECKOUT'
      //     );

      //     checkout.on('close', code => {
      //       const runResult: RunResult = {
      //         code,
      //         stdout,
      //         stderr,
      //       };

      //       if (code !== 0) {
      //         rej(runResult);
      //       } else {
      //         res(runResult);
      //       }
      //     });
      //   })
      //     // run provided command
      //     .then(
      //       (runResult: RunResult) =>
      //         new Promise((res, rej) => {
      //           const commandArr = command.command.split(' ');

      //           if (process.platform === 'win32') {
      //             commandArr[0] = `${commandArr[0]}.cmd`;
      //           }

      //           const build = spawn(
      //             commandArr[0],
      //             commandArr.slice(1, commandArr.length),
      //             {
      //               cwd: command.path,
      //             }
      //           );

      //           const [stdout, stderr] = bufferizeChildProcessOutput(
      //             build,
      //             'BUILD'
      //           );

      //           const newResult = Object.assign({}, runResult);

      //           build.on('close', code => {
      //             newResult.code = code;
      //             newResult.stdout.append(stdout.toString());
      //             newResult.stderr.append(stderr.toString());

      //             if (code !== 0) {
      //               rej(newResult);
      //             } else {
      //               res(newResult);
      //             }
      //           });

      //           build.on('error', err => {
      //             newResult.code = -1;
      //             newResult.stderr.append(
      //               `BUILD Error: ${err.name}\n${err.message}\n${err.stack}\n`
      //             );
      //             rej(newResult);
      //           });
      //         })
      //     )
      .then((runResult: RunResult) =>
        runResultToBuildResult(runResult, command)
      )
      .catch((runResult: RunResult) =>
        runResultToBuildResult(runResult, command)
      )
  );
};

const sendBuildResult = (buildResult: BuildResult) => {
  console.log(`Sending build result: ${buildResult}`);

  axios.post(
    `http://localhost:${config.hostPort}/notify_build_result`,
    buildResult
  );
};

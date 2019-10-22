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
  const out = `${prefix}: ${data}${data[data.length - 1] !== '\n' ? '\n' : ''}`;
  console.log(out);
  stringBuffer.append(out);
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

const bufferizeSpawn = (
  prefix: string,
  spawner: Spawner,
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

const gitCheckout = (
  command: BuildCommand,
  folder: string,
  runResult: RunResult
) =>
  bufferizeSpawn(
    'CHECKOUT',
    () =>
      spawn('git', ['checkout', command.hash], {
        cwd: folder,
      }),
    runResult
  );

const npmInstall = (folder: string, runResult: RunResult) =>
  bufferizeSpawn(
    'NPM INSTALL',
    () =>
      spawn(`npm${process.platform === 'win32' ? '.cmd' : ''}`, ['install'], {
        cwd: folder,
      }),
    runResult
  );

const runCommand = (
  command: BuildCommand,
  folder: string,
  runResult: RunResult
) =>
  bufferizeSpawn(
    'BUILD',
    () => {
      const commandArgs = command.command.split(' ');
      if (
        process.platform === 'win32' &&
        commandArgs[0].indexOf('.cmd') === -1
      ) {
        commandArgs[0] += '.cmd';
      }

      return spawn(commandArgs[0], commandArgs.slice(1, commandArgs.length), {
        cwd: folder,
      });
    },
    runResult
  );

const run = (command: BuildCommand) => {
  let tempFolder;
  return mkdtemp(`${__dirname}${sep}`)
    .then(folder => {
      tempFolder = folder;
    })
    .then(() => gitClone(command, tempFolder))
    .then((runResult: RunResult) => gitCheckout(command, tempFolder, runResult))
    .then((runResult: RunResult) => npmInstall(tempFolder, runResult))
    .then((runResult: RunResult) => runCommand(command, tempFolder, runResult))
    .then((runResult: RunResult) => runResultToBuildResult(runResult, command))
    .catch((runResult: RunResult) =>
      runResultToBuildResult(runResult, command)
    );
};

const sendBuildResult = (buildResult: BuildResult) => {
  console.log(`Sending build result: ${JSON.stringify(buildResult)}`);

  axios.post(
    `http://localhost:${config.hostPort}/notify_build_result`,
    buildResult
  );
};

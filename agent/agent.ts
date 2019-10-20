import * as express from 'express';
import { config } from './config';
import axios from 'axios';
import { BuildState, BuildCommand, BuildResult } from '../server/executor';

const app = express();
app.use(express.json());

app.post('/build', (req, res) => {
  const command: BuildCommand = req.body;
  console.log(`Received build command: ${JSON.stringify(command)}`);
  res.sendStatus(200);

  run(command)
    .then((buildResult: BuildResult) => sendBuildResult(buildResult))
    .catch(stderr =>
      sendBuildResult({
        buildId: command.buildId,
        state: BuildState.FAILURE,
        stdout: '',
        stderr: stderr,
      })
    );
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

const run = (command: BuildCommand) =>
  new Promise((resolve, reject) => {
    setTimeout(
      () =>
        resolve({
          buildId: command.buildId,
          state: BuildState.SUCCESS,
          stdout: 'success',
          stderr: '',
        } as BuildResult),
      3000
    );
  });

const sendBuildResult = (buildResult: BuildResult) => {
  axios.post(
    `http://localhost:${config.hostPort}/notify_build_result`,
    buildResult
  );
};

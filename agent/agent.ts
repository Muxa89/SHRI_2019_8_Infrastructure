import * as express from 'express';
import { config } from './config';
import axios from 'axios';
import { BuildState } from '../server/executor';

const app = express();
app.use(express.json());

app.post('/build', (req, res) => {
  console.log(`Received build command: ${JSON.stringify(req.body)}`);
  res.sendStatus(200);
  setTimeout(() => {
    axios.post(`http://localhost:${config.hostPort}/notify_build_result`, {
      id: req.body.id,
      state: BuildState.SUCCESS,
      stdout: 'Successfull build',
      stderr: '',
    });
  }, 3000);
});

app.listen(config.port, () => console.log(`Agent started on localhost:${config.port}`));

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

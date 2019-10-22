import * as express from 'express';
import { Application } from 'express';
import { config } from './config';
import Executor, { BuildResult } from './executor';

function initUi(app: Application, executor: Executor): void {
  app.set('views', './server/public/templates');
  app.set('view engine', 'pug');

  app.get('/', (req, res) => res.render('index.pug'));

  app.get('/build/:buildId', (req, res) =>
    res.render('build.pug', {
      ...executor.getBuilds(Number(req.params.buildId)),
    })
  );

  app.get('/agents', (req, res) =>
    res.render('agents.pug', {
      agents: executor.getAgents(),
    })
  );

  app.use('/js', express.static('server/public/js'));
  app.use('/js', express.static('node_modules/axios/dist'));

  app.post('/', (req, res) => {
    const { hash, command } = req.body;
    executor.queueBuildTask(hash, command);
    res.sendStatus(200);
  });

  app.get('/status', (req, res) =>
    res.send({
      builds: executor.getBuilds(),
    })
  );
}

function initAgentApi(app: Application, executor: Executor): void {
  app.post('/notify_agent', (req, res) => {
    const { host, port } = req.body;
    executor.addAgent(host, port);
    res.sendStatus(200);
  });

  app.post('/notify_build_result', (req, res) => {
    const buildResult: BuildResult = req.body;
    executor.setBuildResult(buildResult);
    res.sendStatus(200);
  });
}

const executor = new Executor(config.path);

const app = express();
app.use(express.json());

initUi(app, executor);
initAgentApi(app, executor);

app.listen(config.port, () =>
  console.log(`Server is listening on port ${config.port}`)
);

import * as express from 'express';
import { Application, Request, Response } from 'express';
import { config } from './config';

enum BuildState {
  IN_PROGRESS = 'inProgress',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

interface Build {
  id: number;
  hash: string;
  state: BuildState;
  stdout: string;
  stderr: string;
}

interface BuildMap {
  [id: number]: Build;
}

interface BuildResult {
  id: number;
  state: BuildState;
  stdout: string;
  stderr: string;
}

enum AgentState {
  PENDING = 'pending',
  BUILDING = 'building',
  ERROR = 'error',
}

interface Agent {
  host: string;
  port: number;
  state: AgentState;
}

interface AgentBuild {
  [buildId: number]: Agent;
}

function initUi(app: Application, builds: BuildMap): void {
  app.set('views', './server/public/templates');
  app.set('view engine', 'pug');

  app.get('/', (req, res) => res.render('index.pug'));

  app.get('/build/:buildId', (req, res) =>
    res.render('build.pug', { buildId: req.params.buildId })
  );

  app.use('/js', express.static('server/public/js'));
  app.use('/js', express.static('node_modules/axios/dist'));

  app.post('/', (req, res) => {
    console.log(req.body);
    res.sendStatus(200);
  });

  app.get('/status', (req, res) =>
    res.send({
      builds,
    })
  );
}

function initAgentApi(
  app: Application,
  agents: Array<Agent>,
  builds: BuildMap,
  agentBuild: AgentBuild
): void {
  app.post('/notify_agent', (req, res) => {
    const { host, port } = req.body;
    agents.push({
      host,
      port,
      state: AgentState.PENDING,
    });
    console.log(
      `Agent #${agents.length -
        1} on ${host}:${port} was successfully registered and is waiting for commands.`
    );
    res.sendStatus(200);
  });

  app.post('/notify_build_result', (req, res) => {
    const { id, state, stdout, stderr } = req.body as BuildResult;
    const build = builds[id];
    build.state = state;
    build.stdout = stdout;
    build.stderr = stderr;

    const agent = agentBuild[id];
    console.log(
      `Agent on ${agent.host}:${agent.port} finished task with state: ${state}`
    );
    delete agentBuild[id];

    res.sendStatus(200);
  });
}

const builds = {
  1: {
    id: 1,
    hash: '123',
    state: BuildState.SUCCESS,
    stdout: '',
    stderr: '',
  },
  2: {
    id: 2,
    hash: '223',
    state: BuildState.IN_PROGRESS,
    stdout: '',
    stderr: '',
  },
};
const agents: Array<Agent> = [];
const agentBuild: AgentBuild = {};

const app = express();
app.use(express.json());

initUi(app, builds);
initAgentApi(app, agents, builds, agentBuild);

app.listen(config.port, () =>
  console.log(`Server is listening on port ${config.port}`)
);

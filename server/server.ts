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
}

interface BuildMap {
  [id: number]: Build;
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

function initUi(app: Application, builds: BuildMap): void {
  app.set('views', './server/public/templates');
  app.set('view engine', 'pug');

  app.get('/', (req: Request, res: Response) => res.render('index.pug'));

  app.get('/build/:buildId', (req: Request, res: Response) =>
    res.render('build.pug', { buildId: req.params.buildId })
  );

  app.use('/js', express.static('server/public/js'));
  app.use('/js', express.static('node_modules/axios/dist'));

  app.post('/', (req: Request, res: Response) => {
    console.log(req.body);
    res.sendStatus(200);
  });

  app.get('/status', (req: Request, res: Response) =>
    res.send({
      builds,
    })
  );
}

function initAgentApi(app: Application, agents: Array<Agent>): void {
  app.post('/notify_agent', req => {
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
  });
}

const builds = {
  1: {
    id: 1,
    hash: '123',
    state: BuildState.SUCCESS,
  },
  2: {
    id: 2,
    hash: '223',
    state: BuildState.IN_PROGRESS,
  },
};

const agents: Array<Agent> = [];

const app = express();
app.use(express.json());

initUi(app, builds);
initAgentApi(app, agents);

app.listen(config.port, () =>
  console.log(`Server is listening on port ${config.port}`)
);

// app.post('/notify_build_result', req => {
//   const params = req.body;
// });

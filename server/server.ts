import { resolve } from 'path';
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

interface Agent {
  host: string;
  port: number;
}

function initUi(app: Application, builds: Array<Build>): void {
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

function initBackend(app: Application, agents: Array<Agent>): void {
  app.post('/notify_agent', req => {
    const params = req.body;
    agents.push(params);
    console.log(
      `Agent on ${params.host}:${params.port} successfully registered.`
    );
  });
}

const builds = [
  {
    hash: '123',
    state: BuildState.SUCCESS,
    id: 111,
  },
  {
    hash: '223',
    state: BuildState.IN_PROGRESS,
    id: 222,
  },
];

const agents = [];

const app = express();
app.use(express.json());

initUi(app, builds);

app.listen(config.port, () =>
  console.log(`Server is listening on port ${config.port}`)
);

// app.post('/notify_build_result', req => {
//   const params = req.body;
// });

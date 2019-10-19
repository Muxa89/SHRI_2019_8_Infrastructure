import { resolve } from 'path';
import * as express from 'express';
import { Application, Request, Response } from 'express';
import { config } from './config';

function initUi(app: Application): void {
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
      builds: [
        {
          hash: '123',
          state: 'success',
          buildId: 111,
        },
        {
          hash: '223',
          state: 'failed',
          buildId: 222,
        },
      ],
    })
  );
}

const app = express();
app.use(express.json());

initUi(app);

app.listen(config.port, () =>
  console.log(`Server is listening on port ${config.port}`)
);

// app.get('/build/:buildId', sendFile('src/html/build.html'));
// app.get('/buildState', (req, res) =>
//   res.send({
//     builds: [
//       {
//         hash: '123',
//         state: 'success',
//         buildId: 111,
//       },
//       {
//         hash: '223',
//         state: 'failed',
//         buildId: 222,
//       },
//     ],
//   })
// );

// app.listen(port, () => console.log(`UI server is listening on port ${port}.`));

// app.post('/notify_agent', req => {
//   const params = req.body;
//   agents.push(params);
//   console.log(
//     `Agent on ${params.host}:${params.port} successfully registered.`
//   );
// });

// app.post('/notify_build_result', req => {
//   const params = req.body;
// });

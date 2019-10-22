import axios from 'axios';

export enum BuildState {
  PENDING = 'pending',
  IN_PROGRESS = 'inProgress',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export interface Build {
  id: number;
  hash: string;
  command: string;
  state: BuildState;
  stdout: string;
  stderr: string;
}

export interface BuildMap {
  [id: number]: Build;
}

export interface BuildResult {
  buildId: number;
  state: BuildState;
  stdout: string;
  stderr: string;
}

export enum AgentState {
  PENDING = 'pending',
  BUILDING = 'building',
  ERROR = 'error',
}

export interface Agent {
  host: string;
  port: number;
  state: AgentState;
}

export interface AgentBuild {
  [buildId: number]: Agent;
}

export interface BuildCommand {
  buildId: number;
  path: string;
  hash: string;
  command: string;
}

export default class Executor {
  private builds: BuildMap;
  private agents: Array<Agent>;
  private agentBuild: AgentBuild;
  private path: string;
  private buildIdCounter: number;

  constructor(path: string) {
    this.builds = {};
    this.agents = [];
    this.agentBuild = {};
    this.path = path;
    this.buildIdCounter = 0;
  }

  queueBuildTask(hash: string, command: string) {
    const buildId = this.buildIdCounter++;

    const build = {
      id: buildId,
      hash: hash,
      command: command,
      state: BuildState.PENDING,
      stdout: '',
      stderr: '',
    };

    this.builds[buildId] = build;

    console.log(`Build #${buildId} "${hash}:${command}" queued.`);

    this.execute();
  }

  getPendingBuilds() {
    return Object.values(this.builds).filter(
      build => build.state === BuildState.PENDING
    );
  }

  getPendingAgents() {
    return this.agents.filter(agent => agent.state === AgentState.PENDING);
  }

  runBuild(agent: Agent, build: Build) {
    axios
      .post(`http://${agent.host}:${agent.port}/build`, {
        buildId: build.id,
        path: this.path,
        hash: build.hash,
        command: build.command,
      } as BuildCommand)
      .then(() => {
        agent.state = AgentState.BUILDING;
        build.state = BuildState.IN_PROGRESS;
        this.agentBuild[build.id] = agent;
        console.log(
          `"Build" command for build #${build.id}:${build.hash}:"${build.command}" was sent to agent ${agent.host}:${agent.port}`
        );
      })
      .catch(err => {
        agent.state = AgentState.ERROR;
        console.log(
          `Error occured while sending "build" command to agent ${agent.host}:${agent.port}. ${err}`
        );
      });
  }

  execute() {
    const pendingBuilds = this.getPendingBuilds();
    if (pendingBuilds.length === 0) {
      return;
    }

    let pendingAgents = this.getPendingAgents();
    if (pendingAgents.length === 0) {
      return;
    }

    let i = 0;
    while (i < pendingAgents.length && pendingBuilds[i] !== undefined) {
      this.runBuild(pendingAgents[i], pendingBuilds[i]);
      i++;
    }
  }

  setBuildResult(buildResult: BuildResult) {
    const { buildId, state, stdout, stderr } = buildResult;
    const build = this.builds[buildId];
    build.state = state;
    build.stdout = stdout;
    build.stderr = stderr;

    const agent = this.agentBuild[buildId];
    agent.state = AgentState.PENDING;
    delete this.agentBuild[buildId];

    console.log(
      `Build #${buildId} completed with state: ${build.state} by agent ${agent.host}:${agent.port}`
    );

    this.execute();
  }

  getBuilds(buildId?: number) {
    return buildId !== undefined ? this.builds[buildId] : Object.values(this.builds);
  }

  addAgent(host, port) {
    this.agents.push({ host, port, state: AgentState.PENDING });
    console.log(`Agent running on ${host}:${port} was succesfully registered.`);
  }
}

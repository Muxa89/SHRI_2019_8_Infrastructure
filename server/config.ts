export interface Config {
  port: number;
  path: string;
  agentIsAliveCheckInterval: number;
  agentIsAliveCheckTimeout: number;
}

export const config: Config = {
  port: 3000,
  path: 'C:/Muxa/SHRI/homework/5_Tooling',
  agentIsAliveCheckInterval: 5000,
  agentIsAliveCheckTimeout: 1000,
};

export type UserProvidedEnvVarNames = {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: string;
  charset?: string;
  collation?: string;
  multipleStatements?: string;
};

export type ConfigPropsOptional = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  charset?: string;
  collation?: string;
  multipleStatements?: boolean;
};

const defaultEnvVarNames: UserProvidedEnvVarNames = {
  host: 'DB_HOST',
  user: 'DB_USER',
  password: 'DB_PASSWORD',
  database: 'DB_NAME',
  port: 'DB_PORT',
  charset: 'DB_CHARSET',
  // collation: 'DB_COLLATION',
  multipleStatements: 'MULTIPLE_STATEMENTS',
};

export function extractConfigFromEnv(
  env: any,
  envVarNames: UserProvidedEnvVarNames = defaultEnvVarNames
): ConfigPropsOptional {
  const envVNames = envVarNames || defaultEnvVarNames;
  const convertToBoolean = { multipleStatements: true };
  const convertToNumber = { port: 3306 };
  const config: ConfigPropsOptional = Object.keys(envVNames).reduce((res, mysqljsConfKey, i) => {
    const envVarName = (envVNames as { [k: string]: string; })[mysqljsConfKey];
    return (envVarName && env[envVarName] !== undefined)
    ? {
      ...res,
      [mysqljsConfKey]: convertToBoolean.hasOwnProperty(mysqljsConfKey)
        ? !(env[envVarName] === 'false' || env[envVarName] === '0')
        : (convertToNumber.hasOwnProperty(mysqljsConfKey) && typeof env[envVarName] === 'string'
          ? parseInt(env[envVarName])
          : env[envVarName]
        ),
    }
    : {
      ...res,
    };
  }, {});
  return config;
}

export function isMissingConfigProps(
  config: ConfigPropsOptional
): boolean {
  const requiredProps = ['host', 'user', 'password', 'database'];
  return requiredProps.some((prop) => !config[prop as keyof ConfigPropsOptional]);
}


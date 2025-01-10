import ownstatsConfig from "./ownstats.config.json";

type CognitoConfig = {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  authenticationFlowType: string;
}

export const CognitoAuthConfig: CognitoConfig = {
  region: ownstatsConfig.region,
  userPoolId:  ownstatsConfig.cognito.userPoolId,
  userPoolClientId: ownstatsConfig.cognito.userPoolClientId,
  identityPoolId: ownstatsConfig.cognito.identityPoolId,
  authenticationFlowType: "USER_SRP_AUTH",
};

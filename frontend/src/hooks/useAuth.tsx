import { Amplify } from "aws-amplify";
import { getCurrentUser, fetchAuthSession, signIn, signOut, JWT } from "aws-amplify/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { CognitoAuthConfig } from "../cognitoConfig";

export type AWSCredentials = {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
	expiration?: Date;
};

Amplify.configure({
  Auth: {
    Cognito: {
      ...CognitoAuthConfig
    }
  }
});

interface UseAuth {
    isLoading: boolean;
    isAuthenticated: boolean;
    userData: UserData | undefined;
    nextStep: string | undefined;
    login: (username: string, password: string) => Promise<Result>;
    logout: () => void;
    getCredentials: () => Promise<AWSCredentials | undefined>;
    getIdToken: () => Promise<JWT | undefined>;
}

interface Result {
    success: boolean;
    message: string;
}

type Props = {
    children?: React.ReactNode;
};

export type UserData = {
  username: string;
  email: string;
}

const authContext = createContext({} as UseAuth);

export const AuthProvider: React.FC<Props> = ({ children }) => {
    const auth = useProvideAuth();
    return <authContext.Provider value={auth}>{children}</authContext.Provider>;
};

export const useAuth = () => {
    return useContext(authContext);
};

const useProvideAuth = (): UseAuth => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [userData, setUserData] = useState<UserData | undefined>(undefined);
    const [nextStep, setNextStep] = useState<string | undefined>();

    useEffect(() => {
        getCurrentUser()
            .then((result) => {
                setUserData({
                  username: result.username,
                  email: result.signInDetails?.loginId ?? ""
                });
                setIsAuthenticated(true);
                setIsLoading(false);
            })
            .catch(() => {
                setUserData(undefined);
                setIsAuthenticated(false);
                setIsLoading(false);
            });
    }, []);

    const login = async (username: string, password: string): Promise<Result> => {
        try {
            const { isSignedIn, nextStep } = await signIn({ username, password });
            if (nextStep) {
              setNextStep(nextStep.signInStep);
            }

            if (isSignedIn) {
              const { username, signInDetails } = await getCurrentUser();
              
              setUserData({
                username: username,
                email: signInDetails?.loginId ?? ""
              });
              setIsAuthenticated(true);
              setIsLoading(false);

              return { success: true, message: "" };
            } else {
              setIsAuthenticated(false);
              setIsLoading(false);

              return { success: false, message: "User couldn't be signed in!" };
            }
        } catch (error) {
          throw Error("Login failed!");
        }
    };

    const logout = async (): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        try {
          await signOut();
          setUserData(undefined);
          setIsAuthenticated(false);
          setNextStep(undefined);
          resolve();
        } catch (error) {
          console.log(error);
          reject(error);
        }
      });
    };

    // See https://aws-amplify.github.io/amplify-js/api/globals.html#authsession
    const getCredentials = async (): Promise<AWSCredentials | undefined> => {
      if (isAuthenticated) {
        try {
          const { credentials } = (await fetchAuthSession()) ?? {};
          return credentials;
        } catch (err) {
          console.log(err);
        }
      }
    }

    const getIdToken = async (): Promise<JWT | undefined> => {
      if (isAuthenticated) {
        try {
          const { idToken } = (await fetchAuthSession()).tokens ?? {};
          return idToken;
        } catch (err) {
          console.log(err);
        }
      }
    }

    return {
        isLoading,
        isAuthenticated,
        userData,
        nextStep,
        login,
        logout,
        getCredentials,
        getIdToken,
    };
};
import ownstatsConfig from "../ownstats.config.json";

export default async function ApiCall (uri: string = "/domains", method: string = "GET", idToken: string, body?: object): Promise<any> {
  // Request config
  const request: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${idToken}`,
    },
  }

  // Add body if present
  if (body) {
    request.body = JSON.stringify(body);
  }

  // Send request
  const response = await fetch(`${ownstatsConfig.backend.apiUrl}${uri}`, request);

  // Check error
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  let content;

  // Wrap so that no error is raised for empty responses, e.g. delete requests
  try {
    // Parse as JSON
    content = await response.json();
  } catch (err: any) {
    console.log(err);
  }

  return content;
}